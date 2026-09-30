// =============================================================================
// PlayStake — Darts rules (server)
// =============================================================================
// 301, three rounds of three darts each, Player A throws first.
//
//   - Each dart's score is taken off the thrower's total.
//   - Going below zero is a bust: the turn ends and the score goes back to
//     what it was at the start of that turn.
//   - Reaching exactly zero wins immediately.
//   - Otherwise, after three rounds each, the lower remaining score wins.
//     Equal scores are a draw and both stakes are returned (less no fee).
//
// The player chooses where to aim and how long to steady the throw. Where the
// dart actually lands is a random deviation from that aim, drawn here.
// =============================================================================

import {
  BOARD_H,
  BOARD_W,
  DARTS_PER_TURN,
  MAX_HOLD_MS,
  MAX_ROUNDS,
  STARTING_SCORE,
  TURN_PAUSE_MS,
  hitTest,
  throwSigma,
  type DartThrow,
  type DartsState,
} from "./darts-board";
import { drawGaussian } from "./rng";

export function initialDarts(): DartsState {
  return {
    scoreA: STARTING_SCORE,
    scoreB: STARTING_SCORE,
    currentTurn: "A",
    dartsThrown: 0,
    turnStartScore: STARTING_SCORE,
    currentDarts: [],
    lastTurnResult: null,
    turnHistory: [],
    phase: "aiming",
    winner: null,
    message: "",
    roundFlash: null,
    advanceAt: null,
  };
}

const turnsTaken = (state: DartsState, player: "A" | "B") =>
  state.turnHistory.filter((turn) => turn.player === player).length;

/** Hand over to the other player once the end-of-turn pause has elapsed. */
export function advanceDarts(state: DartsState, now: number): DartsState {
  if ((state.phase !== "showing" && state.phase !== "bust") || !state.advanceAt || now < state.advanceAt) {
    return state;
  }
  const nextTurn = state.currentTurn === "A" ? "B" : "A";
  const turnsA = turnsTaken(state, "A");
  const newRound = turnsA === turnsTaken(state, "B");
  return {
    ...state,
    currentTurn: nextTurn,
    dartsThrown: 0,
    turnStartScore: nextTurn === "A" ? state.scoreA : state.scoreB,
    currentDarts: [],
    phase: "aiming",
    message: "",
    roundFlash: newRound ? { label: `ROUND ${turnsA + 1}`, timeMs: state.advanceAt } : state.roundFlash,
    advanceAt: null,
  };
}

export interface ThrowResult {
  state: DartsState;
  dart: DartThrow;
  aim: { x: number; y: number; holdMs: number; sigma: number };
  winner: "A" | "B" | "draw" | null;
}

function lowerScoreWins(scoreA: number, scoreB: number): "A" | "B" | "draw" {
  return scoreA < scoreB ? "A" : scoreB < scoreA ? "B" : "draw";
}

export function throwDart(
  before: DartsState,
  player: "A" | "B",
  aimXIn: number,
  aimYIn: number,
  holdMsIn: number,
  now: number,
): ThrowResult {
  const state = advanceDarts(before, now);
  if (state.phase === "finished") throw new Error("The match is over");
  if (state.currentTurn !== player) throw new Error("Not your turn");
  if (state.phase !== "aiming") throw new Error("Wait for the next turn");

  // The aim and hold are the player's skill input; clamp them to the board.
  const aimX = Math.min(Math.max(aimXIn, 0), BOARD_W);
  const aimY = Math.min(Math.max(aimYIn, 0), BOARD_H);
  const holdMs = Math.min(Math.max(holdMsIn, 0), MAX_HOLD_MS);
  const sigma = throwSigma(aimX, aimY, holdMs);
  const x = aimX + drawGaussian() * sigma;
  const y = aimY + drawGaussian() * sigma;
  const hit = hitTest(x, y);
  const dart: DartThrow = { ...hit, x, y };

  const scoreKey = player === "A" ? "scoreA" : "scoreB";
  const newScore = state[scoreKey] - hit.score;
  const dartsThrown = state.dartsThrown + 1;
  const currentDarts = [...state.currentDarts, dart];
  const aim = { x: aimX, y: aimY, holdMs, sigma };

  if (newScore === 0) {
    const result = { player, total: state.turnStartScore, wasBust: false };
    return {
      state: {
        ...state,
        [scoreKey]: 0,
        currentDarts,
        dartsThrown,
        lastTurnResult: result,
        turnHistory: [...state.turnHistory, { ...result, scoreAfter: 0 }],
        phase: "finished",
        winner: player,
        message: "Checked out!",
        advanceAt: null,
      },
      dart,
      aim,
      winner: player,
    };
  }

  const bust = newScore < 0;
  if (!bust && dartsThrown < DARTS_PER_TURN) {
    return {
      state: { ...state, [scoreKey]: newScore, currentDarts, dartsThrown, message: "" },
      dart,
      aim,
      winner: null,
    };
  }

  // The turn is over, by bust or by third dart.
  const scoreAfter = bust ? state.turnStartScore : newScore;
  const result = { player, total: bust ? hit.score : state.turnStartScore - newScore, wasBust: bust };
  const ended: DartsState = {
    ...state,
    [scoreKey]: scoreAfter,
    currentDarts,
    dartsThrown,
    lastTurnResult: result,
    turnHistory: [...state.turnHistory, { ...result, scoreAfter }],
    phase: bust ? "bust" : "showing",
    message: bust ? "BUST! Score reverted." : `Turn: −${result.total}`,
    advanceAt: now + TURN_PAUSE_MS,
  };

  if (turnsTaken(ended, "A") >= MAX_ROUNDS && turnsTaken(ended, "B") >= MAX_ROUNDS) {
    const winner = lowerScoreWins(ended.scoreA, ended.scoreB);
    return {
      state: {
        ...ended,
        phase: "finished",
        winner: winner === "draw" ? null : winner,
        message: winner === "draw" ? "It's a draw — equal scores." : "Lowest score wins.",
        advanceAt: null,
      },
      dart,
      aim,
      winner,
    };
  }

  return { state: ended, dart, aim, winner: null };
}
