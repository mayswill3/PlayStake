// =============================================================================
// PlayStake — Game randomness
// =============================================================================
// Every random outcome in a real-money game is drawn here, on the server, from
// Node's CSPRNG. Nothing a client sends can choose or predict a draw.
// Math.random must never be used for a game outcome.
// =============================================================================

import { randomInt } from "node:crypto";

const UNIT_STEPS = 2 ** 48;

/** Uniform float in (0, 1). Never exactly 0, so it is safe to take a log of. */
export function drawUnit(): number {
  return (randomInt(UNIT_STEPS - 1) + 1) / UNIT_STEPS;
}

/** Standard normal draw (Box–Muller). */
export function drawGaussian(): number {
  return Math.sqrt(-2 * Math.log(drawUnit())) * Math.cos(2 * Math.PI * drawUnit());
}
