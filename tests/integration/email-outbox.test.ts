// =============================================================================
// Integration Tests: Email outbox
// =============================================================================
// Emails are queued as rows and sent by a worker. What matters: one email per
// event (never two), optional emails respect the user's preference, essential
// ones ignore it, and a provider failure retries then gives up rather than
// blocking anything or looping forever.
// =============================================================================

import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import * as crypto from "crypto";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import { EmailOutboxStatus } from "../../generated/prisma/client.js";
import { flushEmailOutbox, queueEmail, MAX_EMAIL_ATTEMPTS } from "../../src/lib/email/outbox.js";
import { emailBetSettled, emailBetVoided } from "../../src/lib/email/events.js";
import { Decimal } from "@prisma/client/runtime/client";
import { BetMatchType, BetOutcome, BetStatus } from "../../generated/prisma/client.js";

const prisma = getTestPrisma();

/** Stub the Resend HTTP call; every test asserts on what would have been sent. */
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
process.env.RESEND_API_KEY = "re_test_key";

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
  // These tests assert on flush counts, and other suites queue emails of their
  // own into the shared test database, so start from a genuinely empty queue.
  await prisma.emailOutbox.deleteMany({});
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: "outbox-" } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.emailOutbox.deleteMany({});
  await prisma.bet.deleteMany({ where: { playerAId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { developerProfile: { userId: { in: userIds } } } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeUser(emailNotifications = true) {
  const uid = crypto.randomUUID().substring(0, 8);
  return prisma.user.create({
    data: {
      email: `outbox-${uid}@playstake-test.com`,
      displayName: "Outbox Tester",
      emailVerified: true,
      emailNotifications,
    },
  });
}

/** The JSON body of the nth Resend call. */
function sentBody(index = 0) {
  return JSON.parse(fetchMock.mock.calls[index][1].body as string);
}

describe("Email outbox: queueing", () => {
  it("sends a queued email once and marks it sent", async () => {
    const user = await makeUser();
    await queueEmail({
      template: "wallet.deposit-succeeded",
      dedupeKey: `test-deposit-${user.id}`,
      userId: user.id,
      payload: { name: "Outbox Tester", amount: "$25.00", balance: "$40.00" },
    });

    const result = await flushEmailOutbox();
    expect(result.sent).toBe(1);

    const body = sentBody();
    expect(body.to).toEqual([user.email]);
    expect(body.subject).toBe("Deposit received — $25.00");
    // The branded layout: logo, the amount, and a plain-text alternative.
    expect(body.html).toContain("playstake.org/logo.png");
    expect(body.html).toContain("$25.00");
    expect(body.text).toContain("$25.00");

    const row = await prisma.emailOutbox.findUniqueOrThrow({
      where: { dedupeKey: `test-deposit-${user.id}` },
    });
    expect(row.status).toBe(EmailOutboxStatus.SENT);
    expect(row.attempts).toBe(1);
  });

  it("never queues the same event twice", async () => {
    const user = await makeUser();
    const input = {
      template: "wallet.withdrawal-paid" as const,
      dedupeKey: `test-dup-${user.id}`,
      userId: user.id,
      payload: { name: "Outbox Tester", amount: "$10.00" },
    };

    await queueEmail(input);
    await queueEmail(input); // e.g. a retried worker job

    const rows = await prisma.emailOutbox.findMany({ where: { dedupeKey: input.dedupeKey } });
    expect(rows).toHaveLength(1);
  });

  it("skips optional emails when the user has turned them off, but not essential ones", async () => {
    const user = await makeUser(false);

    await queueEmail({
      template: "bet.settled",
      dedupeKey: `test-settled-${user.id}`,
      userId: user.id,
      payload: {
        name: "Outbox Tester",
        gameName: "Darts 301",
        opponent: "kwasi88",
        outcome: "won",
        stake: "$5.00",
        netResult: "+$4.50",
        balance: "$20.00",
        betId: crypto.randomUUID(),
      },
    });
    await queueEmail({
      template: "wallet.withdrawal-failed",
      dedupeKey: `test-essential-${user.id}`,
      userId: user.id,
      payload: { name: "Outbox Tester", amount: "$5.00", reason: "Bank rejected" },
    });

    const templates = (
      await prisma.emailOutbox.findMany({ where: { userId: user.id }, select: { template: true } })
    ).map((row) => row.template);
    expect(templates).toEqual(["wallet.withdrawal-failed"]);
  });
});

describe("Email outbox: match events", () => {
  /** A settled head-to-head bet: $5 each, 5% platform fee, player A wins. */
  async function settledBet(outcome: BetOutcome) {
    const playerA = await makeUser();
    const playerB = await makeUser();
    const devUser = await makeUser();
    const profile = await prisma.developerProfile.create({
      data: {
        userId: devUser.id,
        companyName: "Outbox Co",
        contactEmail: `outbox-dev-${crypto.randomUUID().substring(0, 8)}@playstake-test.com`,
      },
    });
    const game = await prisma.game.create({
      data: {
        developerProfileId: profile.id,
        name: "Outbox Game",
        slug: `outbox-game-${crypto.randomUUID().substring(0, 8)}`,
        platformFeePercent: new Decimal("0.05"),
      },
    });
    const bet = await prisma.bet.create({
      data: {
        gameId: game.id,
        playerAId: playerA.id,
        playerBId: playerB.id,
        amount: new Decimal("5.00"),
        status: BetStatus.SETTLED,
        matchType: BetMatchType.GAME_LOBBY,
        platformFeePercent: new Decimal("0.05"),
        platformFeeAmount: new Decimal("0.50"),
        outcome,
        expiresAt: new Date(Date.now() + 3_600_000),
        matchedAt: new Date(),
        settledAt: new Date(),
      },
    });
    return { bet, playerA, playerB, gameId: game.id, profileId: profile.id };
  }

  it("emails both players with the right result and amounts", async () => {
    const { bet, playerA, playerB } = await settledBet(BetOutcome.PLAYER_A_WIN);

    await emailBetSettled(bet.id);
    await flushEmailOutbox();

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body as string));
    const toWinner = bodies.find((body) => body.to[0] === playerA.email);
    const toLoser = bodies.find((body) => body.to[0] === playerB.email);

    // Winner takes the $10 pot less the $0.50 fee, so +$4.50 on a $5 stake.
    expect(toWinner.subject).toBe("You won +$4.50 — Outbox Game");
    expect(toWinner.html).toContain("+$4.50");
    expect(toLoser.subject).toBe("Match settled — Outbox Game");
    expect(toLoser.html).toContain("-$5.00");
  });

  it("returns both stakes on a draw", async () => {
    const { bet, playerA } = await settledBet(BetOutcome.DRAW);

    await emailBetSettled(bet.id);
    await flushEmailOutbox();

    const body = fetchMock.mock.calls
      .map((call) => JSON.parse(call[1].body as string))
      .find((candidate) => candidate.to[0] === playerA.email);
    expect(body.subject).toBe("Match drawn — Outbox Game");
    expect(body.html).toContain("$5.00");
  });

  it("tells both players why a match was voided, once each", async () => {
    const { bet, playerA, playerB } = await settledBet(BetOutcome.DRAW);

    await emailBetVoided(bet.id, "No referee claimed the match in time.");
    await emailBetVoided(bet.id, "No referee claimed the match in time."); // retried worker

    const rows = await prisma.emailOutbox.findMany({
      where: { template: "bet.voided" },
      select: { userId: true },
    });
    expect(rows.map((row) => row.userId).sort()).toEqual([playerA.id, playerB.id].sort());
  });
});

describe("Email outbox: delivery failures", () => {
  it("keeps a failed email for retry without losing it", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => "upstream down" });
    const user = await makeUser();
    await queueEmail({
      template: "kyc.approved",
      dedupeKey: `test-retry-${user.id}`,
      userId: user.id,
      payload: { name: "Outbox Tester" },
    });

    const result = await flushEmailOutbox();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);

    const row = await prisma.emailOutbox.findUniqueOrThrow({
      where: { dedupeKey: `test-retry-${user.id}` },
    });
    expect(row.status).toBe(EmailOutboxStatus.PENDING);
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("502");
    // Backed off, so the next scan does not hammer a struggling provider.
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("gives up after the attempt limit instead of retrying forever", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const user = await makeUser();
    const dedupeKey = `test-exhaust-${user.id}`;
    await queueEmail({
      template: "kyc.approved",
      dedupeKey,
      userId: user.id,
      payload: { name: "Outbox Tester" },
    });
    // Jump to the final attempt rather than looping through every backoff.
    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { attempts: MAX_EMAIL_ATTEMPTS - 1 },
    });

    const result = await flushEmailOutbox();
    expect(result.exhausted).toBe(1);

    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { dedupeKey } });
    expect(row.status).toBe(EmailOutboxStatus.FAILED);
  });

  it("does not send an email for work that rolled back", async () => {
    const user = await makeUser();
    const dedupeKey = `test-rollback-${user.id}`;

    await expect(
      prisma.$transaction(async (tx) => {
        await queueEmail(
          {
            template: "wallet.deposit-succeeded",
            dedupeKey,
            userId: user.id,
            payload: { name: "Outbox Tester", amount: "$5.00", balance: "$5.00" },
          },
          tx as never,
        );
        throw new Error("settlement failed after queueing");
      }),
    ).rejects.toThrow("settlement failed");

    expect(await prisma.emailOutbox.findUnique({ where: { dedupeKey } })).toBeNull();
    await flushEmailOutbox();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
