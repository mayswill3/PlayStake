// =============================================================================
// PlayStake — Dartboard geometry and state shape
// =============================================================================
// Shared by the server (which scores every dart) and the canvas (which draws
// the board). Pure: no randomness here, so it is safe to bundle for the client.
// =============================================================================

export const BOARD_W = 900;
export const BOARD_H = 550;
export const BOARD_CX = 450;
export const BOARD_CY = 272;

export const R_BULLSEYE = 10;
export const R_BULL = 20;
export const R_TREBLE_IN = 115;
export const R_TREBLE_OUT = 130;
export const R_DOUBLE_IN = 190;
export const R_DOUBLE_OUT = 204;

/** Clockwise from the top: standard dartboard order. */
export const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const STARTING_SCORE = 301;
export const MAX_ROUNDS = 3;
export const DARTS_PER_TURN = 3;
/** Longest hold that still improves steadiness. */
export const MAX_HOLD_MS = 800;
/** How long the end of a turn stays on screen before play passes over. */
export const TURN_PAUSE_MS = 1400;

export interface DartThrow {
  segment: number;
  multiplier: 1 | 2 | 3;
  score: number;
  x: number;
  y: number;
}

export interface DartsState {
  scoreA: number;
  scoreB: number;
  currentTurn: "A" | "B";
  dartsThrown: number;
  turnStartScore: number;
  currentDarts: DartThrow[];
  lastTurnResult: { player: "A" | "B"; total: number; wasBust: boolean } | null;
  turnHistory: Array<{ player: "A" | "B"; total: number; wasBust: boolean; scoreAfter: number }>;
  phase: "aiming" | "throwing" | "showing" | "bust" | "finished";
  winner: "A" | "B" | null;
  message: string;
  roundFlash: { label: string; timeMs: number } | null;
  /** When a finished turn hands over to the other player (epoch ms). */
  advanceAt?: number | null;
}

export function hitTest(
  landX: number,
  landY: number,
): { segment: number; multiplier: 1 | 2 | 3; score: number } {
  const dx = landX - BOARD_CX;
  const dy = landY - BOARD_CY;
  const r = Math.sqrt(dx * dx + dy * dy);

  if (r < R_BULLSEYE) return { segment: 0, multiplier: 2, score: 50 };
  if (r < R_BULL) return { segment: 0, multiplier: 1, score: 25 };
  if (r > R_DOUBLE_OUT) return { segment: 0, multiplier: 1, score: 0 };

  // Angle clockwise from the top edge of segment 20. The canvas draws segment
  // i from -π/2 - half a segment, so 20 is centred on the top; this must match
  // it exactly or darts score in the neighbouring segment.
  const segAngle = (2 * Math.PI) / 20;
  const raw = Math.atan2(dy, dx);
  const normalized = (((raw + Math.PI / 2 + segAngle / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const segment = SEGMENTS[Math.floor(normalized / segAngle) % 20];

  let multiplier: 1 | 2 | 3 = 1;
  if (r >= R_TREBLE_IN && r < R_TREBLE_OUT) multiplier = 3;
  else if (r >= R_DOUBLE_IN && r < R_DOUBLE_OUT) multiplier = 2;

  return { segment, multiplier, score: segment * multiplier };
}

/** Standard deviation of a throw, in board pixels. Steadier and nearer the centre is tighter. */
export function throwSigma(aimX: number, aimY: number, holdMs: number): number {
  const steadiness = Math.min(Math.max(holdMs, 0), MAX_HOLD_MS) / MAX_HOLD_MS;
  const distFromCentre = Math.hypot(aimX - BOARD_CX, aimY - BOARD_CY);
  return (8 + (distFromCentre / R_DOUBLE_OUT) * 10) * (1 - steadiness * 0.7);
}
