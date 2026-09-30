import { describe, it, expect } from "vitest";
import {
  matchViewerCount,
  pickFeaturedMatch,
  type SpectatorMatch,
  type SpectatorParticipant,
} from "../../../src/lib/matches/spectator.js";
import type { SpectatorPhase } from "../../../src/lib/matches/phase.js";

function participant(name: string, viewerCount: number | null): SpectatorParticipant {
  return {
    displayName: name,
    channelSlug: name.toLowerCase(),
    isLive: true,
    profilePicture: null,
    thumbnail: null,
    viewerCount,
  };
}

function match(
  betId: string,
  phase: SpectatorPhase,
  viewers: [number | null, number | null, number | null],
): SpectatorMatch {
  return {
    betId,
    gameName: "Darts",
    phase,
    potCents: 1000,
    playerA: participant(`${betId}-a`, viewers[0]),
    playerB: participant(`${betId}-b`, viewers[1]),
    referee: participant(`${betId}-ref`, viewers[2]),
    outcome: null,
    matchedAt: null,
  };
}

describe("matchViewerCount", () => {
  it("adds both players' streams and the referee cam", () => {
    expect(matchViewerCount(match("m", "LIVE", [120, 30, 5]))).toBe(155);
  });

  it("treats unknown counts as zero", () => {
    expect(matchViewerCount(match("m", "LIVE", [null, 30, null]))).toBe(30);
  });
});

describe("pickFeaturedMatch", () => {
  it("picks the live match with the most viewers", () => {
    const featured = pickFeaturedMatch([
      match("small", "LIVE", [10, 10, 0]),
      match("big", "LIVE", [200, 50, 20]),
      match("medium", "LIVE", [100, 0, 0]),
    ]);
    expect(featured?.betId).toBe("big");
  });

  it("ignores matches that aren't in progress, however many watch them", () => {
    const featured = pickFeaturedMatch([
      match("starting", "STARTING", [5000, 5000, 0]),
      match("review", "IN_REVIEW", [4000, 0, 0]),
      match("live", "LIVE", [3, 2, 1]),
    ]);
    expect(featured?.betId).toBe("live");
  });

  it("returns null when nothing is live", () => {
    expect(
      pickFeaturedMatch([
        match("starting", "STARTING", [50, 50, 0]),
        match("finding", "FINDING_REFEREE", [20, 0, 0]),
      ]),
    ).toBeNull();
    expect(pickFeaturedMatch([])).toBeNull();
  });

  it("still features a live match when Kick's viewer counts are unavailable", () => {
    expect(pickFeaturedMatch([match("live", "LIVE", [null, null, null])])?.betId).toBe("live");
  });
});
