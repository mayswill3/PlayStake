// =============================================================================
// PlayStake — Six-monthly limit review (RTS 12)
// =============================================================================
// Every customer who has deposited is reminded at least every six months to
// look at their deposit limits: to check the ones they have, or to consider
// setting one if they haven't. The clock starts from the last time they dealt
// with limits — the first-deposit prompt, setting or changing a limit, or
// answering this reminder — so someone who adjusts their limits isn't nagged.
// =============================================================================

import { prisma } from "../db/client";

/** Six months, as a fixed interval so "due" never depends on month length. */
export const LIMIT_REVIEW_INTERVAL_MS = 182 * 24 * 60 * 60 * 1000;

export interface LimitReviewStatus {
  due: boolean;
  hasLimits: boolean;
  lastReviewedAt: Date | null;
}

export async function getLimitReviewStatus(
  userId: string,
  now: Date = new Date(),
): Promise<LimitReviewStatus> {
  const [settings, latestLimit, limitCount] = await Promise.all([
    prisma.responsiblePlaySettings.findUnique({
      where: { userId },
      select: { depositLimitPromptedAt: true, limitsReviewedAt: true },
    }),
    prisma.depositLimit.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.depositLimit.count({ where: { userId } }),
  ]);

  const times = [
    settings?.depositLimitPromptedAt,
    settings?.limitsReviewedAt,
    latestLimit?.updatedAt,
  ].filter((value): value is Date => value instanceof Date);

  // Nobody has been asked about limits yet: the first-deposit prompt comes
  // first, so there is nothing to review.
  if (times.length === 0) return { due: false, hasLimits: limitCount > 0, lastReviewedAt: null };

  const lastReviewedAt = new Date(Math.max(...times.map((time) => time.getTime())));
  return {
    due: now.getTime() - lastReviewedAt.getTime() >= LIMIT_REVIEW_INTERVAL_MS,
    hasLimits: limitCount > 0,
    lastReviewedAt,
  };
}

/** The customer answered the reminder, whichever way. */
export async function recordLimitReview(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.responsiblePlaySettings.upsert({
    where: { userId },
    create: { userId, limitsReviewedAt: now },
    update: { limitsReviewedAt: now },
  });
}
