// =============================================================================
// Unit Tests: stream game catalogue
// =============================================================================
// Pure functions — no database. Covers the slug <-> gameType mapping that backs
// "declared game" resolution for streamer challenges.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  isRefereedStreamGame,
  isStreamGameType,
  streamGameTypeForSlug,
  STREAM_GAME_CATALOGUE,
  STREAM_GAME_TYPES,
} from "../../../src/lib/games/catalogue.js";
import { GAME_GUIDES } from "../../../src/lib/games/guides.js";

describe("stream game catalogue", () => {
  it("offers EA SPORTS FC 27 and Tekken 8 only", () => {
    expect([...STREAM_GAME_TYPES].sort()).toEqual(["ea-sports-fc-27", "tekken-8"]);
  });

  it("round-trips every supported stream game slug", () => {
    for (const gameType of STREAM_GAME_TYPES) {
      expect(streamGameTypeForSlug(STREAM_GAME_CATALOGUE[gameType].slug)).toBe(gameType);
      expect(isStreamGameType(gameType)).toBe(true);
    }
  });

  it("refuses withdrawn games", () => {
    for (const slug of ["darts-301", "tic-tac-toe", "higher-lower", "ea-sports-fc-26", "fortnite"]) {
      expect(streamGameTypeForSlug(slug)).toBeNull();
      expect(isStreamGameType(slug)).toBe(false);
    }
  });

  it("referees every game", () => {
    for (const gameType of STREAM_GAME_TYPES) {
      expect(isRefereedStreamGame(gameType)).toBe(true);
    }
  });

  it("has a guide page for every game", () => {
    expect(GAME_GUIDES.map((guide) => guide.gameType).sort()).toEqual([...STREAM_GAME_TYPES].sort());
  });
});
