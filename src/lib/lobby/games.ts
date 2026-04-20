// =============================================================================
// PlayStake — Lobby Game Type Registry
// =============================================================================
// Maps lowercase gameType strings (used throughout demo/play routes and the
// lobby) to canonical demo Game row IDs in the database. Reuses the same slug
// convention as /api/demo/setup so a single Game row backs both flows.
// =============================================================================

import { prisma } from "@/lib/db/client";

export type LobbyGameType = "cards" | "tictactoe" | "darts";

export const LOBBY_GAME_TYPES: readonly LobbyGameType[] = [
  "cards",
  "tictactoe",
  "darts",
] as const;

export const LOBBY_GAME_META: Record<LobbyGameType, { slug: string; name: string }> = {
  cards: { slug: "higher-lower", name: "Higher / Lower" },
  tictactoe: { slug: "tic-tac-toe", name: "Tic-Tac-Toe" },
  darts: { slug: "darts-301", name: "Darts 301" },
};

export function isLobbyGameType(value: unknown): value is LobbyGameType {
  return typeof value === "string" && (LOBBY_GAME_TYPES as readonly string[]).includes(value);
}

/**
 * Resolve the Game.id for a given lobby gameType. The demo Game row is lazily
 * created by /api/demo/setup when a user first plays; by the time they reach
 * the lobby they'll have run setup, so this lookup should always hit.
 *
 * Throws a clear error if the game hasn't been provisioned yet so callers
 * surface a 400 rather than a cryptic FK violation.
 */
export async function getDemoGameId(gameType: LobbyGameType): Promise<string> {
  const meta = LOBBY_GAME_META[gameType];
  const game = await prisma.game.findUnique({
    where: { slug: meta.slug },
    select: { id: true },
  });
  if (!game) {
    throw new Error(
      `Demo game '${gameType}' (slug '${meta.slug}') not provisioned — run /api/demo/setup first`
    );
  }
  return game.id;
}
