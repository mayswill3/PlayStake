import {
  BetMatchType,
  BetStatus,
  RefereeAssignmentStatus,
} from "../../../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { ConflictError, ValidationError } from "@/lib/errors";
import { getStreamGameId } from "@/lib/lobby/games";
import type { StreamGameType } from "@/lib/games/catalogue";

/** Refereed-match states in which the players must stay live on the match's game. */
const MATCH_IN_PLAY_STATUSES = [
  RefereeAssignmentStatus.OPEN,
  RefereeAssignmentStatus.ASSIGNED,
  RefereeAssignmentStatus.READY,
  RefereeAssignmentStatus.IN_PROGRESS,
];

/**
 * Set (or clear, with `null`) the streamer's declared game — the game they're
 * live on, which viewers challenge them to. Clearing it takes them offline on
 * PlayStake (no new challenges); it can't end the Kick broadcast itself.
 *
 * Refused while the streamer is in a refereed match that hasn't started or
 * finished: a referee can only start when both players are live on the match's
 * game, so switching or clearing it mid-match would strand the match.
 */
export async function setDeclaredGame(userId: string, gameType: StreamGameType | null) {
  const account = await prisma.kickAccount.findUnique({
    where: { userId },
    select: { id: true, declaredGameId: true },
  });
  if (!account) {
    throw new ValidationError("Connect your Kick account before declaring a game");
  }

  const declaredGameId = gameType ? await getStreamGameId(gameType) : null;

  if (declaredGameId !== account.declaredGameId) {
    const activeMatch = await prisma.bet.findFirst({
      where: {
        matchType: BetMatchType.STREAM_VS_STREAM,
        status: BetStatus.MATCHED,
        OR: [{ playerAId: userId }, { playerBId: userId }],
        refereeAssignment: { status: { in: MATCH_IN_PLAY_STATUSES } },
      },
      select: { id: true },
    });
    if (activeMatch) {
      throw new ConflictError(
        "You're in a live match — finish it before changing or clearing your game",
      );
    }
  }

  const updated = await prisma.kickAccount.update({
    where: { id: account.id },
    data: { declaredGameId },
    select: { declaredGame: { select: { slug: true, name: true } } },
  });
  return updated.declaredGame;
}
