'use client';

import { useRef, useEffect, useCallback } from 'react';

// ── Board geometry ──────────────────────────────────────────────────────────
const W = 900;
const H = 550;
const BOARD_CX = 450;
const BOARD_CY = 275;


const R_BULLSEYE  = 8;
const R_BULL      = 16;
const R_TREBLE_IN = 96;
const R_TREBLE_OUT = 108;
const R_DOUBLE_IN  = 158;
const R_DOUBLE_OUT = 170;
const R_NUMBERS    = 190;
const R_WIRE       = 175; // outer wire circle

// Clockwise from top: standard dartboard segment order
const SEGMENTS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

// Colour pairs [single, double/treble]
const SEG_COLORS: [string, string][] = [
  ['#1a1a1a', '#e8e0c8'], // black, cream  (0, 2, 4… even indices)
  ['#c8c8c8', '#1a1a1a'], // cream, black  (1, 3, 5… odd indices)
];
const RED   = '#cc2222';
const GREEN = '#226622';

// ── Types ────────────────────────────────────────────────────────────────────
export interface DartThrow {
  segment: number;
  multiplier: 1 | 2 | 3;
  score: number;
  x: number; // canvas coords
  y: number;
}

export interface DartsState {
  scoreA: number;
  scoreB: number;
  currentTurn: 'A' | 'B';
  dartsThrown: number;       // 0–2 within current turn
  turnStartScore: number;
  currentDarts: DartThrow[];
  lastTurnResult: { player: 'A' | 'B'; total: number; wasBust: boolean } | null;
  turnHistory: Array<{ player: 'A' | 'B'; total: number; wasBust: boolean; scoreAfter: number }>;
  phase: 'aiming' | 'throwing' | 'showing' | 'bust' | 'finished';
  winner: 'A' | 'B' | null;
  message: string;
}

interface Props {
  gs: DartsState;
  role: 'A' | 'B' | null;
  isMyTurn: boolean;
  onThrow: (landX: number, landY: number) => void;
  displayNameA?: string;
  displayNameB?: string;
}

// ── Hit test ─────────────────────────────────────────────────────────────────
export function hitTest(cx: number, cy: number, landX: number, landY: number): { segment: number; multiplier: 1 | 2 | 3; score: number } {
  const dx = landX - cx;
  const dy = landY - cy;
  const r = Math.sqrt(dx * dx + dy * dy);

  if (r < R_BULLSEYE) return { segment: 0, multiplier: 2, score: 50 };
  if (r < R_BULL)     return { segment: 0, multiplier: 1, score: 25 };
  if (r > R_DOUBLE_OUT) return { segment: 0, multiplier: 1, score: 0 }; // miss

  // Angle from top, clockwise
  const raw = Math.atan2(dy, dx); // -π to π, 0=right
  // Rotate so 0=top, offset by half-segment so segment 20 is centered at top
  const SEG_ANG = (2 * Math.PI) / 20;
  const normalized = ((raw + Math.PI / 2 - SEG_ANG / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const segIdx = Math.floor(normalized / SEG_ANG);
  const segment = SEGMENTS[segIdx % 20];

  let multiplier: 1 | 2 | 3 = 1;
  if (r >= R_TREBLE_IN && r < R_TREBLE_OUT) multiplier = 3;
  else if (r >= R_DOUBLE_IN && r < R_DOUBLE_OUT) multiplier = 2;

  return { segment, multiplier, score: segment * multiplier };
}

// ── Gaussian deviation (Box-Muller) ──────────────────────────────────────────
function gaussianRand(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function applyDeviation(crossX: number, crossY: number): { x: number; y: number } {
  const dx = crossX - BOARD_CX;
  const dy = crossY - BOARD_CY;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);
  const sigma = 14 + (distFromCenter / R_DOUBLE_OUT) * 14;
  return {
    x: crossX + gaussianRand() * sigma,
    y: crossY + gaussianRand() * sigma,
  };
}

// ── Canvas component ──────────────────────────────────────────────────────────
export function DartboardCanvas({ gs, role, isMyTurn, onThrow, displayNameA = 'Player A', displayNameB = 'Player B' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);

  // Swipe/drag state
  const dragRef = useRef<{ startX: number; startY: number; curX: number; curY: number; startMs: number } | null>(null);

  // Flight animation state
  const flightRef = useRef<{ fromX: number; fromY: number; toX: number; toY: number; progress: number; active: boolean } | null>(null);

  // Track previously animated dart count for opponent's darts
  const prevDartCountRef = useRef(0);

  // Last thrown dart — for the big score flash
  const lastScoreRef = useRef<{ score: number; segment: number; multiplier: number; timeMs: number } | null>(null);

  // ── Draw background (pub atmosphere) ───────────────────────────────────────
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Deep dark pub background
    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, W, H);

    // Warm overhead lamp glow at top-center
    const lampGrad = ctx.createRadialGradient(BOARD_CX, 0, 0, BOARD_CX, 0, 420);
    lampGrad.addColorStop(0, 'rgba(255, 200, 80, 0.13)');
    lampGrad.addColorStop(0.5, 'rgba(200, 140, 40, 0.06)');
    lampGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, W, H);

    // Wood panelling — horizontal planks on left and right of board area
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? 0 : 660;
      const panelW = side === 0 ? 170 : 240;
      // Base wood colour
      ctx.fillStyle = '#1c1108';
      ctx.fillRect(x, 0, panelW, H);
      // Plank lines
      for (let y = 0; y < H; y += 22) {
        ctx.strokeStyle = `rgba(${side === 0 ? '80,50,20' : '60,38,14'},0.35)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + panelW, y + (Math.sin(y * 0.3) * 2));
        ctx.stroke();
      }
      // Wood grain knot hints
      for (let k = 0; k < 3; k++) {
        const kx = x + panelW * (0.3 + k * 0.2);
        const ky = 80 + k * 150;
        const kg = ctx.createRadialGradient(kx, ky, 2, kx, ky, 18);
        kg.addColorStop(0, 'rgba(40,20,5,0.4)');
        kg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 18, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle smoke/haze layer across middle
    const hazeGrad = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.7);
    hazeGrad.addColorStop(0, 'rgba(180,170,160,0)');
    hazeGrad.addColorStop(0.5, 'rgba(180,170,160,0.025)');
    hazeGrad.addColorStop(1, 'rgba(180,170,160,0)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, 0, W, H);

    // Throw-line on floor
    ctx.strokeStyle = 'rgba(255,220,100,0.18)';
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(160, H - 20);
    ctx.lineTo(740, H - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pub spotlight halo around the board
    const haloGrad = ctx.createRadialGradient(BOARD_CX, BOARD_CY, R_DOUBLE_OUT, BOARD_CX, BOARD_CY, R_DOUBLE_OUT + 130);
    haloGrad.addColorStop(0, 'rgba(255,220,140,0.09)');
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, W, H);
  }, []);

  // ── Draw dartboard ──────────────────────────────────────────────────────────
  const drawBoard = useCallback((ctx: CanvasRenderingContext2D) => {
    const cx = BOARD_CX;
    const cy = BOARD_CY;
    const SEG_ANG = (2 * Math.PI) / 20;

    // ── 3D raised surround with drop shadow ────────────────────────────────
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(cx, cy, R_WIRE + 22, 0, Math.PI * 2);
    const surroundGrad = ctx.createRadialGradient(cx - 35, cy - 35, 8, cx, cy, R_WIRE + 22);
    surroundGrad.addColorStop(0,   '#2e2418');
    surroundGrad.addColorStop(0.5, '#141008');
    surroundGrad.addColorStop(1,   '#060403');
    ctx.fillStyle = surroundGrad;
    ctx.fill();
    ctx.restore();

    // ── Segment fills ──────────────────────────────────────────────────────
    for (let i = 0; i < 20; i++) {
      const startAng = -Math.PI / 2 - SEG_ANG / 2 + i * SEG_ANG;
      const endAng   = startAng + SEG_ANG;
      const colors   = SEG_COLORS[i % 2];
      const accent   = i % 2 === 0 ? RED : GREEN;

      // Inner single (bull → treble_in)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R_TREBLE_IN, startAng, endAng);
      ctx.closePath();
      ctx.fillStyle = colors[0];
      ctx.fill();

      // Treble ring
      ctx.beginPath();
      ctx.arc(cx, cy, R_TREBLE_IN, startAng, endAng);
      ctx.arc(cx, cy, R_TREBLE_OUT, endAng, startAng, true);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.fill();

      // Outer single (treble_out → double_in)
      ctx.beginPath();
      ctx.arc(cx, cy, R_TREBLE_OUT, startAng, endAng);
      ctx.arc(cx, cy, R_DOUBLE_IN,  endAng, startAng, true);
      ctx.closePath();
      ctx.fillStyle = colors[0];
      ctx.fill();

      // Double ring
      ctx.beginPath();
      ctx.arc(cx, cy, R_DOUBLE_IN,  startAng, endAng);
      ctx.arc(cx, cy, R_DOUBLE_OUT, endAng, startAng, true);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.fill();
    }

    // ── Sisal fibre texture (deterministic stipple on scoring areas) ───────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R_DOUBLE_OUT, 0, Math.PI * 2);
    ctx.clip();
    const step = 5;
    for (let tx = cx - R_DOUBLE_OUT; tx <= cx + R_DOUBLE_OUT; tx += step) {
      for (let ty = cy - R_DOUBLE_OUT; ty <= cy + R_DOUBLE_OUT; ty += step) {
        const r2 = (tx - cx) ** 2 + (ty - cy) ** 2;
        if (r2 > R_DOUBLE_OUT ** 2) continue;
        if (r2 < R_BULL ** 2)       continue;
        const r = Math.sqrt(r2);
        // Skip metallic scoring rings
        if (r >= R_TREBLE_IN  && r <= R_TREBLE_OUT) continue;
        if (r >= R_DOUBLE_IN  && r <= R_DOUBLE_OUT) continue;
        // Deterministic dot using sin hash of position
        const s = Math.sin(tx * 0.71 + ty * 1.33) * 0.5 + 0.5;
        if (s > 0.58) {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(tx, ty, 1, 1);
        }
      }
    }
    ctx.restore();

    // ── Bull (25) with radial gradient for convex look ─────────────────────
    const bullGrad = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, R_BULL);
    bullGrad.addColorStop(0,   '#3a9a3a');
    bullGrad.addColorStop(0.5, '#226622');
    bullGrad.addColorStop(1,   '#123812');
    ctx.beginPath();
    ctx.arc(cx, cy, R_BULL, 0, Math.PI * 2);
    ctx.fillStyle = bullGrad;
    ctx.fill();

    // ── Bullseye (50) with gradient and specular dot ───────────────────────
    const bullseyeGrad = ctx.createRadialGradient(cx - 2, cy - 2, 0.5, cx, cy, R_BULLSEYE);
    bullseyeGrad.addColorStop(0,   '#e83333');
    bullseyeGrad.addColorStop(0.6, '#cc2222');
    bullseyeGrad.addColorStop(1,   '#881111');
    ctx.beginPath();
    ctx.arc(cx, cy, R_BULLSEYE, 0, Math.PI * 2);
    ctx.fillStyle = bullseyeGrad;
    ctx.fill();
    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 2.5, 2.5, 1.5, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // ── Metallic wire lines (radial spokes) ────────────────────────────────
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 - SEG_ANG / 2 + i * SEG_ANG;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const perp = ang + Math.PI / 2;
      const pc = Math.cos(perp) * 0.4, ps = Math.sin(perp) * 0.4;
      const x1 = cx + cos * R_BULL, y1 = cy + sin * R_BULL;
      const x2 = cx + cos * R_DOUBLE_OUT, y2 = cy + sin * R_DOUBLE_OUT;

      // Shadow side
      ctx.strokeStyle = 'rgba(15,15,15,0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1 + pc, y1 + ps);
      ctx.lineTo(x2 + pc, y2 + ps);
      ctx.stroke();
      // Highlight side
      ctx.strokeStyle = 'rgba(200,200,180,0.75)';
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // ── Metallic ring wires ────────────────────────────────────────────────
    for (const r of [R_BULL, R_TREBLE_IN, R_TREBLE_OUT, R_DOUBLE_IN, R_DOUBLE_OUT]) {
      const thick = r === R_DOUBLE_OUT;
      // Shadow ring (slightly larger)
      ctx.strokeStyle = 'rgba(15,15,15,0.8)';
      ctx.lineWidth = thick ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
      ctx.stroke();
      // Highlight ring (slightly smaller)
      ctx.strokeStyle = 'rgba(210,210,185,0.82)';
      ctx.lineWidth = thick ? 1 : 0.65;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Number labels with depth shadow ───────────────────────────────────
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 + i * SEG_ANG;
      ctx.fillStyle = '#f0e8d0';
      ctx.fillText(String(SEGMENTS[i]),
        cx + Math.cos(ang) * R_NUMBERS,
        cy + Math.sin(ang) * R_NUMBERS);
    }
    ctx.restore();
  }, []);

  // ── Draw scoreboards ─────────────────────────────────────────────────────────
  const drawScoreboard = useCallback((ctx: CanvasRenderingContext2D, gs: DartsState, nameA: string, nameB: string, role: 'A' | 'B' | null) => {
    const drawPanel = (x: number, y: number, w: number, h: number, player: 'A' | 'B') => {
      const isActive = gs.currentTurn === player && gs.phase !== 'finished';
      const score = player === 'A' ? gs.scoreA : gs.scoreB;

      // Chalkboard backing
      const bg = ctx.createLinearGradient(x, y, x + w, y + h);
      bg.addColorStop(0, isActive ? '#1a2a1a' : '#141414');
      bg.addColorStop(1, isActive ? '#1e3318' : '#181818');
      ctx.fillStyle = bg;
      ctx.strokeStyle = isActive ? '#4a8a4a' : '#333';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Active indicator
      if (isActive) {
        ctx.fillStyle = '#5a9a5a';
        ctx.beginPath();
        ctx.arc(x + w - 12, y + 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player name
      const name = player === 'A' ? nameA : nameB;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = isActive ? '#90d090' : '#777';
      ctx.textAlign = 'center';
      ctx.fillText(name.length > 10 ? name.slice(0, 9) + '…' : name, x + w / 2, y + 16);

      // Big score
      ctx.font = `bold ${score >= 100 ? 40 : 46}px monospace`;
      ctx.fillStyle = isActive ? '#e8ffe8' : '#aaa';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(score), x + w / 2, y + h / 2 - 4);

      // Darts remaining this turn (only for current player)
      if (isActive) {
        const dartsLeft = 3 - gs.dartsThrown;
        ctx.font = '11px monospace';
        ctx.fillStyle = '#70b070';
        ctx.textAlign = 'center';
        ctx.fillText(`${dartsLeft} dart${dartsLeft !== 1 ? 's' : ''} left`, x + w / 2, y + h - 24);
      }

      // Last 3 turn scores from history
      const history = gs.turnHistory.filter(t => t.player === player).slice(-3).reverse();
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      let hy = y + h - (isActive ? 38 : 24);
      for (const t of history) {
        ctx.fillStyle = t.wasBust ? '#cc4444' : '#667766';
        ctx.fillText(t.wasBust ? 'BUST' : `-${t.total}`, x + w / 2, hy);
        hy -= 13;
      }
    };

    // Left panel (Player A), right panel (Player B)
    drawPanel(12, 160, 130, 140, 'A');
    drawPanel(W - 142, 160, 130, 140, 'B');

    // Current turn indicator — brighter when it's your turn, different label for opponent
    if (gs.phase !== 'finished') {
      const activeX   = gs.currentTurn === 'A' ? 77 : W - 77;
      const isMyTurnNow = gs.currentTurn === role;

      if (isMyTurnNow) {
        // Bright green pill: "YOUR TURN"
        const label = '▶  YOUR TURN';
        ctx.font = 'bold 11px sans-serif';
        const tw = ctx.measureText(label).width + 16;
        ctx.fillStyle = 'rgba(80,200,80,0.18)';
        ctx.beginPath();
        ctx.roundRect(activeX - tw / 2, 133, tw, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#88ff88';
        ctx.textAlign = 'center';
        ctx.fillText(label, activeX, 144);
      } else {
        // Muted amber label above opponent's panel
        const label = '● THROWING...';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = 'rgba(255,180,60,0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(label, activeX, 144);
      }
    }

    // Message banner (bust / round result)
    if (gs.message) {
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const isBust = gs.phase === 'bust' || gs.message.includes('BUST');
      ctx.fillStyle = isBust ? 'rgba(200,60,60,0.9)' : 'rgba(80,180,80,0.9)';
      const msgW = ctx.measureText(gs.message).width + 32;
      ctx.beginPath();
      ctx.roundRect(BOARD_CX - msgW / 2, H - 52, msgW, 32, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(gs.message, BOARD_CX, H - 36);
    }
  }, []);

  // ── Draw a realistic dart at a given position/angle (reused for landed + in-flight) ──
  const drawDartShape = useCallback((ctx: CanvasRenderingContext2D, tipX: number, tipY: number, angleDeg: number, scale = 1) => {
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.scale(scale, scale);

    // === Tip — tapered metallic cone ===
    const tipGrad = ctx.createLinearGradient(0, 0, -10, 0);
    tipGrad.addColorStop(0, '#f8f8f8');
    tipGrad.addColorStop(0.6, '#b8b8b8');
    tipGrad.addColorStop(1,   '#888');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-1.2, -0.7);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-1.2,  0.7);
    ctx.closePath();
    ctx.fillStyle = tipGrad;
    ctx.fill();

    // === Barrel — brass / tungsten cylindrical look ===
    const barrelGrad = ctx.createLinearGradient(0, -3.5, 0, 3.5);
    barrelGrad.addColorStop(0,    '#f0ead8');  // top specular
    barrelGrad.addColorStop(0.18, '#d4a84b');  // brass highlight
    barrelGrad.addColorStop(0.5,  '#7a5420');  // mid shadow
    barrelGrad.addColorStop(0.78, '#c89040');  // reflected light
    barrelGrad.addColorStop(1,    '#a07030');  // bottom

    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(-10,  2);
    ctx.lineTo(-30,  2.4);
    ctx.lineTo(-30, -2.4);
    ctx.closePath();
    ctx.fillStyle = barrelGrad;
    ctx.fill();

    // Specular highlight stripe along top
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10, -1.3);
    ctx.lineTo(-30, -1.6);
    ctx.strokeStyle = 'rgba(255,245,200,0.55)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();

    // Knurls — angled notches for grip texture
    for (let kx = -11.5; kx >= -28.5; kx -= 2.5) {
      ctx.strokeStyle = 'rgba(30,18,5,0.65)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(kx,       -2.2);
      ctx.lineTo(kx + 0.6,  2.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,225,140,0.28)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(kx + 0.8, -2.2);
      ctx.lineTo(kx + 1.3,  2.2);
      ctx.stroke();
    }

    // === Shaft — dark carbon fibre ===
    const shaftGrad = ctx.createLinearGradient(0, -1.5, 0, 1.5);
    shaftGrad.addColorStop(0,    '#3a3a4a');
    shaftGrad.addColorStop(0.45, '#1a1a28');
    shaftGrad.addColorStop(0.7,  '#0e0e18');
    shaftGrad.addColorStop(1,    '#2a2a3a');
    ctx.beginPath();
    ctx.moveTo(-30, -1.5);
    ctx.lineTo(-30,  1.5);
    ctx.lineTo(-40,  1.1);
    ctx.lineTo(-40, -1.1);
    ctx.closePath();
    ctx.fillStyle = shaftGrad;
    ctx.fill();
    // Carbon sheen
    ctx.strokeStyle = 'rgba(110,110,160,0.38)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-30, -0.7);
    ctx.lineTo(-40, -0.4);
    ctx.stroke();

    // === Flights — curved pear / teardrop shape ===
    const flightGradU = ctx.createLinearGradient(-55, -12, -40, 0);
    flightGradU.addColorStop(0,   'rgba(35,95,255,0.88)');
    flightGradU.addColorStop(0.55,'rgba(65,135,255,0.92)');
    flightGradU.addColorStop(1,   'rgba(90,165,255,0.72)');

    // Upper flight
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-49, -5, -55, -12);
    ctx.quadraticCurveTo(-50, -4, -44, -1);
    ctx.closePath();
    ctx.fillStyle = flightGradU;
    ctx.fill();
    // Upper vein
    ctx.strokeStyle = 'rgba(190,225,255,0.65)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-47.5, -3, -55, -12);
    ctx.stroke();

    const flightGradL = ctx.createLinearGradient(-55, 12, -40, 0);
    flightGradL.addColorStop(0,   'rgba(35,95,255,0.88)');
    flightGradL.addColorStop(0.55,'rgba(65,135,255,0.92)');
    flightGradL.addColorStop(1,   'rgba(90,165,255,0.72)');

    // Lower flight
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-49,  5, -55,  12);
    ctx.quadraticCurveTo(-50,  4, -44,   1);
    ctx.closePath();
    ctx.fillStyle = flightGradL;
    ctx.fill();
    // Lower vein
    ctx.strokeStyle = 'rgba(190,225,255,0.65)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-47.5, 3, -55, 12);
    ctx.stroke();

    ctx.restore();
  }, []);

  // ── Draw landed darts ───────────────────────────────────────────────────────
  const drawDarts = useCallback((ctx: CanvasRenderingContext2D, darts: DartThrow[]) => {
    for (const d of darts) {
      if (d.score === 0 && d.segment === 0) continue; // miss — skip visual on board

      // Drop shadow — gives the illusion the dart is embedded in the board
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;
      drawDartShape(ctx, d.x, d.y, -42);
      ctx.restore();

      // Score label
      if (d.score > 0) {
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = d.multiplier === 2 ? '#6cf' : d.multiplier === 3 ? '#fc6' : '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        const label = d.multiplier > 1 ? `${d.multiplier}×${d.segment}` : String(d.score);
        ctx.fillText(label, d.x + 20, d.y - 16);
        ctx.shadowBlur = 0;
      }
    }
  }, [drawDartShape]);

  // ── Draw in-flight dart ─────────────────────────────────────────────────────
  const drawFlight = useCallback((ctx: CanvasRenderingContext2D) => {
    const f = flightRef.current;
    if (!f || !f.active) return;

    const t = f.progress;
    // easeOutCubic
    const ease = 1 - Math.pow(1 - t, 3);
    const x = f.fromX + (f.toX - f.fromX) * ease;
    const y = f.fromY + (f.toY - f.fromY) * ease;

    // Angle of travel
    const dx = f.toX - f.fromX;
    const dy = f.toY - f.fromY;
    const travelAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Scale down as it approaches the board (perspective shrink)
    const scale = 1.2 - ease * 0.5;

    // Motion blur trail
    ctx.save();
    ctx.globalAlpha = 0.15;
    drawDartShape(ctx, x - dx * 0.04, y - dy * 0.04, travelAngle, scale * 0.9);
    ctx.globalAlpha = 1;
    ctx.restore();

    drawDartShape(ctx, x, y, travelAngle, scale);
  }, [drawDartShape]);

  // ── Draw aim guide (shown while dragging) ───────────────────────────────────
  // The cursor position IS the aim point. Dart sits at the press point, a dashed
  // line connects press → cursor, pulsing circle marks where it'll land.
  const drawAimGuide = useCallback((
    ctx: CanvasRenderingContext2D,
    drag: { startX: number; startY: number; curX: number; curY: number },
  ) => {
    const { startX, startY, curX, curY } = drag;

    // Dart stays at press point, angled toward where you're dragging
    const angleDeg = Math.atan2(curY - startY, curX - startX) * 180 / Math.PI;
    drawDartShape(ctx, startX, startY, angleDeg, 1.15);
  }, [drawDartShape]);

  // ── Draw big score flash when a dart lands ───────────────────────────────────
  const drawScoreFlash = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const ls = lastScoreRef.current;
    if (!ls) return;

    const age = (now - ls.timeMs) / 1000; // seconds
    if (age > 1.8) return;

    // Fade: full opacity for first 0.9s, then fade out
    const alpha = age < 0.9 ? 1 : 1 - (age - 0.9) / 0.9;
    // Pop-in scale: zoom from 0.4 → 1.05 → 1.0 in first 200ms
    const scale = age < 0.1 ? 0.4 + (age / 0.1) * 0.7
                : age < 0.2 ? 1.1 - (age - 0.1) / 0.1 * 0.1
                : 1.0;

    // Build label strings
    const isMiss     = ls.score === 0;
    const isBullseye = ls.segment === 0 && ls.multiplier === 2;
    const isBull     = ls.segment === 0 && ls.multiplier === 1;
    const typeLabel  = isMiss      ? ''
                     : isBullseye  ? 'BULLSEYE'
                     : isBull      ? 'BULL'
                     : ls.multiplier === 3 ? `TREBLE ${ls.segment}`
                     : ls.multiplier === 2 ? `DOUBLE ${ls.segment}`
                     : '';
    const scoreLabel = isMiss ? 'MISS' : String(ls.score);

    const scoreColor = isMiss      ? '#ff5555'
                     : isBullseye  ? '#ffcc00'
                     : isBull      ? '#66dd66'
                     : ls.multiplier > 1 ? '#66ccff'
                     : '#ffffff';

    const flashY = 62; // top of canvas above the board

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(BOARD_CX, flashY);
    ctx.scale(scale, scale);
    ctx.translate(-BOARD_CX, -flashY);

    // Glow backdrop
    ctx.shadowColor = scoreColor;
    ctx.shadowBlur  = 28;

    // Big score number
    ctx.font        = 'bold 68px sans-serif';
    ctx.fillStyle   = scoreColor;
    ctx.fillText(scoreLabel, BOARD_CX, flashY);

    // Smaller throw-type label above the number
    if (typeLabel) {
      ctx.shadowBlur  = 10;
      ctx.font        = 'bold 15px sans-serif';
      ctx.fillStyle   = 'rgba(255,255,255,0.75)';
      ctx.letterSpacing = '2px';
      ctx.fillText(typeLabel, BOARD_CX, flashY - 40);
    }

    ctx.restore();
  }, []);

  // ── Draw throw hint (idle, your turn) ────────────────────────────────────────
  const drawThrowHint = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Press & drag to aim — release to throw', W / 2, H - 18);
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (now: DOMHighResTimeStamp) => {
      // Time for pulse animations (frame-rate independent)
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = (now - startTimeRef.current) / 1000; // seconds

      // Advance flight animation
      const f = flightRef.current;
      if (f && f.active) {
        f.progress = Math.min(f.progress + 0.045, 1);
        if (f.progress >= 1) f.active = false;
      }

      drawBackground(ctx);
      drawBoard(ctx);
      drawScoreboard(ctx, gs, displayNameA, displayNameB, role);
      drawDarts(ctx, gs.currentDarts);
      if (f && f.active) drawFlight(ctx);
      drawScoreFlash(ctx, now);

      // Aim guide / throw hint (only when it's your turn and not in bust/showing)
      if (gs.phase !== 'showing' && gs.phase !== 'bust' && gs.phase !== 'finished') {
        if (dragRef.current) {
          drawAimGuide(ctx, dragRef.current);
        } else if (isMyTurn) {
          drawThrowHint(ctx);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [gs, isMyTurn, displayNameA, displayNameB, drawBackground, drawBoard, drawScoreboard, drawDarts, drawFlight, drawScoreFlash, drawAimGuide, drawThrowHint]);

  // ── Detect new opponent darts for flight animation ──────────────────────────
  useEffect(() => {
    const newCount = gs.currentDarts.length;
    const prev = prevDartCountRef.current;
    if (newCount > prev && !isMyTurn) {
      const dart = gs.currentDarts[newCount - 1];
      // Animate from off-screen left toward landing position
      flightRef.current = {
        fromX: BOARD_CX + (dart.x - BOARD_CX) * 2.5,
        fromY: BOARD_CY + (dart.y - BOARD_CY) * 2.5,
        toX: dart.x,
        toY: dart.y,
        progress: 0,
        active: true,
      };
    }
    prevDartCountRef.current = newCount;
  }, [gs.currentDarts, isMyTurn]);

  // ── Capture each new dart for the score flash ────────────────────────────────
  useEffect(() => {
    if (gs.currentDarts.length === 0) return;
    const dart = gs.currentDarts[gs.currentDarts.length - 1];
    lastScoreRef.current = {
      score: dart.score,
      segment: dart.segment,
      multiplier: dart.multiplier,
      timeMs: performance.now(),
    };
  }, [gs.currentDarts.length]);

  // ── Pointer helpers ───────────────────────────────────────────────────────────
  const toCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top)  * (H / rect.height),
    };
  }, []);

  // ── Pointer down — start aiming ───────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || gs.phase === 'finished' || gs.phase === 'showing' || gs.phase === 'bust') return;
    const pos = toCanvasCoords(e);
    if (!pos) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y, startMs: Date.now() };
  }, [isMyTurn, gs.phase, toCanvasCoords]);

  // ── Pointer move — update aim direction ──────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const pos = toCanvasCoords(e);
    if (!pos) return;
    dragRef.current.curX = pos.x;
    dragRef.current.curY = pos.y;
  }, [toCanvasCoords]);

  // ── Pointer up / leave — execute throw ───────────────────────────────────────
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;

    // Update final position
    const pos = toCanvasCoords(e);
    if (pos) { drag.curX = pos.x; drag.curY = pos.y; }

    const dx = drag.curX - drag.startX;
    const dy = drag.curY - drag.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Require minimum drag — short tap cancels
    if (dist < 15) return;

    // Aim point = where the cursor ended up
    const aimX = drag.curX;
    const aimY = drag.curY;

    // Deviation based on distance from board centre (harder to nail far shots)
    const dxB = aimX - BOARD_CX;
    const dyB = aimY - BOARD_CY;
    const distFromCenter = Math.sqrt(dxB * dxB + dyB * dyB);
    const sigma = 8 + (distFromCenter / R_DOUBLE_OUT) * 10;
    const landX = aimX + gaussianRand() * sigma;
    const landY = aimY + gaussianRand() * sigma;

    // Flight animation from press point to landing
    flightRef.current = {
      fromX: drag.startX,
      fromY: drag.startY,
      toX: landX,
      toY: landY,
      progress: 0,
      active: true,
    };

    setTimeout(() => onThrow(landX, landY), 380);
  }, [toCanvasCoords, onThrow]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="w-full rounded-lg"
      style={{
        cursor: isMyTurn && gs.phase === 'aiming' ? 'crosshair' : 'default',
        aspectRatio: `${W}/${H}`,
        touchAction: 'none', // prevent scroll interference on mobile
      }}
    />
  );
}
