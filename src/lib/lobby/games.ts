// =============================================================================
// PlayStake — Game rows behind the stream catalogue
// =============================================================================
// Each game players can be challenged to (src/lib/games/catalogue.ts) has a
// Game row in the database, which bets, fees and referee qualifications use.
// =============================================================================

import { prisma } from "@/lib/db/client";
import { ConflictError } from "@/lib/errors";
import { STREAM_GAME_CATALOGUE, type StreamGameType } from "@/lib/games/catalogue";

/**
 * Resolve the database Game row backing a stream game. A game switched off
 * (games.is_active = false) can't be declared or challenged, so staff can pull
 * one at once in an incident without a deploy.
 */
export async function getStreamGameId(gameType: StreamGameType): Promise<string> {
  const meta = STREAM_GAME_CATALOGUE[gameType];
  const game = await prisma.game.findUnique({
    where: { slug: meta.slug },
    select: { id: true, isActive: true },
  });
  if (!game) {
    throw new Error(`Stream game '${gameType}' (slug '${meta.slug}') has not been provisioned`);
  }
  if (!game.isActive) {
    throw new ConflictError(`${meta.name} matches are paused right now. Try again later.`);
  }
  return game.id;
}
