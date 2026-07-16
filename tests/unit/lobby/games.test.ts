// =============================================================================
// Unit Tests: Lobby game-type resolution
// =============================================================================
// Pure functions — no database. Covers the slug <-> gameType mapping that backs
// "declared game" resolution for streamer challenges.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  isLobbyGameType,
  lobbyGameTypeForSlug,
  LOBBY_GAME_META,
  LOBBY_GAME_TYPES,
} from "../../../src/lib/lobby/games.js";

describe("lobbyGameTypeForSlug", () => {
  it("resolves each lobby game's slug back to its gameType", () => {
    for (const gameType of LOBBY_GAME_TYPES) {
      const slug = LOBBY_GAME_META[gameType].slug;
      expect(lobbyGameTypeForSlug(slug)).toBe(gameType);
    }
  });

  it("maps the known demo slugs", () => {
    expect(lobbyGameTypeForSlug("higher-lower")).toBe("cards");
    expect(lobbyGameTypeForSlug("tic-tac-toe")).toBe("tictactoe");
    expect(lobbyGameTypeForSlug("darts-301")).toBe("darts");
  });

  it("returns null for a slug that isn't a challengeable lobby game", () => {
    expect(lobbyGameTypeForSlug("fps-scoreboard")).toBeNull();
    expect(lobbyGameTypeForSlug("does-not-exist")).toBeNull();
    expect(lobbyGameTypeForSlug("")).toBeNull();
  });

  it("is the inverse of isLobbyGameType for valid types", () => {
    const gt = lobbyGameTypeForSlug("darts-301");
    expect(gt).not.toBeNull();
    expect(isLobbyGameType(gt)).toBe(true);
  });
});
