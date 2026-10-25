// =============================================================================
// PlayStake — Game rows behind the stream catalogue
// =============================================================================
// Each game players can be challenged to (src/lib/games/catalogue.ts) has a
// Game row in the database, which bets, fees and referee qualifications use.
// =============================================================================

import { prisma } from "@/lib/db/client";
import { STREAM_GAME_CATALOGUE, type StreamGameType } from "@/lib/games/catalogue";

/** Resolve the database Game row backing a stream game. */
export async function getStreamGameId(gameType: StreamGameType): Promise<string> {
  const meta = STREAM_GAME_CATALOGUE[gameType];
  const game = await prisma.game.findUnique({
    where: { slug: meta.slug },
    select: { id: true },
  });
  if (!game) {
    throw new Error(`Stream game '${gameType}' (slug '${meta.slug}') has not been provisioned`);
  }
  return game.id;
}
