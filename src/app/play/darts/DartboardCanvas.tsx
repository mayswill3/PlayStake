'use client';

import { useRef, useEffect, useCallback } from 'react';

// ── Board geometry ──────────────────────────────────────────────────────────
const W = 900;
const H = 550;
const BOARD_CX = 450;
const BOARD_CY = 272;

// All radii scaled up ~1.2× for a larger, more imposing board
const R_BULLSEYE  = 10;
const R_BULL      = 20;
const R_TREBLE_IN = 115;
const R_TREBLE_OUT = 130;
const R_DOUBLE_IN  = 190;
const R_DOUBLE_OUT = 204;
const R_WIRE       = 210; // outer wire / scoring boundary
const R_NUMBERS    = 228; // number labels sit in the dark surround
const R_SURROUND   = 242; // outer edge of the dark number surround

// Clockwise from top: standard dartboard segment order
const SEGMENTS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

// Realistic sisal colours: warm cream / dark black
const SEG_COLORS: [string, string][] = [
  ['#171717', '#ddd4b8'], // dark black, warm cream  (even segments)
  ['#ddd4b8', '#171717'], // warm cream, dark black  (odd segments)
];
const RED   = '#b81a1a';
const GREEN = '#1a6622';

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
  roundFlash: { label: string; timeMs: number } | null;
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

  // Load display font for score flash — falls back to Impact if unavailable
  useEffect(() => {
    try {
      new FontFace('DartsDisplay', 'url(https://fonts.gstatic.com/s/bebasneuepro/v3/Block-body.woff2)')
        .load().then(f => document.fonts.add(f)).catch(() => {});
    } catch { /* ignore in SSR or restricted contexts */ }
  }, []);

  // Swipe/drag state
  const dragRef = useRef<{ startX: number; startY: number; curX: number; curY: number; startMs: number } | null>(null);

  // Flight animation state
  const flightRef = useRef<{ fromX: number; fromY: number; toX: number; toY: number; progress: number; active: boolean } | null>(null);

  // Track previously animated dart count for opponent's darts
  const prevDartCountRef = useRef(0);

  // Last thrown dart — for the big score flash
  const lastScoreRef = useRef<{ score: number; segment: number; multiplier: number; timeMs: number } | null>(null);

  // Near-miss flag — set in handlePointerUp, read in drawScoreFlash
  const nearMissRef = useRef(false);

  // ── Draw background (cork wall with spotlight) ──────────────────────────────
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Base cork/wall colour — warm tan
    ctx.fillStyle = '#9e7e58';
    ctx.fillRect(0, 0, W, H);

    // Cork texture — subtle overlapping ellipses for a natural grain feel
    for (let i = 0; i < 320; i++) {
      const s = Math.sin(i * 127.1 + 3.1) * 0.5 + 0.5;
      const t = Math.sin(i * 311.7 + 1.9) * 0.5 + 0.5;
      const cx2 = s * W;
      const cy2 = t * H;
      const rx = 6 + s * 18;
      const ry = 3 + t * 8;
      const angle = s * Math.PI;
      const alpha = 0.03 + s * 0.04;
      const lighter = s > 0.6;
      ctx.fillStyle = lighter ? `rgba(200,170,120,${alpha})` : `rgba(60,35,10,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, rx, ry, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead spotlight — bright central circle fading to dark edges
    const spotlight = ctx.createRadialGradient(
      BOARD_CX, BOARD_CY - 30, 20,
      BOARD_CX, BOARD_CY, 480
    );
    spotlight.addColorStop(0,    'rgba(255,240,200,0.38)');
    spotlight.addColorStop(0.35, 'rgba(220,180,100,0.12)');
    spotlight.addColorStop(0.65, 'rgba(0,0,0,0.28)');
    spotlight.addColorStop(1,    'rgba(0,0,0,0.72)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, W, H);

    // Thin wooden frame/ledge at top
    const woodGrad = ctx.createLinearGradient(0, 0, 0, 28);
    woodGrad.addColorStop(0, '#3d2208');
    woodGrad.addColorStop(1, '#5c3510');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 22, W, 3);

    // Subtle wall texture vertical lines
    for (let x = 0; x < W; x += 60) {
      const v = (Math.sin(x * 0.31) * 0.5 + 0.5);
      ctx.strokeStyle = `rgba(${v > 0.5 ? '200,160,100' : '50,28,8'},${0.04 + v * 0.03})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }, []);

  // ── Draw dartboard ──────────────────────────────────────────────────────────
  const drawBoard = useCallback((ctx: CanvasRenderingContext2D) => {
    const cx = BOARD_CX;
    const cy = BOARD_CY;
    const SEG_ANG = (2 * Math.PI) / 20;

    // ── Ambient occlusion — soft shadow halo on wall around the mounted board ─
    // Offset slightly lower-right (light from upper-left), fades out over ~65px
    const aoGrad = ctx.createRadialGradient(cx + 8, cy + 14, R_SURROUND - 6, cx + 8, cy + 14, R_SURROUND + 68);
    aoGrad.addColorStop(0,    'rgba(0,0,0,0.82)');
    aoGrad.addColorStop(0.28, 'rgba(0,0,0,0.50)');
    aoGrad.addColorStop(0.58, 'rgba(0,0,0,0.18)');
    aoGrad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = aoGrad;
    ctx.beginPath();
    ctx.arc(cx + 8, cy + 14, R_SURROUND + 68, 0, Math.PI * 2);
    ctx.fill();

    // ── Deep drop shadow behind the whole board ───────────────────────────
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.90)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, R_SURROUND, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // ── Outer cabinet / dark surround (R_WIRE → R_SURROUND) ───────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R_SURROUND, 0, Math.PI * 2);
    const cabinetGrad = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, R_SURROUND);
    cabinetGrad.addColorStop(0,   '#201610');
    cabinetGrad.addColorStop(0.6, '#0c0906');
    cabinetGrad.addColorStop(1,   '#020201');
    ctx.fillStyle = cabinetGrad;
    ctx.fill();
    ctx.restore();

    // ── 3D rim bevel — disc mounted on wall, lit from upper-left ─────────
    ctx.save();
    ctx.lineCap = 'round';
    // Shadow side (lower-right arc ~55% of circumference)
    ctx.strokeStyle = 'rgba(0,0,0,0.82)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, R_SURROUND - 4, -Math.PI * 0.1, Math.PI * 1.1);
    ctx.stroke();
    // Highlight side (upper-left arc ~45% of circumference)
    ctx.strokeStyle = 'rgba(90,65,32,0.52)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R_SURROUND - 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Bright specular at top (~12 o'clock)
    ctx.strokeStyle = 'rgba(145,110,55,0.42)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R_SURROUND - 4, -Math.PI * 0.38, -Math.PI * 0.08);
    ctx.stroke();
    // Inner wire-edge catch-light (thin bright ring just inside the playing area)
    ctx.strokeStyle = 'rgba(180,160,100,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R_WIRE + 3, 0, Math.PI * 2);
    ctx.stroke();
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

    // ── Concave board surface shading ─────────────────────────────────────
    // Brighter top-left, darker outer edge — simulates a shallow dish shape
    const concaveGrad = ctx.createRadialGradient(
      cx + 22, cy - 22, 10,
      cx, cy, R_DOUBLE_OUT
    );
    concaveGrad.addColorStop(0,   'rgba(255,255,255,0.055)');
    concaveGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    concaveGrad.addColorStop(1,   'rgba(0,0,0,0.17)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R_DOUBLE_OUT, 0, Math.PI * 2);
    ctx.fillStyle = concaveGrad;
    ctx.fill();
    ctx.restore();

    // ── Sisal fibre texture (directional strokes on scoring areas) ────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R_DOUBLE_OUT, 0, Math.PI * 2);
    ctx.clip();
    const step = 7;
    for (let tx = cx - R_DOUBLE_OUT; tx <= cx + R_DOUBLE_OUT; tx += step) {
      for (let ty = cy - R_DOUBLE_OUT; ty <= cy + R_DOUBLE_OUT; ty += step) {
        const r2 = (tx - cx) ** 2 + (ty - cy) ** 2;
        if (r2 > R_DOUBLE_OUT ** 2) continue;
        if (r2 < R_BULL ** 2)       continue;
        const r = Math.sqrt(r2);
        // Skip metallic scoring rings
        if (r >= R_TREBLE_IN  && r <= R_TREBLE_OUT) continue;
        if (r >= R_DOUBLE_IN  && r <= R_DOUBLE_OUT) continue;
        // Deterministic hash — same pattern every frame
        const s = Math.sin(tx * 0.71 + ty * 1.33) * 0.5 + 0.5;
        if (s > 0.58) {
          // Short angled stroke — reads as compressed sisal fibre
          const fAngle = Math.atan2(ty - cy, tx - cx) + (s - 0.5) * 0.6;
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(fAngle);
          ctx.strokeStyle = 'rgba(0,0,0,0.11)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(-1.5, 0);
          ctx.lineTo(1.5, 0);
          ctx.stroke();
          ctx.restore();
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

    // ── Number labels — white, bold, in the dark surround ─────────────────
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 5;
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 + i * SEG_ANG;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(SEGMENTS[i]),
        cx + Math.cos(ang) * R_NUMBERS,
        cy + Math.sin(ang) * R_NUMBERS);
    }
    ctx.restore();
  }, []);

  // ── Draw scoreboards ─────────────────────────────────────────────────────────
  const drawScoreboard = useCallback((ctx: CanvasRenderingContext2D, gs: DartsState, nameA: string, nameB: string, role: 'A' | 'B' | null, elapsed: number) => {
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

    // Round counter — centered between panels
    const turnsA = gs.turnHistory.filter(t => t.player === 'A').length;
    const turnsB = gs.turnHistory.filter(t => t.player === 'B').length;
    const completedRounds = Math.min(turnsA, turnsB);
    const currentRound = Math.min(completedRounds + 1, 3);
    const roundLabel = gs.phase === 'finished' ? 'FINAL' : `ROUND ${currentRound} / 3`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = gs.phase === 'finished' ? 'rgba(255,200,80,0.8)' : 'rgba(180,180,180,0.5)';
    ctx.fillText(roundLabel, W / 2, 230);

    // Gap indicator — who's leading and by how much
    const gap = Math.abs(gs.scoreA - gs.scoreB);
    if (gap > 0 && (turnsA > 0 || turnsB > 0) && gs.phase !== 'finished') {
      const leader = gs.scoreA < gs.scoreB ? nameA : nameB;
      const isLastRound = currentRound === 3;
      const gapAlpha = isLastRound ? 0.7 + Math.sin(elapsed * 3) * 0.3 : 0.55;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = `rgba(251,191,36,${gapAlpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(`${leader.length > 8 ? leader.slice(0, 7) + '…' : leader} \u2212${gap}`, W / 2, 247);
    }

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

    // Message banner (bust / round result / game over)
    const displayMessage = (() => {
      if (gs.phase === 'finished') {
        if (gs.winner === null) return "It's a draw! 🤝";
        if (gs.winner === role)  return 'You win! 🎯';
        return 'You lose! 😔';
      }
      return gs.message;
    })();

    if (displayMessage) {
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const isBust = gs.phase === 'bust' || displayMessage.includes('BUST');
      const isLoss = gs.phase === 'finished' && gs.winner !== role && gs.winner !== null;
      ctx.fillStyle = isBust || isLoss ? 'rgba(200,60,60,0.9)' : 'rgba(80,180,80,0.9)';
      const msgW = ctx.measureText(displayMessage).width + 32;
      ctx.beginPath();
      ctx.roundRect(BOARD_CX - msgW / 2, H - 52, msgW, 32, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(displayMessage, BOARD_CX, H - 36);
    }
  }, []);

  // ── Draw a realistic dart at a given position/angle (reused for landed + in-flight) ──
  // Anatomy (tip at origin, dart extends in -X direction):
  //   Tip   : 0 → -16   (hardened steel needle, shallow taper)
  //   Barrel: -16 → -58  (tungsten cylinder, cross-hatch knurls, 3D shading)
  //   Shaft : -58 → -76  (red nylon, thin cylinder)
  //   Flights: -76 → -92 (standard teardrop, ±15px spread + edge-on third flight)
  const drawDartShape = useCallback((ctx: CanvasRenderingContext2D, tipX: number, tipY: number, angleDeg: number, scale = 1) => {
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.scale(scale, scale);

    // ── TIP — hardened steel needle ──
    // Gradient runs PERPENDICULAR to dart axis (Y direction) = 3D cylinder illusion
    const tipCyl = ctx.createLinearGradient(0, -2, 0, 2);
    tipCyl.addColorStop(0,    '#777');
    tipCyl.addColorStop(0.3,  '#d8d8d8');
    tipCyl.addColorStop(0.5,  '#f8f8f8');
    tipCyl.addColorStop(0.72, '#c0c0c0');
    tipCyl.addColorStop(1,    '#666');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-3, -0.5);
    ctx.lineTo(-16, -1.0);
    ctx.lineTo(-16,  1.0);
    ctx.lineTo(-3,  0.5);
    ctx.closePath();
    ctx.fillStyle = tipCyl;
    ctx.fill();
    // Specular glint along top edge of needle
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(-1, -0.2);
    ctx.lineTo(-15, -0.55);
    ctx.stroke();
    // Tip–barrel shoulder ring
    ctx.strokeStyle = 'rgba(80,80,80,0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-16, -1.0);
    ctx.lineTo(-16,  1.0);
    ctx.stroke();

    // ── BARREL — tungsten 80% (dark silver-gray cylinder) ──
    // Slightly wider toward the back (ergonomic taper), radius 2.0 → 3.4
    const bFront = -16, bBack = -58;
    const bRF = 2.0, bRB = 3.4;
    // Perpendicular gradient = lit from above → strong 3D cylinder look
    const barrelCyl = ctx.createLinearGradient(0, -bRB, 0, bRB);
    barrelCyl.addColorStop(0,    '#181820');  // far edge shadow
    barrelCyl.addColorStop(0.18, '#50505e');  // mid shadow
    barrelCyl.addColorStop(0.38, '#90909e');  // lit zone
    barrelCyl.addColorStop(0.5,  '#c8c8d8');  // top specular
    barrelCyl.addColorStop(0.62, '#88889a');  // past highlight
    barrelCyl.addColorStop(0.8,  '#3a3a48');  // lower shadow
    barrelCyl.addColorStop(1,    '#141420');  // far edge shadow
    ctx.beginPath();
    ctx.moveTo(bFront, -bRF);
    ctx.lineTo(bBack,  -bRB);
    ctx.lineTo(bBack,   bRB);
    ctx.lineTo(bFront,  bRF);
    ctx.closePath();
    ctx.fillStyle = barrelCyl;
    ctx.fill();

    // Cross-hatch knurl texture clipped to barrel
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bFront, -bRB - 0.5);
    ctx.lineTo(bBack,  -bRB - 0.5);
    ctx.lineTo(bBack,   bRB + 0.5);
    ctx.lineTo(bFront,  bRB + 0.5);
    ctx.closePath();
    ctx.clip();
    const kStep = 3.2;
    // Forward diagonals (\)
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 0.55;
    for (let kx = bFront + 1; kx >= bBack - 8; kx -= kStep) {
      ctx.beginPath();
      ctx.moveTo(kx,      -bRB - 1);
      ctx.lineTo(kx - 5,   bRB + 1);
      ctx.stroke();
    }
    // Back diagonals (/)
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let kx = bFront + 1; kx >= bBack - 8; kx -= kStep) {
      ctx.beginPath();
      ctx.moveTo(kx,       bRB + 1);
      ctx.lineTo(kx - 5,  -bRB - 1);
      ctx.stroke();
    }
    // Glint highlights on ridge intersections
    ctx.strokeStyle = 'rgba(200,210,255,0.22)';
    ctx.lineWidth = 0.4;
    for (let kx = bFront - 0.5; kx >= bBack; kx -= kStep) {
      ctx.beginPath();
      ctx.moveTo(kx,       -bRB * 0.4);
      ctx.lineTo(kx - 1.5, -bRB * 0.2);
      ctx.stroke();
    }
    ctx.restore();

    // Smooth grip bands at each end of barrel (ring grooves)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.9;
    for (const rx of [bFront + 5, bBack + 4]) {
      ctx.beginPath();
      const rr = rx === bFront + 5 ? bRF + (bRB - bRF) * 0.12 : bRB - 0.3;
      ctx.moveTo(rx, -rr);
      ctx.lineTo(rx,  rr);
      ctx.stroke();
    }

    // ── SHAFT — red nylon (thin cylinder) ──
    const sStart = bBack, sEnd = -76;
    const sRB = bRB, sRE = 1.5;
    const shaftCyl = ctx.createLinearGradient(0, -sRB, 0, sRB);
    shaftCyl.addColorStop(0,    '#5a0000');
    shaftCyl.addColorStop(0.3,  '#bb1111');
    shaftCyl.addColorStop(0.5,  '#ee3333');
    shaftCyl.addColorStop(0.68, '#bb1111');
    shaftCyl.addColorStop(1,    '#440000');
    ctx.beginPath();
    ctx.moveTo(sStart, -sRB);
    ctx.lineTo(sStart,  sRB);
    ctx.lineTo(sEnd,    sRE);
    ctx.lineTo(sEnd,   -sRE);
    ctx.closePath();
    ctx.fillStyle = shaftCyl;
    ctx.fill();
    // Specular stripe on shaft
    ctx.strokeStyle = 'rgba(255,160,160,0.32)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sStart - 1, -sRB * 0.45);
    ctx.lineTo(sEnd   + 1, -sRE * 0.3);
    ctx.stroke();

    // ── FLIGHTS — standard teardrop/pear (two visible + one edge-on) ──
    const fBase = sEnd; // -76
    const fLen  = 18;   // how far back flights extend
    const fW    = 15;   // max lateral spread

    // Helper: draw one teardrop flight petal
    const drawFlightPetal = (sign: number) => {
      // sign = -1 (upper) or +1 (lower)
      ctx.beginPath();
      ctx.moveTo(fBase, 0);
      // Narrow at base, widens out, then rounds into teardrop bulge
      ctx.bezierCurveTo(
        fBase - fLen * 0.18, sign *  2,
        fBase - fLen * 0.45, sign * (fW * 0.95),
        fBase - fLen * 0.62, sign * fW
      );
      ctx.bezierCurveTo(
        fBase - fLen * 0.82, sign * (fW * 0.88),
        fBase - fLen * 0.96, sign * (fW * 0.48),
        fBase - fLen,        sign *  sRE * 0.8
      );
      ctx.lineTo(fBase - fLen, 0);
      ctx.closePath();

      const fg = ctx.createLinearGradient(fBase - fLen * 0.5, sign * fW, fBase, 0);
      fg.addColorStop(0,   sign < 0 ? 'rgba(30,80,220,0.95)' : 'rgba(25,70,200,0.92)');
      fg.addColorStop(0.45,'rgba(60,120,255,0.92)');
      fg.addColorStop(0.78,'rgba(80,150,255,0.85)');
      fg.addColorStop(1,   'rgba(50,100,220,0.6)');
      ctx.fillStyle = fg;
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'rgba(10,30,130,0.55)';
      ctx.lineWidth = 0.4;
      ctx.stroke();

      // Central vein
      ctx.strokeStyle = 'rgba(180,210,255,0.6)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(fBase - 1, sign * sRE * 0.3);
      ctx.quadraticCurveTo(
        fBase - fLen * 0.5, sign * fW * 0.62,
        fBase - fLen + 1,   sign * sRE * 0.5
      );
      ctx.stroke();

      // Surface sheen on petal
      ctx.strokeStyle = sign < 0 ? 'rgba(140,190,255,0.28)' : 'rgba(100,160,255,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(fBase - fLen * 0.28, sign * fW * 0.42);
      ctx.quadraticCurveTo(
        fBase - fLen * 0.5,  sign * fW * 0.76,
        fBase - fLen * 0.75, sign * fW * 0.65
      );
      ctx.stroke();
    };

    drawFlightPetal(-1); // upper
    drawFlightPetal(1);  // lower

    // Third flight edge-on (perpendicular) — thin ellipse with gradient
    ctx.save();
    const edgeGrad = ctx.createLinearGradient(fBase - fLen, 0, fBase, 0);
    edgeGrad.addColorStop(0,   'rgba(25,70,200,0.8)');
    edgeGrad.addColorStop(0.5, 'rgba(80,150,255,0.9)');
    edgeGrad.addColorStop(1,   'rgba(40,90,210,0.5)');
    ctx.beginPath();
    ctx.ellipse(fBase - fLen * 0.5, 0, fLen * 0.5, 1.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = edgeGrad;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }, []);

  // ── Draw landed darts ───────────────────────────────────────────────────────
  const drawDarts = useCallback((ctx: CanvasRenderingContext2D, darts: DartThrow[]) => {
    for (const d of darts) {
      if (d.score === 0 && d.segment === 0) continue; // miss — skip visual on board

      // Pre-pass: elongated barrel contact shadow drawn manually on the board surface.
      // The dart is at -42°; the barrel extends ~42px in direction (cos(138°), sin(138°)).
      // Shallow angle like a real throw (~20°), with small deterministic variation per dart
      // so multiple darts in the same turn don't look identical.
      const dartDeg = -20 + ((Math.abs(d.x * 7 + d.y * 13) % 12) - 6); // ±6° variation
      const dartAngleRad = (dartDeg * Math.PI) / 180;

      // Contact shadow — elongated ellipse along the barrel axis
      const barrelDirX = Math.cos(dartAngleRad + Math.PI);
      const barrelDirY = Math.sin(dartAngleRad + Math.PI);
      // Contact shadow scaled to match dart scale (0.38 × 26px barrel midpoint ≈ 10px)
      const shadowMidX = d.x + barrelDirX * 10 + 3;
      const shadowMidY = d.y + barrelDirY * 10 + 5;
      ctx.save();
      ctx.translate(shadowMidX, shadowMidY);
      ctx.rotate(dartAngleRad);
      ctx.scale(1.8, 0.45);
      const contactGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
      contactGrad.addColorStop(0,   'rgba(0,0,0,0.55)');
      contactGrad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
      contactGrad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = contactGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pass 1: directional canvas shadow (light from upper-left → lower-right)
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.78)';
      ctx.shadowBlur    = 10;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 6;
      drawDartShape(ctx, d.x, d.y, dartDeg, 0.38);
      ctx.restore();

      // Pass 2: crisp dart on top
      drawDartShape(ctx, d.x, d.y, dartDeg, 0.38);

      // Entry hole — dark radial gradient where tip punctures the sisal
      const holeGrad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 5);
      holeGrad.addColorStop(0,   'rgba(0,0,0,0.80)');
      holeGrad.addColorStop(0.45,'rgba(0,0,0,0.42)');
      holeGrad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Score label — offset perpendicular to dart (above the barrel)
      if (d.score > 0) {
        const perpX = -Math.sin(dartAngleRad) * 14;
        const perpY =  Math.cos(dartAngleRad) * 14;
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = d.multiplier === 2 ? '#6cf' : d.multiplier === 3 ? '#fc6' : '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        const label = d.multiplier > 1 ? `${d.multiplier}×${d.segment}` : String(d.score);
        ctx.fillText(label, d.x + barrelDirX * 8 + perpX, d.y + barrelDirY * 8 + perpY);
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
  // Hold longer → steadiness ring shrinks → wobble amplitude decreases → tighter scatter
  const drawAimGuide = useCallback((
    ctx: CanvasRenderingContext2D,
    drag: { startX: number; startY: number; curX: number; curY: number; startMs: number },
    elapsed: number,
  ) => {
    const { startX, startY, curX, curY, startMs } = drag;

    // Steadiness: 0 = just pressed, 1 = fully steady (800ms hold)
    const holdMs = Math.min(Date.now() - startMs, 800);
    const steadiness = holdMs / 800;

    // Wobble — two overlapping sine waves at different frequencies
    const wobbleAmp = 18 * (1 - steadiness);
    const wobbleX = Math.sin(elapsed * 3.1 + 0.4) * wobbleAmp;
    const wobbleY = Math.cos(elapsed * 2.3 + 1.1) * wobbleAmp;
    const aimX = curX + wobbleX;
    const aimY = curY + wobbleY;

    // Dart at press point angled toward cursor (unchanged visual)
    const angleDeg = Math.atan2(curY - startY, curX - startX) * 180 / Math.PI;
    drawDartShape(ctx, startX, startY, angleDeg, 1.15);

    ctx.save();

    // Steadiness ring: dashed circle that shrinks as you hold (28px → 6px)
    const ringR = 6 + (1 - steadiness) * 22;
    const ringAlpha = 0.3 + steadiness * 0.35;
    ctx.strokeStyle = `rgba(255,255,255,${ringAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(aimX, aimY, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Projected landing dot: pulsing crosshair at the wobbled aim point
    const pulse = 0.6 + Math.sin(elapsed * 8) * 0.4;
    ctx.globalAlpha = pulse * 0.85;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(aimX, aimY, 5, 0, Math.PI * 2);
    ctx.stroke();
    // Corner ticks
    ctx.lineWidth = 0.8;
    for (const [tdx, tdy] of [[-12,-12],[12,12],[-12,12],[12,-12]] as const) {
      ctx.beginPath();
      ctx.moveTo(aimX + tdx * 0.3, aimY + tdy * 0.3);
      ctx.lineTo(aimX + tdx, aimY + tdy);
      ctx.stroke();
    }

    ctx.restore();
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
    ctx.font        = 'bold 68px DartsDisplay, Impact, sans-serif';
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

    // Near-miss: landed just outside a double or treble ring
    if (nearMissRef.current && ls.multiplier === 1 && !isMiss) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255,200,80,0.6)';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(255,200,80,0.9)';
      ctx.letterSpacing = '1px';
      ctx.fillText('SO CLOSE', BOARD_CX, flashY + 34);
    }

    ctx.restore();
  }, []);

  // ── Draw round announcement banner ───────────────────────────────────────────
  const drawRoundFlash = useCallback((ctx: CanvasRenderingContext2D, gs: DartsState, _now: number) => {
    if (!gs.roundFlash) return;
    // Use Date.now() so both clients share the same wall-clock reference
    const age = Math.max(0, Date.now() - gs.roundFlash.timeMs);
    if (age > 2000) return;
    const scale = Math.min(Math.max(age < 200 ? 0.85 + (age / 200) * 0.15 : 1, 0.1), 2);
    const opacity = Math.min(Math.max(age > 1600 ? 1 - (age - 1600) / 400 : 1, 0), 1);
    const isFinal = gs.roundFlash.label.includes('3');

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(BOARD_CX, H / 2);
    ctx.scale(scale, scale);

    // Dark pill backdrop
    const pillW = isFinal ? 320 : 260;
    const pillH = isFinal ? 88 : 70;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 12);
    ctx.fill();

    // Gold border
    ctx.strokeStyle = `rgba(255,200,80,0.7)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Main label
    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = '#ffc850';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gs.roundFlash.label, 0, isFinal ? -14 : 0);

    // Sub-label for final round
    if (isFinal) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = 'rgba(255,200,80,0.75)';
      ctx.fillText('FINAL ROUND', 0, 22);
    }

    ctx.restore();
  }, []);

  // ── Draw throw hint (idle, your turn) ────────────────────────────────────────
  const drawThrowHint = useCallback((ctx: CanvasRenderingContext2D) => {
    const text = '🎯  Press & drag to aim — release to throw';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark pill background for contrast
    const tw = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2, H - 28, tw, 22, 6);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(text, W / 2, H - 17);
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
      drawScoreboard(ctx, gs, displayNameA, displayNameB, role, elapsed);
      drawDarts(ctx, gs.currentDarts);
      if (f && f.active) drawFlight(ctx);
      drawScoreFlash(ctx, now);
      drawRoundFlash(ctx, gs, now);

      // Aim guide / throw hint (only when it's your turn and not in bust/showing)
      if (gs.phase !== 'showing' && gs.phase !== 'bust' && gs.phase !== 'finished') {
        if (dragRef.current) {
          drawAimGuide(ctx, dragRef.current, elapsed);
        } else if (isMyTurn) {
          drawThrowHint(ctx);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [gs, isMyTurn, displayNameA, displayNameB, drawBackground, drawBoard, drawScoreboard, drawDarts, drawFlight, drawScoreFlash, drawRoundFlash, drawAimGuide, drawThrowHint]);

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

    // Steadiness: how long the player held before releasing (capped at 800ms)
    const holdMs = Math.min(Date.now() - drag.startMs, 800);
    const steadiness = holdMs / 800; // 0 = instant tap, 1 = fully steady

    // Wobble offset at the moment of release — matches what was shown on screen
    const t = startTimeRef.current !== null ? (performance.now() - startTimeRef.current) / 1000 : 0;
    const wobbleAmp = 18 * (1 - steadiness);
    const curX = drag.curX + Math.sin(t * 3.1 + 0.4) * wobbleAmp;
    const curY = drag.curY + Math.cos(t * 2.3 + 1.1) * wobbleAmp;

    // Deviation: reduced by up to 70% at full steadiness
    const dxB = curX - BOARD_CX;
    const dyB = curY - BOARD_CY;
    const distFromCenter = Math.sqrt(dxB * dxB + dyB * dyB);
    const baseSigma = 8 + (distFromCenter / R_DOUBLE_OUT) * 10;
    const sigma = baseSigma * (1 - steadiness * 0.7);
    const landX = curX + gaussianRand() * sigma;
    const landY = curY + gaussianRand() * sigma;

    // Near-miss: landed just outside a double or treble ring boundary
    const rLand = Math.sqrt((landX - BOARD_CX) ** 2 + (landY - BOARD_CY) ** 2);
    const nearestRingDist = Math.min(
      ...[R_TREBLE_IN, R_TREBLE_OUT, R_DOUBLE_IN, R_DOUBLE_OUT].map(rb => Math.abs(rLand - rb))
    );
    nearMissRef.current = nearestRingDist < 5;

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
