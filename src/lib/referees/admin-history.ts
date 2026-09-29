import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Everything an admin needs to review a referee's handling of a match: the
 * match, the call (and any overturn), the decision notes, and the audit trail.
 * Audit IP hashes and user agents are deliberately left out.
 */
export const adminAssignmentInclude = {
  bet: {
    select: {
      id: true,
      amount: true,
      platformFeePercent: true,
      status: true,
      game: { select: { id: true, name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
    },
  },
  refereeProfile: {
    select: {
      id: true,
      user: {
        select: {
          id: true,
          displayName: true,
          kickAccount: { select: { channelSlug: true } },
        },
      },
    },
  },
  auditEvents: {
    select: {
      id: true,
      sequence: true,
      action: true,
      details: true,
      createdAt: true,
      actor: { select: { id: true, displayName: true } },
    },
    orderBy: { sequence: "asc" },
  },
} satisfies Prisma.RefereeAssignmentInclude;

export const ADMIN_HISTORY_LIMIT = 50;

/** A referee's most recent assignments, or null if the profile doesn't exist. */
export async function listRefereeHistoryForAdmin(refereeProfileId: string) {
  const profile = await prisma.refereeProfile.findUnique({
    where: { id: refereeProfileId },
    select: { id: true, status: true, user: { select: { displayName: true } } },
  });
  if (!profile) return null;

  const assignments = await prisma.refereeAssignment.findMany({
    where: { refereeProfileId },
    include: adminAssignmentInclude,
    orderBy: { createdAt: "desc" },
    take: ADMIN_HISTORY_LIMIT,
  });

  return {
    referee: {
      id: profile.id,
      displayName: profile.user.displayName,
      status: profile.status,
    },
    assignments,
  };
}

/** The referee assignment behind a bet, if it was refereed. */
export function getAssignmentForBetForAdmin(betId: string) {
  return prisma.refereeAssignment.findUnique({
    where: { betId },
    include: adminAssignmentInclude,
  });
}
