// =============================================================================
// PlayStake — Demo match access checks
// =============================================================================
// The demo routes used to take player identity from the request body. That
// let any logged-in user name themselves as a player, pick a winner, and then
// settle someone else's escrowed bet with that outcome. Identity now comes
// from the session cookie only, and these helpers answer the one question
// every demo route has to ask: is the caller actually one of the two players?
// =============================================================================

import { AuthorizationError } from "../errors";

export interface Participants {
  playerAId: string;
  playerBId: string | null;
}

export function isParticipant(userId: string, match: Participants): boolean {
  return match.playerAId === userId || match.playerBId === userId;
}

export function assertParticipant(
  userId: string,
  match: Participants,
  what = "this match",
): void {
  if (!isParticipant(userId, match)) {
    throw new AuthorizationError(`You are not a player in ${what}`);
  }
}

/** Which side the caller is on, or null if they are not in the match. */
export function sideOf(userId: string, match: Participants): "A" | "B" | null {
  if (match.playerAId === userId) return "A";
  if (match.playerBId === userId) return "B";
  return null;
}

/**
 * The same two people, side for side. A game session may only settle the bet
 * it mirrors, so a session forged with a different pair — or with one side
 * missing — must never be accepted as evidence of that bet's outcome.
 */
export function sameParticipants(a: Participants, b: Participants): boolean {
  return (
    a.playerBId !== null &&
    b.playerBId !== null &&
    a.playerAId === b.playerAId &&
    a.playerBId === b.playerBId
  );
}
