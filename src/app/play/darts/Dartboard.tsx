'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

// ── Standard dartboard constants ─────────────────────────────────────
// The playing area (double ring) has radius 200, but we need room for
// the number ring + a decorative surround, so the canvas is bigger.
const PADDING = 48;                // space around the double ring for numbers + surround
const R_INNER_BULL = 12;
const R_OUTER_BULL = 32;
const R_INNER_SINGLE = 100;
const R_TREBLE = 115;
const R_OUTER_SINGLE = 170;
const R_DOUBLE = 200;
const R_SURROUND = 220;           // black surround ring
const R_NUMBER = 232;             // where numbers sit

const BOARD_SIZE = (R_NUMBER + PADDING) * 2;   // full canvas
const CX = BOARD_SIZE / 2;
const CY = BOARD_SIZE / 2;

// Segment order clockwise from top (starting at "20")
const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const SEG_ANGLE = (2 * Math.PI) / 20;

// Colours
const BLACK = '#1a1a1a';
const CREAM = '#f5e6c8';
const RED = '#c62828';
const GREEN = '#2e7d32';
const SURROUND_COLOR = '#222';
const BG_COLOR = '#0f0f0f';
const NUMBER_BG = '#1a1a1a';

// Wobble / aim params
const FOCUS_RATE = 0.04;
const WOBBLE_MAX = 80;
const WOBBLE_MIN = 20;
const SKILL_SIGMA = 8;

export interface DartThrow {
  x: number;
  y: number;
  segment: number;
  multiplier: number;
  points: number;
  label: string;
}

interface DartboardProps {
  isMyTurn: boolean;
  onThrow: (dart: DartThrow) => void;
  myDarts: DartThrow[];
  opponentDarts: DartThrow[];
  myColor: string;
  opponentColor: string;
}

// ── Segment hit detection ──────────────────────────────────────────
function hitTest(x: number, y: number): DartThrow {
  const dx = x - CX;
  const dy = y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > R_DOUBLE) {
    return { x, y, segment: 0, multiplier: 0, points: 0, label: 'Miss' };
  }
  if (dist <= R_INNER_BULL) {
    return { x, y, segment: 25, multiplier: 2, points: 50, label: 'Bull' };
  }
  if (dist <= R_OUTER_BULL) {
    return { x, y, segment: 25, multiplier: 1, points: 25, label: 'Outer Bull' };
  }

  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  const segIdx = Math.floor((angle + SEG_ANGLE / 2) / SEG_ANGLE) % 20;
  const segment = SEGMENTS[segIdx];

  let multiplier = 1;
  let prefix = 'S';
  if (dist <= R_INNER_SINGLE) {
    multiplier = 1; prefix = 'S';
  } else if (dist <= R_TREBLE) {
    multiplier = 3; prefix = 'T';
  } else if (dist <= R_OUTER_SINGLE) {
    multiplier = 1; prefix = 'S';
  } else {
    multiplier = 2; prefix = 'D';
  }

  return { x, y, segment, multiplier, points: segment * multiplier, label: `${prefix}${segment}` };
}

// ── Gaussian random (Box-Muller) ───────────────────────────────────
function gaussRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Draw helpers ────────────────────────────────────────────────────

function drawBoard(ctx: CanvasRenderingContext2D) {
  const cx = CX;
  const cy = CY;

  // Full background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Number ring background (dark circle behind numbers)
  ctx.beginPath();
  ctx.arc(cx, cy, R_NUMBER + 14, 0, Math.PI * 2);
  ctx.fillStyle = NUMBER_BG;
  ctx.fill();

  // Surround ring (black rubber)
  ctx.beginPath();
  ctx.arc(cx, cy, R_SURROUND, 0, Math.PI * 2);
  ctx.fillStyle = SURROUND_COLOR;
  ctx.fill();

  // Subtle shadow under the board
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, R_DOUBLE, 0, Math.PI * 2);
  ctx.fillStyle = BLACK;
  ctx.fill();
  ctx.restore();

  // Draw segments
  for (let i = 0; i < 20; i++) {
    const startAngle = -Math.PI / 2 + (i - 0.5) * SEG_ANGLE;
    const endAngle = startAngle + SEG_ANGLE;
    const isEven = i % 2 === 0;

    // Double ring
    ctx.beginPath();
    ctx.arc(cx, cy, R_DOUBLE, startAngle, endAngle);
    ctx.arc(cx, cy, R_OUTER_SINGLE, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = isEven ? RED : GREEN;
    ctx.fill();

    // Outer single
    ctx.beginPath();
    ctx.arc(cx, cy, R_OUTER_SINGLE, startAngle, endAngle);
    ctx.arc(cx, cy, R_TREBLE, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = isEven ? BLACK : CREAM;
    ctx.fill();

    // Treble ring
    ctx.beginPath();
    ctx.arc(cx, cy, R_TREBLE, startAngle, endAngle);
    ctx.arc(cx, cy, R_INNER_SINGLE, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = isEven ? RED : GREEN;
    ctx.fill();

    // Inner single
    ctx.beginPath();
    ctx.arc(cx, cy, R_INNER_SINGLE, startAngle, endAngle);
    ctx.arc(cx, cy, R_OUTER_BULL, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = isEven ? BLACK : CREAM;
    ctx.fill();
  }

  // Outer bull
  ctx.beginPath();
  ctx.arc(cx, cy, R_OUTER_BULL, 0, Math.PI * 2);
  ctx.fillStyle = GREEN;
  ctx.fill();

  // Inner bull
  ctx.beginPath();
  ctx.arc(cx, cy, R_INNER_BULL, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();

  // Wire lines (silver)
  ctx.strokeStyle = 'rgba(200,200,200,0.45)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI / 2 + (i - 0.5) * SEG_ANGLE;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * R_OUTER_BULL, cy + Math.sin(angle) * R_OUTER_BULL);
    ctx.lineTo(cx + Math.cos(angle) * R_DOUBLE, cy + Math.sin(angle) * R_DOUBLE);
    ctx.stroke();
  }

  // Ring wires
  for (const r of [R_INNER_BULL, R_OUTER_BULL, R_INNER_SINGLE, R_TREBLE, R_OUTER_SINGLE, R_DOUBLE]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Segment numbers — outside the surround, with shadow for readability
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI / 2 + i * SEG_ANGLE;
    const nx = cx + Math.cos(angle) * R_NUMBER;
    const ny = cy + Math.sin(angle) * R_NUMBER;
    ctx.fillText(String(SEGMENTS[i]), nx, ny);
  }
  ctx.restore();
}

function drawDart(ctx: CanvasRenderingContext2D, dart: DartThrow, color: string) {
  const { x, y } = dart;

  ctx.save();

  // Shadow under dart
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Barrel (main body) — tapered rectangle
  ctx.beginPath();
  ctx.moveTo(x - 1.8, y);
  ctx.lineTo(x - 2.5, y + 10);
  ctx.lineTo(x + 2.5, y + 10);
  ctx.lineTo(x + 1.8, y);
  ctx.closePath();
  const barrelGrad = ctx.createLinearGradient(x - 3, y, x + 3, y);
  barrelGrad.addColorStop(0, 'rgba(180,180,180,0.9)');
  barrelGrad.addColorStop(0.5, 'rgba(220,220,220,0.95)');
  barrelGrad.addColorStop(1, 'rgba(150,150,150,0.9)');
  ctx.fillStyle = barrelGrad;
  ctx.fill();

  // Shaft (thinner)
  ctx.beginPath();
  ctx.moveTo(x - 1, y + 10);
  ctx.lineTo(x - 1, y + 22);
  ctx.lineTo(x + 1, y + 22);
  ctx.lineTo(x + 1, y + 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(60,60,60,0.9)';
  ctx.fill();

  ctx.restore(); // remove shadow for flight

  // Flight (coloured fins)
  ctx.beginPath();
  ctx.moveTo(x, y + 17);
  ctx.lineTo(x - 7, y + 28);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 7, y + 28);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fill();

  // Flight outline
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Tip (sharp point)
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x - 1.2, y + 1);
  ctx.lineTo(x + 1.2, y + 1);
  ctx.closePath();
  ctx.fillStyle = '#ccc';
  ctx.fill();

  // Embedded point glow
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, focusing: boolean) {
  const alpha = focusing ? 1.0 : 0.6;
  const glow = focusing ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';

  // Soft glow
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fill();

  // Crosshair lines
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
  ctx.lineWidth = 1;
  const gap = 5;
  const arm = 16;
  ctx.beginPath();
  ctx.moveTo(x - arm, y); ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y); ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm); ctx.lineTo(x, y - gap);
  ctx.moveTo(x, y + gap); ctx.lineTo(x, y + arm);
  ctx.stroke();

  // "HOLD TO FOCUS" hint when not focusing
  if (!focusing) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hold to focus', x, y + 30);
  }
}

// ── Component ──────────────────────────────────────────────────────

export function Dartboard({ isMyTurn, onThrow, myDarts, opponentDarts, myColor, opponentColor }: DartboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const tRef = useRef(0);
  const wobbleRef = useRef(WOBBLE_MAX);
  const focusingRef = useRef(false);
  const [dartAnim, setDartAnim] = useState<{ dart: DartThrow; startTime: number } | null>(null);

  useEffect(() => {
    wobbleRef.current = WOBBLE_MAX;
    focusingRef.current = false;
  }, [isMyTurn]);

  const handlePointerDown = useCallback(() => {
    if (!isMyTurn) return;
    focusingRef.current = true;
  }, [isMyTurn]);

  const handlePointerUp = useCallback(() => {
    if (!isMyTurn || !focusingRef.current) return;
    focusingRef.current = false;

    const t = tRef.current;
    const w = wobbleRef.current;
    const rx = CX + Math.sin(t * 0.9) * w;
    const ry = CY + Math.cos(t * 1.1) * w;

    const landX = rx + gaussRandom() * SKILL_SIGMA;
    const landY = ry + gaussRandom() * SKILL_SIGMA;
    const dart = hitTest(landX, landY);

    setDartAnim({ dart, startTime: performance.now() });

    setTimeout(() => {
      setDartAnim(null);
      onThrow(dart);
      wobbleRef.current = WOBBLE_MAX;
    }, 200);
  }, [isMyTurn, onThrow]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (now: number) => {
      tRef.current += 0.05;

      if (focusingRef.current && wobbleRef.current > WOBBLE_MIN) {
        wobbleRef.current -= FOCUS_RATE * (wobbleRef.current - WOBBLE_MIN + 5);
        if (wobbleRef.current < WOBBLE_MIN) wobbleRef.current = WOBBLE_MIN;
      }

      ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
      drawBoard(ctx);

      // Opponent's current-round darts
      for (const d of opponentDarts) {
        drawDart(ctx, d, opponentColor);
      }

      // My current-round darts
      for (const d of myDarts) {
        drawDart(ctx, d, myColor);
      }

      // Dart-in-flight animation
      if (dartAnim) {
        const elapsed = now - dartAnim.startTime;
        const progress = Math.min(1, elapsed / 200);
        const startX = CX;
        const startY = -20;
        const animX = startX + (dartAnim.dart.x - startX) * progress;
        const animY = startY + (dartAnim.dart.y - startY) * progress;
        // Scale dart from small to full size during flight
        ctx.save();
        const scale = 0.4 + 0.6 * progress;
        ctx.translate(animX, animY);
        ctx.scale(scale, scale);
        ctx.translate(-animX, -animY);
        if (progress < 1) {
          drawDart(ctx, { ...dartAnim.dart, x: animX, y: animY }, myColor);
        } else {
          drawDart(ctx, dartAnim.dart, myColor);
        }
        ctx.restore();
      }

      // Wobbling reticle
      if (isMyTurn && !dartAnim) {
        const w = wobbleRef.current;
        const rx = CX + Math.sin(tRef.current * 0.9) * w;
        const ry = CY + Math.cos(tRef.current * 1.1) * w;
        drawReticle(ctx, rx, ry, focusingRef.current);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [isMyTurn, myDarts, opponentDarts, myColor, opponentColor, dartAnim]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        className="rounded-xl cursor-crosshair max-w-full"
        style={{ width: '100%', maxWidth: 520, height: 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { focusingRef.current = false; }}
      />
    </div>
  );
}
