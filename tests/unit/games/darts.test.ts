import { describe, it, expect, vi } from "vitest";

// With no deviation every dart lands exactly where it was aimed.
vi.mock("../../../src/lib/games/rng", () => ({ drawGaussian: () => 0 }));

import { advanceDarts, initialDarts, throwDart } from "../../../src/lib/games/darts";
import { BOARD_CX, BOARD_CY, hitTest, throwSigma } from "../../../src/lib/games/darts-board";
import type { DartsState } from "../../../src/lib/games/darts-board";

const TREBLE_20 = { x: BOARD_CX, y: BOARD_CY - 122 }; // 60
const BULLSEYE = { x: BOARD_CX, y: BOARD_CY }; // 50
const MISS = { x: 10, y: 10 }; // 0

function aimAt(state: DartsState, player: "A" | "B", spot: { x: number; y: number }, now = 0) {
  return throwDart(state, player, spot.x, spot.y, 800, now);
}

describe("darts rules", () => {
  it("scores the segment the canvas draws", () => {
    // Walk the board clockwise from the top, one segment centre at a time.
    const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    order.forEach((segment, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 20;
      const hit = hitTest(BOARD_CX + Math.cos(angle) * 60, BOARD_CY + Math.sin(angle) * 60);
      expect(hit.segment).toBe(segment);
    });
  });

  it("scores by the board", () => {
    expect(hitTest(TREBLE_20.x, TREBLE_20.y).score).toBe(60);
    expect(hitTest(BULLSEYE.x, BULLSEYE.y).score).toBe(50);
    expect(hitTest(MISS.x, MISS.y).score).toBe(0);
  });

  it("steadier throws deviate less", () => {
    expect(throwSigma(450, 272, 800)).toBeLessThan(throwSigma(450, 272, 0));
  });

  it("refuses a throw out of turn or during the pause", () => {
    const state = initialDarts();
    expect(() => aimAt(state, "B", MISS)).toThrow(/Not your turn/);
    let s = state;
    for (let i = 0; i < 3; i++) s = aimAt(s, "A", MISS).state;
    expect(s.phase).toBe("showing");
    expect(() => aimAt(s, "B", MISS, 100)).toThrow(/Not your turn|Wait/);
    // After the pause it is B's turn.
    const later = advanceDarts(s, s.advanceAt! + 1);
    expect(later.currentTurn).toBe("B");
    expect(later.dartsThrown).toBe(0);
  });

  it("a bust reverts the score to the start of the turn", () => {
    const state: DartsState = { ...initialDarts(), scoreA: 40, turnStartScore: 40 };
    const result = aimAt(state, "A", BULLSEYE);
    expect(result.state.phase).toBe("bust");
    expect(result.state.scoreA).toBe(40);
    expect(result.winner).toBeNull();
  });

  it("checking out on exactly zero wins at once", () => {
    const state: DartsState = { ...initialDarts(), scoreA: 50, turnStartScore: 50 };
    const result = aimAt(state, "A", BULLSEYE);
    expect(result.winner).toBe("A");
    expect(result.state.phase).toBe("finished");
  });

  it("after three rounds the lower score wins, equal scores draw", () => {
    const play = (aSpot: { x: number; y: number }, bSpot: { x: number; y: number }) => {
      let s = initialDarts();
      let now = 0;
      let winner: string | null = null;
      for (let round = 0; round < 3; round++) {
        for (const [player, spot] of [["A", aSpot], ["B", bSpot]] as const) {
          for (let d = 0; d < 3; d++) {
            const r = aimAt(s, player, spot, now);
            s = r.state;
            winner = r.winner;
          }
          if (s.advanceAt) {
            now = s.advanceAt;
            s = advanceDarts(s, now);
          }
        }
      }
      return { s, winner };
    };
    const single20 = { x: BOARD_CX, y: BOARD_CY - 60 };
    const aWins = play(single20, MISS);
    expect(aWins.winner).toBe("A");
    expect(aWins.s.scoreA).toBe(301 - 9 * 20);
    expect(aWins.s.scoreB).toBe(301);

    const draw = play(MISS, MISS);
    expect(draw.winner).toBe("draw");
    expect(draw.s.winner).toBeNull();
  });
});
