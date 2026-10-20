// =============================================================================
// PlayStake — Referee conflicts of interest from social links
// =============================================================================
// The Referee Code of Conduct says a referee must never officiate a match
// involving anyone they know. On PlayStake, following each other counts as
// knowing each other, and so does a block (a falling-out is a conflict too).
// So a referee can't see or claim a match if a follow or a block, in either
// direction, links them to either player.
//
// While a referee is on a match, they and its players can't start following
// each other, so no link can be formed mid-match.
// =============================================================================

import { RefereeAssignmentStatus, type Prisma } from "../../../generated/prisma/client";
import { prisma, type TxClient } from "../db/client";
import { ConflictError } from "../errors";

/** From claim until the match is finished. */
const IN_PLAY_STATUSES = [
  RefereeAssignmentStatus.ASSIGNED,
  RefereeAssignmentStatus.READY,
  RefereeAssignmentStatus.IN_PROGRESS,
  RefereeAssignmentStatus.DECISION_SUBMITTED,
  RefereeAssignmentStatus.DISPUTED,
];

/** A player with no follow or block either way with this referee. */
function unlinkedTo(refereeUserId: string): Prisma.UserWhereInput {
  return {
    followers: { none: { followerId: refereeUserId } },
    following: { none: { streamerId: refereeUserId } },
    blocksMade: { none: { blockedId: refereeUserId } },
    blocksReceived: { none: { blockerId: refereeUserId } },
  };
}

/** Bet filter: neither player is linked to this referee. */
export function betWithoutRefereeLinks(refereeUserId: string): Prisma.BetWhereInput {
  return {
    playerA: unlinkedTo(refereeUserId),
    playerB: { is: unlinkedTo(refereeUserId) },
  };
}

/** True if a follow or block links these two users in either direction. */
export async function areSociallyLinked(a: string, b: string, db: TxClient | typeof prisma = prisma): Promise<boolean> {
  const [follow, block] = await Promise.all([
    db.streamerFollow.findFirst({
      where: {
        OR: [
          { followerId: a, streamerId: b },
          { followerId: b, streamerId: a },
        ],
      },
      select: { id: true },
    }),
    db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    }),
  ]);
  return follow !== null || block !== null;
}

/**
 * Refuse a new follow between a referee and a player in a match that referee
 * is officiating right now.
 */
export async function assertNoRefereeLinkDuringMatch(followerId: string, targetId: string): Promise<void> {
  const pairOnMatch = (refereeUserId: string, playerId: string): Prisma.RefereeAssignmentWhereInput => ({
    status: { in: IN_PLAY_STATUSES },
    refereeProfile: { userId: refereeUserId },
    bet: { OR: [{ playerAId: playerId }, { playerBId: playerId }] },
  });
  const active = await prisma.refereeAssignment.findFirst({
    where: { OR: [pairOnMatch(followerId, targetId), pairOnMatch(targetId, followerId)] },
    select: { id: true },
  });
  if (active) {
    throw new ConflictError("You're in a match together with them as referee. You can follow them after the match.");
  }
}
