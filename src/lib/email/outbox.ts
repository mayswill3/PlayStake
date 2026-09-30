// =============================================================================
// PlayStake — Email outbox
// =============================================================================
// Emails are never sent inline with a request or a money transaction. Callers
// write an outbox row (ideally inside the same DB transaction as the event), and
// the email-delivery worker sends it. That way:
//
//   - an email can never describe something that rolled back,
//   - a Resend outage never fails a deposit, settlement or payout,
//   - retries are bounded and de-duplicated by dedupeKey.
// =============================================================================

import { EmailOutboxStatus, type Prisma } from "../../../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import type { TxClient } from "@/lib/db/client";
import { AccountStatus, GamstopStatus, PlayerRiskStatus } from "../../../generated/prisma/client";
import { getActiveBreak } from "@/lib/responsible-play/service";
import {
  isEssential,
  isKnownTemplate,
  isMarketing,
  renderEmail,
  type EmailPayload,
  type EmailTemplateName,
} from "./templates";

/** Give up after this many attempts (the worker backs off between each). */
export const MAX_EMAIL_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export interface QueueEmailInput<N extends EmailTemplateName> {
  template: N;
  payload: EmailPayload<N>;
  /** One per event — the same key is reused as the provider idempotency key. */
  dedupeKey: string;
  /** Recipient. Omit to look up the user's address. */
  toEmail?: string;
  userId?: string;
}

/**
 * Queue an email. Pass `tx` to write it in the same transaction as the event.
 *
 * Skips silently when there's no address to send to, and for any
 * non-essential email when the user has turned optional emails off or must
 * not be contacted (see mayReceiveOptionalEmail). Duplicate dedupeKeys are
 * ignored, so a retried worker job never sends twice.
 */
export async function queueEmail<N extends EmailTemplateName>(
  input: QueueEmailInput<N>,
  tx?: TxClient,
): Promise<void> {
  const client = (tx ?? prisma) as TxClient;

  let toEmail = input.toEmail;
  if (!toEmail && input.userId) {
    const user = await client.user.findUnique({
      where: { id: input.userId },
      select: {
        email: true,
        emailNotifications: true,
        marketingConsent: true,
        accountStatus: true,
        gamstopStatus: true,
      },
    });
    if (!user) return;
    if (!isEssential(input.template) && !(await mayReceiveOptionalEmail(input.userId, user))) {
      return;
    }
    if (isMarketing(input.template) && !user.marketingConsent) return;
    toEmail = user.email;
  }
  if (!toEmail) return;

  try {
    await client.emailOutbox.create({
      data: {
        userId: input.userId ?? null,
        toEmail,
        template: input.template,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (error) {
    // Unique violation on dedupeKey: this email is already queued or sent.
    if ((error as { code?: string }).code === "P2002") return;
    throw error;
  }
}

/**
 * Whether a user may receive non-essential email. Self-excluded customers,
 * anyone on a cool-off, anyone registered with GAMSTOP, restricted accounts,
 * and anyone showing a marker of gambling harm in the last 30 days (unless
 * staff reviewed and dismissed it) get only essential (security, money,
 * responsible-play) email.
 */
async function mayReceiveOptionalEmail(
  userId: string,
  user: {
    emailNotifications: boolean;
    accountStatus: AccountStatus;
    gamstopStatus: GamstopStatus | null;
  },
): Promise<boolean> {
  if (!user.emailNotifications) return false;
  if (user.accountStatus !== AccountStatus.ACTIVE) return false;
  if (user.gamstopStatus === GamstopStatus.EXCLUDED) return false;
  const recentHarmSignal = await prisma.playerRiskSignal.findFirst({
    where: {
      userId,
      status: { not: PlayerRiskStatus.DISMISSED },
      createdAt: { gte: new Date(Date.now() - HARM_MARKETING_PAUSE_MS) },
    },
    select: { id: true },
  });
  if (recentHarmSignal) return false;
  return (await getActiveBreak(userId)) === null;
}

/** How long after a marker of harm optional and marketing email stays off. */
const HARM_MARKETING_PAUSE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Queue an email without letting a failure disturb the caller. For use at the
 * edges of request handlers, where the money work has already committed.
 */
export async function queueEmailSafely<N extends EmailTemplateName>(
  input: QueueEmailInput<N>,
): Promise<void> {
  try {
    await queueEmail(input);
  } catch (error) {
    console.error(`[Email] Could not queue ${input.template}:`, error);
  }
}

async function deliver(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY environment variable is not set");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "PlayStake <support@playstake.org>",
      reply_to: "support@playstake.org",
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${body}`);
  }
}

export interface OutboxFlushResult {
  sent: number;
  failed: number;
  exhausted: number;
}

/**
 * Send every due outbox row. Called by the email-delivery worker.
 *
 * Rows are claimed one at a time with an atomic status flip, so two worker
 * instances can never send the same email.
 */
export async function flushEmailOutbox(limit = 25): Promise<OutboxFlushResult> {
  const result: OutboxFlushResult = { sent: 0, failed: 0, exhausted: 0 };

  const due = await prisma.emailOutbox.findMany({
    where: { status: EmailOutboxStatus.PENDING, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const { id } of due) {
    // Claim the row: only the instance that flips PENDING -> SENT proceeds. It
    // is reverted to PENDING below if the send fails, so nothing is lost.
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id, status: EmailOutboxStatus.PENDING },
      data: { status: EmailOutboxStatus.SENT, attempts: { increment: 1 }, sentAt: new Date() },
    });
    if (claimed.count === 0) continue;

    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });

    try {
      if (!isKnownTemplate(row.template)) {
        throw new Error(`Unknown email template "${row.template}"`);
      }
      const rendered = renderEmail(
        row.template,
        row.payload as unknown as EmailPayload<EmailTemplateName>,
      );
      await deliver({
        to: row.toEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: row.dedupeKey,
      });
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = row.attempts >= MAX_EMAIL_ATTEMPTS;
      const backoff = RETRY_BACKOFF_MS[Math.min(row.attempts - 1, RETRY_BACKOFF_MS.length - 1)];

      await prisma.emailOutbox.update({
        where: { id },
        data: {
          status: exhausted ? EmailOutboxStatus.FAILED : EmailOutboxStatus.PENDING,
          sentAt: null,
          lastError: message.slice(0, 1000),
          nextAttemptAt: new Date(Date.now() + backoff),
        },
      });

      if (exhausted) result.exhausted += 1;
      else result.failed += 1;
      console.error(`[Email] ${row.template} to ${row.toEmail} failed (attempt ${row.attempts}): ${message}`);
    }
  }

  return result;
}
