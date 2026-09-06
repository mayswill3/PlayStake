import {
  RefereeAssignmentStatus,
  RefereeProfileStatus,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

export interface RefereeCapacity {
  approved: number;
  available: number;
  suspended: number;
  pendingApplications: number;
  /** Assignments nobody has claimed yet. */
  unclaimed: number;
  /** Age of the longest-waiting unclaimed assignment, in seconds. */
  oldestUnclaimedSeconds: number | null;
  /** Claimed but not yet decided. */
  inProgress: number;
  /** Median seconds from assignment created to claimed, over the window. */
  medianClaimSeconds: number | null;
  /** Assignments that went unclaimed and were cancelled, over the window. */
  expiredUnclaimed: number;
  windowDays: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * Whether there are enough referees on hand to cover demand.
 *
 * Unclaimed depth and time-to-claim are the numbers that actually predict a
 * shortfall: headcount can look healthy while nobody is marked available.
 */
export async function getRefereeCapacity(
  windowDays = 7,
  now: Date = new Date(),
): Promise<RefereeCapacity> {
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const [
    approved,
    available,
    suspended,
    pendingApplications,
    unclaimed,
    oldestUnclaimed,
    inProgress,
    claimedInWindow,
    expiredUnclaimed,
  ] = await Promise.all([
    prisma.refereeProfile.count({
      where: { status: RefereeProfileStatus.APPROVED },
    }),
    prisma.refereeProfile.count({
      where: { status: RefereeProfileStatus.APPROVED, isAvailable: true },
    }),
    prisma.refereeProfile.count({
      where: { status: RefereeProfileStatus.SUSPENDED },
    }),
    prisma.refereeProfile.count({
      where: { status: RefereeProfileStatus.PENDING },
    }),
    prisma.refereeAssignment.count({
      where: { status: RefereeAssignmentStatus.OPEN },
    }),
    prisma.refereeAssignment.findFirst({
      where: { status: RefereeAssignmentStatus.OPEN },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.refereeAssignment.count({
      where: {
        status: {
          in: [
            RefereeAssignmentStatus.ASSIGNED,
            RefereeAssignmentStatus.READY,
            RefereeAssignmentStatus.IN_PROGRESS,
          ],
        },
      },
    }),
    prisma.refereeAssignment.findMany({
      where: { claimedAt: { not: null, gte: windowStart } },
      select: { createdAt: true, claimedAt: true },
    }),
    prisma.refereeAssignment.count({
      where: {
        status: RefereeAssignmentStatus.CANCELLED,
        claimedAt: null,
        cancelledAt: { gte: windowStart },
      },
    }),
  ]);

  const claimSeconds = claimedInWindow.map((assignment) =>
    Math.max(
      0,
      Math.round(
        (assignment.claimedAt!.getTime() - assignment.createdAt.getTime()) / 1000,
      ),
    ),
  );

  return {
    approved,
    available,
    suspended,
    pendingApplications,
    unclaimed,
    oldestUnclaimedSeconds: oldestUnclaimed
      ? Math.round((now.getTime() - oldestUnclaimed.createdAt.getTime()) / 1000)
      : null,
    inProgress,
    medianClaimSeconds: median(claimSeconds),
    expiredUnclaimed,
    windowDays,
  };
}

// ---------------------------------------------------------------------------
// Per-referee quality
// ---------------------------------------------------------------------------

export interface RefereePerformance {
  refereeProfileId: string;
  userId: string;
  displayName: string;
  status: string;
  isAvailable: boolean;
  matchesHandled: number;
  decisionsSubmitted: number;
  overturned: number;
  /** Overturned / decisionsSubmitted, or null below the sample threshold. */
  overturnRate: number | null;
  /** Median seconds from claiming a match to submitting a decision. */
  medianDecisionSeconds: number | null;
}

/**
 * Minimum decisions before an overturn rate is reported. Below this a single
 * reversal reads as a catastrophic percentage and invites bad calls about
 * someone's competence.
 */
export const MIN_DECISIONS_FOR_RATE = 5;

export async function getRefereePerformance(): Promise<RefereePerformance[]> {
  const profiles = await prisma.refereeProfile.findMany({
    select: {
      id: true,
      userId: true,
      status: true,
      isAvailable: true,
      matchesHandled: true,
      user: { select: { displayName: true } },
      assignments: {
        where: { decisionSubmittedAt: { not: null } },
        select: {
          claimedAt: true,
          decisionSubmittedAt: true,
          overturnedAt: true,
        },
      },
    },
    orderBy: { matchesHandled: "desc" },
  });

  return profiles.map((profile) => {
    const decisions = profile.assignments;
    const overturned = decisions.filter(
      (assignment) => assignment.overturnedAt !== null,
    ).length;

    const decisionSeconds = decisions
      .filter((assignment) => assignment.claimedAt !== null)
      .map((assignment) =>
        Math.max(
          0,
          Math.round(
            (assignment.decisionSubmittedAt!.getTime() -
              assignment.claimedAt!.getTime()) / 1000,
          ),
        ),
      );

    return {
      refereeProfileId: profile.id,
      userId: profile.userId,
      displayName: profile.user.displayName,
      status: profile.status,
      isAvailable: profile.isAvailable,
      matchesHandled: profile.matchesHandled,
      decisionsSubmitted: decisions.length,
      overturned,
      overturnRate:
        decisions.length >= MIN_DECISIONS_FOR_RATE
          ? Math.round((overturned / decisions.length) * 1000) / 1000
          : null,
      medianDecisionSeconds: median(decisionSeconds),
    };
  });
}
