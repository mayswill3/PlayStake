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
  }, []);

  // ── Draw dartboard ──────────────────────────────────────────────────────────
  const drawBoard = useCallback((ctx: CanvasRenderingContext2D) => {
    const cx = BOARD_CX;
    const cy = BOARD_CY;
    const SEG_ANG = (2 * Math.PI) / 20;

    // Board surround (black circle)
    ctx.beginPath();
    ctx.arc(cx, cy, R_WIRE + 20, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw 20 segments, each with 4 rings
    for (let i = 0; i < 20; i++) {
      // Start angle offset so segment 20 is centered at top
      const startAng = -Math.PI / 2 - SEG_ANG / 2 + i * SEG_ANG;
      const endAng = startAng + SEG_ANG;
      const colors = SEG_COLORS[i % 2];
      const accent = i % 2 === 0 ? RED : GREEN;

      // Inner single (bull→treble_in)
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
      ctx.arc(cx, cy, R_DOUBLE_IN, endAng, startAng, true);
      ctx.closePath();
      ctx.fillStyle = colors[0];
      ctx.fill();

      // Double ring
      ctx.beginPath();
      ctx.arc(cx, cy, R_DOUBLE_IN, startAng, endAng);
      ctx.arc(cx, cy, R_DOUBLE_OUT, endAng, startAng, true);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.fill();
    }

    // Bull (25)
    ctx.beginPath();
    ctx.arc(cx, cy, R_BULL, 0, Math.PI * 2);
    ctx.fillStyle = GREEN;
    ctx.fill();

    // Bullseye (50)
    ctx.beginPath();
    ctx.arc(cx, cy, R_BULLSEYE, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.fill();

    // Wire lines (thin radial)
    ctx.strokeStyle = 'rgba(200,200,200,0.5)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 - SEG_ANG / 2 + i * SEG_ANG;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * R_BULL, cy + Math.sin(ang) * R_BULL);
      ctx.lineTo(cx + Math.cos(ang) * R_DOUBLE_OUT, cy + Math.sin(ang) * R_DOUBLE_OUT);
      ctx.stroke();
    }

    // Ring wires
    for (const r of [R_BULL, R_TREBLE_IN, R_TREBLE_OUT, R_DOUBLE_IN, R_DOUBLE_OUT]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,200,200,0.55)';
      ctx.lineWidth = r === R_DOUBLE_OUT ? 1.2 : 0.8;
      ctx.stroke();
    }

    // Number labels
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 + i * SEG_ANG;
      const lx = cx + Math.cos(ang) * R_NUMBERS;
      const ly = cy + Math.sin(ang) * R_NUMBERS;
      ctx.fillStyle = '#f0e8d0';
      ctx.fillText(String(SEGMENTS[i]), lx, ly);
    }
  }, []);

  // ── Draw scoreboards ─────────────────────────────────────────────────────────
  const drawScoreboard = useCallback((ctx: CanvasRenderingContext2D, gs: DartsState, nameA: string, nameB: string) => {
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

    // Current turn indicator
    if (gs.phase !== 'finished') {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4a8a4a';
      const labelX = gs.currentTurn === 'A' ? 77 : W - 77;
      ctx.fillText('▶ YOUR TURN', labelX, 158);
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

    // === Tip / point ===
    // Thin needle from origin back ~10px
    const tipGrad = ctx.createLinearGradient(0, 0, -10, 0);
    tipGrad.addColorStop(0, '#e8e8e8');
    tipGrad.addColorStop(1, '#aaa');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, 0);
    ctx.strokeStyle = tipGrad;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();

    // === Barrel ===
    // Tapered cylinder from -10 to -34 (fat in middle, tapered at shaft end)
    const barrelGrad = ctx.createLinearGradient(0, -3, 0, 3);
    barrelGrad.addColorStop(0, '#f0f0f0');
    barrelGrad.addColorStop(0.35, '#c8c8c8');
    barrelGrad.addColorStop(0.65, '#909090');
    barrelGrad.addColorStop(1, '#b0b0b0');

    // Main barrel body
    ctx.beginPath();
    ctx.moveTo(-10, -1.5);
    ctx.lineTo(-10, 1.5);
    ctx.lineTo(-30, 2);
    ctx.lineTo(-30, -2);
    ctx.closePath();
    ctx.fillStyle = barrelGrad;
    ctx.fill();

    // Grip knurls (tiny vertical lines across barrel)
    ctx.strokeStyle = 'rgba(60,60,60,0.5)';
    ctx.lineWidth = 0.6;
    for (let kx = -12; kx >= -29; kx -= 2.5) {
      ctx.beginPath();
      ctx.moveTo(kx, -2);
      ctx.lineTo(kx, 2);
      ctx.stroke();
    }

    // Barrel highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-10, -0.8);
    ctx.lineTo(-30, -1.2);
    ctx.stroke();

    // === Shaft (narrow tube from barrel to flights) ===
    ctx.beginPath();
    ctx.moveTo(-30, -1.5);
    ctx.lineTo(-30, 1.5);
    ctx.lineTo(-40, 1);
    ctx.lineTo(-40, -1);
    ctx.closePath();
    ctx.fillStyle = '#2a2a3a';
    ctx.fill();

    // === Flights (two wing shapes at back) ===
    // Upper flight
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(-52, -8);
    ctx.lineTo(-48, -1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(80,140,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,255,0.8)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Lower flight
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(-52, 8);
    ctx.lineTo(-48, 1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(80,140,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,255,0.8)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }, []);

  // ── Draw landed darts ───────────────────────────────────────────────────────
  const drawDarts = useCallback((ctx: CanvasRenderingContext2D, darts: DartThrow[]) => {
    for (const d of darts) {
      if (d.score === 0 && d.segment === 0) continue; // miss — skip visual on board

      // Darts stick in the board pointing slightly upward (225° = tip at top-left)
      drawDartShape(ctx, d.x, d.y, -42);

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
    elapsed: number,
  ) => {
    const { startX, startY, curX, curY } = drag;

    // Is the aim point on the board?
    const dxB = curX - BOARD_CX;
    const dyB = curY - BOARD_CY;
    const onBoard = Math.sqrt(dxB * dxB + dyB * dyB) <= R_DOUBLE_OUT;

    // Dart at press point, angled toward cursor
    const angleDeg = Math.atan2(curY - startY, curX - startX) * 180 / Math.PI;
    drawDartShape(ctx, startX, startY, angleDeg, 1.15);

    // Dashed line from press point to cursor
    ctx.save();
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = onBoard ? 'rgba(255,200,200,0.55)' : 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(curX, curY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Pulsing aim circle at cursor
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * Math.PI * 2);
    const aimR = 13 + pulse * 3;
    ctx.save();
    ctx.shadowColor = onBoard ? 'rgba(255,60,60,0.6)' : 'rgba(180,180,180,0.3)';
    ctx.shadowBlur = onBoard ? 10 : 4;
    ctx.strokeStyle = onBoard ? 'rgba(255,80,80,0.9)' : 'rgba(200,200,200,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(curX, curY, aimR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = onBoard ? 'rgba(255,80,80,0.9)' : 'rgba(200,200,200,0.5)';
    ctx.fill();
    ctx.restore();

    if (!onBoard) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = 'rgba(200,200,200,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MISS', curX, curY - 20);
    }
  }, [drawDartShape]);

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
      drawScoreboard(ctx, gs, displayNameA, displayNameB);
      drawDarts(ctx, gs.currentDarts);
      if (f && f.active) drawFlight(ctx);

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
  }, [gs, isMyTurn, displayNameA, displayNameB, drawBackground, drawBoard, drawScoreboard, drawDarts, drawFlight, drawAimGuide, drawThrowHint]);

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
