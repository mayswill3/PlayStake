// ═══════════════════════════════════════════════════════════════════════
// Bullseye Pool — Physics Engine
// Only 2 balls: cue ball + 1 object ball. Elastic collision, cushion
// bounce, friction, pocket detection.
// ═══════════════════════════════════════════════════════════════════════

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
}

export interface Pocket { x: number; y: number; radius: number }

// ── Table dimensions ───────────────────────────────────────────────
export const TABLE_W = 880;
export const TABLE_H = 440;
export const CUSHION = 28;
export const RAIL = 12;
export const BORDER = CUSHION + RAIL;          // 40
export const CANVAS_W = TABLE_W + BORDER * 2;  // 960
export const CANVAS_H = TABLE_H + BORDER * 2;  // 520
export const BALL_R = 14;
export const FRICTION = 0.985;
export const MIN_V = 0.12;
export const WIN_SCORE = 21;
export const SHOTS_PER_TURN = 3;

// Kitchen line (headstring) — 25% from left
export const KITCHEN_X = TABLE_W * 0.25;

// Bullseye ring radii (from table centre)
export const BULL_INNER = 30;
export const BULL_MID = 70;
export const BULL_OUTER = 120;

// ── Pockets ────────────────────────────────────────────────────────
const CR = 22;  // corner pocket radius
const MR = 17;  // mid pocket radius

export const POCKETS: Pocket[] = [
  { x: 0,           y: 0,           radius: CR },
  { x: TABLE_W / 2, y: -4,          radius: MR },
  { x: TABLE_W,     y: 0,           radius: CR },
  { x: 0,           y: TABLE_H,     radius: CR },
  { x: TABLE_W / 2, y: TABLE_H + 4, radius: MR },
  { x: TABLE_W,     y: TABLE_H,     radius: CR },
];

// ── 6 preset object ball positions (cycle each shot) ───────────────
export const OBJ_POSITIONS: Array<{ x: number; y: number }> = [
  { x: TABLE_W * 0.25, y: TABLE_H * 0.20 },  // top-left near rail
  { x: TABLE_W * 0.75, y: TABLE_H * 0.20 },  // top-right near rail
  { x: TABLE_W * 0.30, y: TABLE_H * 0.50 },  // centre-left
  { x: TABLE_W * 0.70, y: TABLE_H * 0.50 },  // centre-right
  { x: TABLE_W * 0.22, y: TABLE_H * 0.80 },  // bottom-left near corner
  { x: TABLE_W * 0.78, y: TABLE_H * 0.80 },  // bottom-right near corner
];

// ── Physics step ───────────────────────────────────────────────────

export function stepPhysics(cue: Ball, obj: Ball): void {
  const balls = [cue, obj].filter(b => !b.pocketed);

  // Move
  for (const b of balls) {
    b.x += b.vx;
    b.y += b.vy;
  }

  // Ball-ball collision (at most 1 pair)
  if (!cue.pocketed && !obj.pocketed) {
    collideBalls(cue, obj);
  }

  // Cushion + pocket
  for (const b of balls) {
    if (checkPocket(b)) {
      b.pocketed = true;
      b.vx = 0;
      b.vy = 0;
    } else {
      bounceCushion(b);
    }
  }

  // Friction
  for (const b of balls) {
    if (!b.pocketed) {
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      if (Math.abs(b.vx) < MIN_V) b.vx = 0;
      if (Math.abs(b.vy) < MIN_V) b.vy = 0;
    }
  }
}

function collideBalls(a: Ball, b: Ball): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minD = BALL_R * 2;
  if (dist >= minD || dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minD - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const dot = dvx * nx + dvy * ny;
  if (dot <= 0) return;

  const damp = 0.96;
  a.vx -= dot * nx * damp;
  a.vy -= dot * ny * damp;
  b.vx += dot * nx * damp;
  b.vy += dot * ny * damp;
}

function bounceCushion(b: Ball): void {
  if (b.x - BALL_R < 0)       { b.x = BALL_R;            b.vx = -b.vx * 0.8; }
  if (b.x + BALL_R > TABLE_W) { b.x = TABLE_W - BALL_R;  b.vx = -b.vx * 0.8; }
  if (b.y - BALL_R < 0)       { b.y = BALL_R;            b.vy = -b.vy * 0.8; }
  if (b.y + BALL_R > TABLE_H) { b.y = TABLE_H - BALL_R;  b.vy = -b.vy * 0.8; }
}

function checkPocket(b: Ball): boolean {
  for (const p of POCKETS) {
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < p.radius) return true;
  }
  return false;
}

export function isMoving(cue: Ball, obj: Ball): boolean {
  const moving = (b: Ball) => !b.pocketed && (Math.abs(b.vx) > MIN_V || Math.abs(b.vy) > MIN_V);
  return moving(cue) || moving(obj);
}

// ── Bullseye scoring ───────────────────────────────────────────────

export type BullRing = 'inner' | 'mid' | 'outer' | 'none';

export function scoreBullseye(cue: Ball): { points: number; ring: BullRing } {
  const cx = TABLE_W / 2;
  const cy = TABLE_H / 2;
  const dx = cue.x - cx;
  const dy = cue.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= BULL_INNER) return { points: 5, ring: 'inner' };
  if (dist <= BULL_MID)   return { points: 3, ring: 'mid' };
  if (dist <= BULL_OUTER) return { points: 1, ring: 'outer' };
  return { points: 0, ring: 'none' };
}

// ── Game state for sync ────────────────────────────────────────────

export interface PoolGameState {
  scoreA: number;
  scoreB: number;
  turn: 'A' | 'B';
  shotIndex: number;            // 0-based within current turn (0,1,2)
  globalShotIndex: number;      // absolute shot # for obj ball position cycling
  phase: 'place' | 'aim' | 'moving' | 'scored' | 'finished';
  cueBall: { x: number; y: number; pocketed: boolean };
  objBall: { x: number; y: number; pocketed: boolean };
  message: string;
  lastRing: BullRing | null;
  lastPoints: number;
  winner: 'A' | 'B' | null;
}
