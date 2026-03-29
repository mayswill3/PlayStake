'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Circle } from 'lucide-react';
import { useLandscapeLock } from '@/hooks/useLandscapeLock';
import { RotatePrompt } from '@/components/ui/RotatePrompt';
import { GameMobileFAB } from '@/components/ui/GameMobileFAB';
import { useEventLog } from '../_shared/use-event-log';
import { useDemoAuth } from '../_shared/use-demo-auth';
import { useGameSession } from '../_shared/use-game-session';
import { PlayStakeWidget, type PlayStakeWidgetHandle } from '../_shared/PlayStakeWidget';
import { GameResultOverlay, deriveOutcome, formatResultAmount, type SettlementResult } from '../_shared/GameResultOverlay';
import { RoleSelector } from '../_shared/RoleSelector';
import { LobbyPanel } from '../_shared/LobbyPanel';
import { EventLog } from '../_shared/EventLog';
import type { PlayerRole } from '../_shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 400;
const BALL_RADIUS = 10;
const POCKET_RADIUS_CORNER = 18;
const POCKET_RADIUS_SIDE = 16;
const RAIL_INSET = 30;
const FRICTION = 0.985;
const BALL_RESTITUTION = 0.95;
const RAIL_RESTITUTION = 0.75;
const VELOCITY_THRESHOLD = 0.05;
const MAX_SHOT_POWER = 25;
const MAX_DRAG_DISTANCE = 150;

const CANVAS_WIDTH = TABLE_WIDTH + RAIL_INSET * 2 + 20;
const CANVAS_HEIGHT = TABLE_HEIGHT + RAIL_INSET * 2 + 20;

const FELT_COLOR = '#0a5c36';
const RAIL_COLOR = '#3d1f0a';

// ---------------------------------------------------------------------------
// Ball colors
// ---------------------------------------------------------------------------
const BALL_COLORS: Record<number, string> = {
  0: '#ffffff', // cue
  1: '#f5d800', 2: '#0055cc', 3: '#cc0000', 4: '#6b1f8a',
  5: '#e86100', 6: '#007a3d', 7: '#8b1a1a', 8: '#111111',
  9: '#f5d800', 10: '#0055cc', 11: '#cc0000', 12: '#6b1f8a',
  13: '#e86100', 14: '#007a3d', 15: '#8b1a1a',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
}

interface ShotResult {
  firstContact: number | null;
  pocketed: number[];
  cuePocketed: boolean;
  railAfterContact: boolean;
  contactMade: boolean;
}

interface PoolGameData {
  poolState: 'break' | 'aiming' | 'ball_in_hand' | 'turn_result' | 'game_over';
  turnNumber: number;
  currentTurn: 'A' | 'B';
  balls: { id: number; x: number; y: number; pocketed: boolean }[];
  groups: { A: 'solids' | 'stripes' | null; B: 'solids' | 'stripes' | null };
  pocketedByA: number[];
  pocketedByB: number[];
  lastShot: {
    player: 'A' | 'B';
    angle: number;
    power: number;
    preShotBalls: { id: number; x: number; y: number; pocketed: boolean }[];
    pocketed: number[];
    foul: boolean;
    foulReasons: string[];
  } | null;
  calledPocket: string | null;
  winner: 'A' | 'B' | null;
  winReason: string | null;
  isBreakShot: boolean;
  extraShot?: boolean;
}

type PoolPhase = 'break' | 'aiming' | 'shooting' | 'ball_in_hand' | 'calling_pocket' | 'game_over';

// ---------------------------------------------------------------------------
// Pocket positions (relative to canvas origin which includes padding)
// ---------------------------------------------------------------------------
const OFFSET = RAIL_INSET + 10; // padding around table

function getPockets(): { x: number; y: number; radius: number }[] {
  return [
    // corners
    { x: OFFSET, y: OFFSET, radius: POCKET_RADIUS_CORNER },
    { x: OFFSET + TABLE_WIDTH, y: OFFSET, radius: POCKET_RADIUS_CORNER },
    { x: OFFSET, y: OFFSET + TABLE_HEIGHT, radius: POCKET_RADIUS_CORNER },
    { x: OFFSET + TABLE_WIDTH, y: OFFSET + TABLE_HEIGHT, radius: POCKET_RADIUS_CORNER },
    // sides
    { x: OFFSET + TABLE_WIDTH / 2, y: OFFSET, radius: POCKET_RADIUS_SIDE },
    { x: OFFSET + TABLE_WIDTH / 2, y: OFFSET + TABLE_HEIGHT, radius: POCKET_RADIUS_SIDE },
  ];
}

const POCKETS = getPockets();

// ---------------------------------------------------------------------------
// Initial ball positions (standard rack)
// ---------------------------------------------------------------------------
function rackBalls(): Ball[] {
  const balls: Ball[] = [];
  const cueX = OFFSET + TABLE_WIDTH * 0.25;
  const cueY = OFFSET + TABLE_HEIGHT / 2;
  balls.push({ id: 0, x: cueX, y: cueY, vx: 0, vy: 0, pocketed: false });

  const startX = OFFSET + TABLE_WIDTH * 0.73;
  const startY = OFFSET + TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.1;

  // Standard 8-ball rack order (rows 1-5)
  // Row 0: 1 ball, Row 1: 2 balls, Row 2: 3 balls (8 in middle), etc.
  const rackOrder = [
    [1],
    [9, 2],
    [3, 8, 10],
    [11, 4, 12, 5],
    [6, 13, 14, 7, 15],
  ];

  for (let row = 0; row < rackOrder.length; row++) {
    const rowBalls = rackOrder[row];
    const rowX = startX + row * spacing * Math.cos(Math.PI / 6);
    for (let col = 0; col < rowBalls.length; col++) {
      const colOffset = (col - (rowBalls.length - 1) / 2) * spacing;
      const bx = rowX;
      const by = startY + colOffset;
      balls.push({ id: rowBalls[col], x: bx, y: by, vx: 0, vy: 0, pocketed: false });
    }
  }

  return balls;
}

// ---------------------------------------------------------------------------
// Physics helpers
// ---------------------------------------------------------------------------
function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function allAtRest(balls: Ball[]): boolean {
  return balls.every(b => b.pocketed || (Math.abs(b.vx) < VELOCITY_THRESHOLD && Math.abs(b.vy) < VELOCITY_THRESHOLD));
}

function stepPhysics(balls: Ball[], shotResult: ShotResult): void {
  const activeBalls = balls.filter(b => !b.pocketed);

  // Move
  for (const b of activeBalls) {
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < VELOCITY_THRESHOLD) b.vx = 0;
    if (Math.abs(b.vy) < VELOCITY_THRESHOLD) b.vy = 0;
  }

  // Ball-ball collisions
  for (let i = 0; i < activeBalls.length; i++) {
    for (let j = i + 1; j < activeBalls.length; j++) {
      const a = activeBalls[i];
      const b = activeBalls[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < BALL_RADIUS * 2 && d > 0) {
        // Track first contact by cue ball
        if (a.id === 0 && shotResult.firstContact === null) {
          shotResult.firstContact = b.id;
          shotResult.contactMade = true;
        }
        if (b.id === 0 && shotResult.firstContact === null) {
          shotResult.firstContact = a.id;
          shotResult.contactMade = true;
        }

        // Separate overlapping
        const overlap = BALL_RADIUS * 2 - d;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * overlap / 2;
        a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2;
        b.y += ny * overlap / 2;

        // Elastic collision (equal mass)
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          a.vx -= dot * nx * BALL_RESTITUTION;
          a.vy -= dot * ny * BALL_RESTITUTION;
          b.vx += dot * nx * BALL_RESTITUTION;
          b.vy += dot * ny * BALL_RESTITUTION;
        }
      }
    }
  }

  // Rail bounces
  const minX = OFFSET + BALL_RADIUS;
  const maxX = OFFSET + TABLE_WIDTH - BALL_RADIUS;
  const minY = OFFSET + BALL_RADIUS;
  const maxY = OFFSET + TABLE_HEIGHT - BALL_RADIUS;

  for (const b of activeBalls) {
    let hitRail = false;
    if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx) * RAIL_RESTITUTION; hitRail = true; }
    if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * RAIL_RESTITUTION; hitRail = true; }
    if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * RAIL_RESTITUTION; hitRail = true; }
    if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy) * RAIL_RESTITUTION; hitRail = true; }
    if (hitRail && shotResult.contactMade) {
      shotResult.railAfterContact = true;
    }
  }

  // Pocket detection
  for (const b of activeBalls) {
    for (const p of POCKETS) {
      if (dist(b.x, b.y, p.x, p.y) < p.radius) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        if (b.id === 0) {
          shotResult.cuePocketed = true;
        } else {
          shotResult.pocketed.push(b.id);
        }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Raycast for ghost ball
// ---------------------------------------------------------------------------
function raycastFirstBall(
  ox: number, oy: number, dx: number, dy: number, balls: Ball[], skipId: number
): { ball: Ball; cx: number; cy: number } | null {
  let closest: { ball: Ball; cx: number; cy: number; t: number } | null = null;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const ndx = dx / len;
  const ndy = dy / len;

  for (const b of balls) {
    if (b.pocketed || b.id === skipId) continue;
    const ex = b.x - ox;
    const ey = b.y - oy;
    const t = ex * ndx + ey * ndy;
    if (t < 0) continue;
    const closestX = ox + ndx * t;
    const closestY = oy + ndy * t;
    const d = dist(closestX, closestY, b.x, b.y);
    if (d < BALL_RADIUS * 2) {
      if (!closest || t < closest.t) {
        // Find exact contact point
        const backDist = Math.sqrt(Math.max(0, (BALL_RADIUS * 2) ** 2 - d * d));
        const contactT = t - backDist;
        closest = { ball: b, cx: ox + ndx * contactT, cy: oy + ndy * contactT, t: contactT };
      }
    }
  }
  return closest ? { ball: closest.ball, cx: closest.cx, cy: closest.cy } : null;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function drawBall(ctx: CanvasRenderingContext2D, b: Ball): void {
  if (b.pocketed) return;
  const isStripe = b.id >= 9 && b.id <= 15;
  const color = BALL_COLORS[b.id] || '#888';

  ctx.save();

  if (b.id === 0) {
    // Cue ball - white with subtle gradient
    const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_RADIUS);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cccccc');
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (isStripe) {
    // Stripe: white base, colored band, number
    const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_RADIUS);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#dddddd');
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Stripe band
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(b.x - BALL_RADIUS, b.y - BALL_RADIUS * 0.45, BALL_RADIUS * 2, BALL_RADIUS * 0.9);

    // Number circle
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `bold ${BALL_RADIUS * 0.8}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.id), b.x, b.y + 0.5);

    // Border
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else {
    // Solid ball
    const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_RADIUS);
    grad.addColorStop(0, lightenColor(color, 40));
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Number circle
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `bold ${BALL_RADIUS * 0.8}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.id), b.x, b.y + 0.5);

    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  ctx.restore();
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `rgb(${r},${g},${b})`;
}

function drawTable(ctx: CanvasRenderingContext2D): void {
  // Outer border / rail
  ctx.fillStyle = RAIL_COLOR;
  ctx.fillRect(OFFSET - RAIL_INSET, OFFSET - RAIL_INSET, TABLE_WIDTH + RAIL_INSET * 2, TABLE_HEIGHT + RAIL_INSET * 2);

  // Rail inner edge highlight
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(OFFSET - RAIL_INSET + 4, OFFSET - RAIL_INSET + 4,
    TABLE_WIDTH + RAIL_INSET * 2 - 8, TABLE_HEIGHT + RAIL_INSET * 2 - 8);
  ctx.fillStyle = RAIL_COLOR;
  ctx.fillRect(OFFSET - 2, OFFSET - 2, TABLE_WIDTH + 4, TABLE_HEIGHT + 4);

  // Felt
  ctx.fillStyle = FELT_COLOR;
  ctx.fillRect(OFFSET, OFFSET, TABLE_WIDTH, TABLE_HEIGHT);

  // Felt texture lines (subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 0.5;
  for (let y = OFFSET; y < OFFSET + TABLE_HEIGHT; y += 8) {
    ctx.beginPath();
    ctx.moveTo(OFFSET, y);
    ctx.lineTo(OFFSET + TABLE_WIDTH, y);
    ctx.stroke();
  }

  // Head string
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const headX = OFFSET + TABLE_WIDTH * 0.25;
  ctx.beginPath();
  ctx.moveTo(headX, OFFSET);
  ctx.lineTo(headX, OFFSET + TABLE_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Foot spot
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(OFFSET + TABLE_WIDTH * 0.73, OFFSET + TABLE_HEIGHT / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Pockets
  for (const p of POCKETS) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Pocket rim
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Diamond markers on rails
  ctx.fillStyle = '#c4a35a';
  const diamonds = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  for (const frac of diamonds) {
    // Top rail
    ctx.beginPath();
    ctx.arc(OFFSET + TABLE_WIDTH * frac, OFFSET - RAIL_INSET / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Bottom rail
    ctx.beginPath();
    ctx.arc(OFFSET + TABLE_WIDTH * frac, OFFSET + TABLE_HEIGHT + RAIL_INSET / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const sideDiamonds = [0.25, 0.5, 0.75];
  for (const frac of sideDiamonds) {
    ctx.beginPath();
    ctx.arc(OFFSET - RAIL_INSET / 2, OFFSET + TABLE_HEIGHT * frac, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(OFFSET + TABLE_WIDTH + RAIL_INSET / 2, OFFSET + TABLE_HEIGHT * frac, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPowerMeter(ctx: CanvasRenderingContext2D, power: number): void {
  const meterX = 8;
  const meterY = OFFSET;
  const meterW = 12;
  const meterH = TABLE_HEIGHT;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(meterX, meterY, meterW, meterH);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX, meterY, meterW, meterH);

  // Fill from bottom
  const fillH = meterH * power;
  const grad = ctx.createLinearGradient(0, meterY + meterH, 0, meterY);
  grad.addColorStop(0, '#00cc44');
  grad.addColorStop(0.5, '#cccc00');
  grad.addColorStop(1, '#cc0000');
  ctx.fillStyle = grad;
  ctx.fillRect(meterX + 1, meterY + meterH - fillH, meterW - 2, fillH);
}

function drawCueStick(
  ctx: CanvasRenderingContext2D,
  cueBall: Ball,
  aimAngle: number,
  power: number
): void {
  const stickLength = 200;
  const stickTipOffset = BALL_RADIUS + 4 + power * 60;
  const tipX = cueBall.x - Math.cos(aimAngle) * stickTipOffset;
  const tipY = cueBall.y - Math.sin(aimAngle) * stickTipOffset;
  const endX = tipX - Math.cos(aimAngle) * stickLength;
  const endY = tipY - Math.sin(aimAngle) * stickLength;

  ctx.save();
  ctx.strokeStyle = '#d4a853';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Tip
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + Math.cos(aimAngle) * 6, tipY + Math.sin(aimAngle) * 6);
  ctx.stroke();

  // Butt end (darker / thicker)
  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - Math.cos(aimAngle) * 30, endY - Math.sin(aimAngle) * 30);
  ctx.stroke();

  ctx.restore();
}

function drawAimLine(
  ctx: CanvasRenderingContext2D,
  cueBall: Ball,
  aimAngle: number,
  balls: Ball[]
): void {
  const dx = Math.cos(aimAngle);
  const dy = Math.sin(aimAngle);
  const maxLen = 600;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;

  const hit = raycastFirstBall(cueBall.x, cueBall.y, dx, dy, balls, 0);

  if (hit) {
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(hit.cx, hit.cy);
    ctx.stroke();

    // Ghost ball
    ctx.beginPath();
    ctx.arc(hit.cx, hit.cy, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();

    // Projected direction for target ball
    const targetDx = hit.ball.x - hit.cx;
    const targetDy = hit.ball.y - hit.cy;
    const tLen = Math.sqrt(targetDx ** 2 + targetDy ** 2);
    if (tLen > 0) {
      ctx.beginPath();
      ctx.moveTo(hit.ball.x, hit.ball.y);
      ctx.lineTo(hit.ball.x + (targetDx / tLen) * 60, hit.ball.y + (targetDy / tLen) * 60);
      ctx.strokeStyle = 'rgba(255,200,0,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(cueBall.x + dx * maxLen, cueBall.y + dy * maxLen);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCallingPockets(
  ctx: CanvasRenderingContext2D,
  calledPocket: number | null,
  animFrame: number
): void {
  const pulse = 0.5 + 0.5 * Math.sin(animFrame * 0.05);
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    const isCalled = calledPocket === i;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 4 + pulse * 4, 0, Math.PI * 2);
    ctx.strokeStyle = isCalled
      ? `rgba(0,255,135,${0.6 + pulse * 0.4})`
      : `rgba(255,255,0,${0.3 + pulse * 0.3})`;
    ctx.lineWidth = isCalled ? 3 : 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PoolDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('pool', log);
  const {
    sessionId,
    gameState,
    phase,
    setPhase,
    createGame,
    joinGame,
    startPlayingPoll,
    resolveGame,
    setGameData,
    setBetId,
    reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');

  // ---- Pool-specific state ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>(rackBalls());
  const [poolPhase, setPoolPhase] = useState<PoolPhase>('break');
  const [currentTurn, setCurrentTurn] = useState<'A' | 'B'>('A');
  const [turnNumber, setTurnNumber] = useState(0);
  const [groups, setGroups] = useState<{ A: 'solids' | 'stripes' | null; B: 'solids' | 'stripes' | null }>({ A: null, B: null });
  const [pocketedByA, setPocketedByA] = useState<number[]>([]);
  const [pocketedByB, setPocketedByB] = useState<number[]>([]);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [winReason, setWinReason] = useState<string | null>(null);
  const [lastShotInfo, setLastShotInfo] = useState<string>('');
  const [calledPocket, setCalledPocket] = useState<number | null>(null);
  const [needsCallPocket, setNeedsCallPocket] = useState(false);
  const [ballInHand, setBallInHand] = useState(false);
  const [extraShot, setExtraShot] = useState(false);
  const [groupAssignedMsg, setGroupAssignedMsg] = useState<string | null>(null);
  const [, setRenderTick] = useState(0);

  // Aiming state
  const aimingRef = useRef(false);
  // Refs for touch handlers to avoid stale closures
  const isMyTurnRef = useRef(false);
  const phaseRef = useRef(phase);
  const winnerRef = useRef(winner);
  const ballInHandRef = useRef(ballInHand);
  const needsCallPocketRef = useRef(needsCallPocket);
  const calledPocketRef = useRef(calledPocket);
  const currentTurnRef = useRef(currentTurn);
  const groupsRef = useRef(groups);
  const pocketedByARef = useRef(pocketedByA);
  const pocketedByBRef = useRef(pocketedByB);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const shotPowerRef = useRef(0);
  const aimAngleRef = useRef(0);
  const shootingRef = useRef(false);
  const animFrameRef = useRef(0);
  const prevGameDataRef = useRef<PoolGameData | null>(null);
  const animatingOpponentRef = useRef(false);
  const opponentAnimEndRef = useRef<Ball[] | null>(null);

  const isMyTurn = currentTurn === role;

  // Keep refs in sync for touch handlers
  isMyTurnRef.current = isMyTurn;
  phaseRef.current = phase;
  winnerRef.current = winner;
  ballInHandRef.current = ballInHand;
  needsCallPocketRef.current = needsCallPocket;
  calledPocketRef.current = calledPocket;
  currentTurnRef.current = currentTurn;
  groupsRef.current = groups;
  pocketedByARef.current = pocketedByA;
  pocketedByBRef.current = pocketedByB;
  const isBreakShot = poolPhase === 'break';

  // Check if current player needs to call pocket (8-ball)
  const checkNeedsCallPocket = useCallback((player: 'A' | 'B', grps: typeof groups, pByA: number[], pByB: number[]) => {
    const group = grps[player];
    if (!group) return false;
    const myPocketed = player === 'A' ? pByA : pByB;
    const needed = group === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    return needed.every(id => myPocketed.includes(id));
  }, []);

  // ---- Sync game data to server ----
  const syncGameData = useCallback((overrides?: Partial<PoolGameData>) => {
    const data: PoolGameData = {
      poolState: poolPhase === 'shooting' ? 'aiming' : poolPhase === 'calling_pocket' ? 'aiming' : poolPhase,
      turnNumber,
      currentTurn,
      balls: ballsRef.current.map(b => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed })),
      groups,
      pocketedByA,
      pocketedByB,
      lastShot: null,
      calledPocket: calledPocket !== null ? String(calledPocket) : null,
      winner,
      winReason,
      isBreakShot,
      extraShot,
      ...overrides,
    };
    setGameData(data as unknown as Record<string, unknown>);
  }, [poolPhase, turnNumber, currentTurn, groups, pocketedByA, pocketedByB, calledPocket, winner, winReason, isBreakShot, extraShot, setGameData]);

  // ---- Evaluate shot result ----
  const evaluateShot = useCallback((result: ShotResult, player: 'A' | 'B', isBreak: boolean, called: number | null) => {
    const foulReasons: string[] = [];
    let isFoul = false;

    // Scratch
    if (result.cuePocketed) {
      foulReasons.push('Scratch (cue ball pocketed)');
      isFoul = true;
    }

    // No contact
    if (!result.contactMade) {
      foulReasons.push('No ball contacted');
      isFoul = true;
    }

    // Check first contact legality (after groups assigned)
    const grp = groups[player];
    if (grp && result.firstContact !== null && result.firstContact !== 8) {
      const isFirstSolid = result.firstContact >= 1 && result.firstContact <= 7;
      if (grp === 'solids' && !isFirstSolid) {
        foulReasons.push('Wrong ball first (hit stripe)');
        isFoul = true;
      }
      if (grp === 'stripes' && isFirstSolid) {
        foulReasons.push('Wrong ball first (hit solid)');
        isFoul = true;
      }
    }

    // Must hit a rail after contact if nothing pocketed
    if (result.contactMade && !result.railAfterContact && result.pocketed.length === 0 && !isBreak) {
      foulReasons.push('No rail after contact');
      isFoul = true;
    }

    // Check if 8-ball was pocketed
    const eightPocketed = result.pocketed.includes(8);

    // 8-ball on break: breaker wins
    if (isBreak && eightPocketed) {
      return {
        foul: false,
        foulReasons: [],
        turnContinues: false,
        gameOver: true,
        gameWinner: player,
        reason: '8-ball sunk on break!',
      };
    }

    // 8-ball pocketed during play
    if (eightPocketed && !isBreak) {
      const myPocketed = player === 'A' ? pocketedByA : pocketedByB;
      const grpBalls = grp === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      const allGroupCleared = grp ? grpBalls.every(id => myPocketed.includes(id) || result.pocketed.includes(id)) : false;

      if (isFoul || !allGroupCleared) {
        // Illegal 8-ball pocket: opponent wins
        const opponent = player === 'A' ? 'B' : 'A';
        return {
          foul: true,
          foulReasons: [...foulReasons, 'Illegal 8-ball pocket'],
          turnContinues: false,
          gameOver: true,
          gameWinner: opponent,
          reason: isFoul ? '8-ball pocketed on a foul' : '8-ball pocketed before clearing group',
        };
      }

      // Legal 8-ball pocket with correct called pocket or no call required
      return {
        foul: false,
        foulReasons: [],
        turnContinues: false,
        gameOver: true,
        gameWinner: player,
        reason: '8-ball pocketed legally!',
      };
    }

    // Group assignment: first legal pot (including on the break)
    let newGroups = { ...groups };
    if (!groups.A && !groups.B && result.pocketed.length > 0 && !isFoul) {
      const firstPocketed = result.pocketed.find(id => id !== 8);
      if (firstPocketed !== undefined) {
        const isSolid = firstPocketed >= 1 && firstPocketed <= 7;
        newGroups = {
          [player]: isSolid ? 'solids' : 'stripes',
          [player === 'A' ? 'B' : 'A']: isSolid ? 'stripes' : 'solids',
        } as typeof groups;
        setGroups(newGroups);
        // Show group assignment notification
        const myGroup = newGroups[player];
        if (myGroup) {
          setGroupAssignedMsg(`You are ${myGroup.toUpperCase()}!`);
          setTimeout(() => setGroupAssignedMsg(null), 3000);
        }
      }
    }

    // Determine if turn continues
    const playerGroup = newGroups[player];
    let turnContinues = false;
    if (!isFoul && playerGroup && result.pocketed.length > 0) {
      const pottedOwn = result.pocketed.some(id => {
        if (playerGroup === 'solids') return id >= 1 && id <= 7;
        return id >= 9 && id <= 15;
      });
      turnContinues = pottedOwn;
    }

    return {
      foul: isFoul,
      foulReasons,
      turnContinues,
      gameOver: false,
      gameWinner: null as 'A' | 'B' | null,
      reason: null as string | null,
      newGroups,
    };
  }, [groups, pocketedByA, pocketedByB]);

  // ---- Execute shot ----
  const executeShot = useCallback((power: number, angle: number) => {
    if (shootingRef.current) return;
    shootingRef.current = true;
    setPoolPhase('shooting');

    const cueBall = ballsRef.current.find(b => b.id === 0);
    if (!cueBall || cueBall.pocketed) return;

    // Capture pre-shot state for opponent replay
    const preShotBalls = ballsRef.current.map(b => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed }));
    const shotAngle = angle;
    const shotPower = power;

    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;

    const shotResult: ShotResult = {
      firstContact: null,
      pocketed: [],
      cuePocketed: false,
      railAfterContact: false,
      contactMade: false,
    };

    const simulate = () => {
      // Run multiple sub-steps per frame for stability
      for (let i = 0; i < 2; i++) {
        stepPhysics(ballsRef.current, shotResult);
      }

      if (!allAtRest(ballsRef.current)) {
        requestAnimationFrame(simulate);
        return;
      }

      // Shot complete - evaluate
      shootingRef.current = false;
      const player = currentTurn;
      const result = evaluateShot(shotResult, player, isBreakShot, calledPocket);

      // Update pocketed lists
      const newByA = [...pocketedByA];
      const newByB = [...pocketedByB];
      for (const id of shotResult.pocketed) {
        if (player === 'A') newByA.push(id);
        else newByB.push(id);
      }
      setPocketedByA(newByA);
      setPocketedByB(newByB);

      // Build status message
      let msg = '';
      if (shotResult.pocketed.length > 0) {
        msg += `Pocketed: ${shotResult.pocketed.map(id => `#${id}`).join(', ')}. `;
      }
      if (result.foul) {
        msg += `FOUL: ${result.foulReasons.join('; ')}. `;
      }
      if (result.gameOver) {
        msg += result.reason || '';
      }
      setLastShotInfo(msg || 'No balls pocketed.');
      log(`Player ${player}: ${msg || 'No balls pocketed.'}`, result.foul ? 'error' : 'info');

      if (result.gameOver && result.gameWinner) {
        const gw = result.gameWinner as 'A' | 'B';
        setWinner(gw);
        setWinReason(result.reason);
        setPoolPhase('game_over');

        // Resolve via game session
        resolveGame(gw).then(() => {
          const activeBetId = gameState?.betId || betIdRef.current;
          if (activeBetId && authState && !settledRef.current) {
            settledRef.current = true;
            reportAndSettle(authState.apiKey, activeBetId).then((settle) => {
              if (settle) {
                setSettlementResult(settle as SettlementResult);
                widgetHandleRef.current?.refreshBalance();
              }
            });
          }
        });

        syncGameData({
          poolState: 'game_over',
          winner: gw,
          winReason: result.reason,
          turnNumber: turnNumber + 1,
          pocketedByA: newByA,
          pocketedByB: newByB,
          groups: result.newGroups,
          balls: ballsRef.current.map(b => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed })),
          lastShot: {
            player, angle: shotAngle, power: shotPower, preShotBalls,
            pocketed: shotResult.pocketed, foul: result.foul, foulReasons: result.foulReasons,
          },
        });
        return;
      }

      // Handle scratch - respawn cue ball
      if (shotResult.cuePocketed) {
        const cue = ballsRef.current.find(b => b.id === 0);
        if (cue) {
          cue.pocketed = false;
          cue.x = OFFSET + TABLE_WIDTH * 0.25;
          cue.y = OFFSET + TABLE_HEIGHT / 2;
          cue.vx = 0;
          cue.vy = 0;
        }
      }

      // Two-shots-on-foul logic
      let nextExtraShot = false;
      let effectiveTurnContinues = result.turnContinues;

      if (result.foul) {
        // Foul: opponent gets ball-in-hand + 2 shots
        effectiveTurnContinues = false;
        nextExtraShot = true;
      } else if (extraShot) {
        // This is the first of two free shots — turn continues regardless
        effectiveTurnContinues = true;
        nextExtraShot = false;
      }

      const nextTurn = effectiveTurnContinues ? player : (player === 'A' ? 'B' : 'A');
      const newTurnNumber = turnNumber + 1;
      setTurnNumber(newTurnNumber);
      setCurrentTurn(nextTurn);
      setCalledPocket(null);
      setNeedsCallPocket(false);
      setExtraShot(nextExtraShot);

      // Check if ball-in-hand for next player (foul gives opponent ball-in-hand)
      if (result.foul && !effectiveTurnContinues) {
        setBallInHand(true);
        setPoolPhase('ball_in_hand');
      } else {
        setBallInHand(false);
        // Check if next player needs to call pocket
        const updatedGroups = ('newGroups' in result && result.newGroups) ? result.newGroups : groups;
        const needsCall = checkNeedsCallPocket(nextTurn, updatedGroups, newByA, newByB);
        if (needsCall) {
          setNeedsCallPocket(true);
          setPoolPhase('calling_pocket');
        } else {
          setPoolPhase('aiming');
        }
      }

      syncGameData({
        turnNumber: newTurnNumber,
        currentTurn: nextTurn,
        pocketedByA: newByA,
        pocketedByB: newByB,
        groups: result.newGroups,
        balls: ballsRef.current.map(b => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed })),
        isBreakShot: false,
        extraShot: nextExtraShot,
        lastShot: {
          player, angle: shotAngle, power: shotPower, preShotBalls,
          pocketed: shotResult.pocketed, foul: result.foul, foulReasons: result.foulReasons,
        },
      });
    };

    requestAnimationFrame(simulate);
  }, [currentTurn, isBreakShot, calledPocket, pocketedByA, pocketedByB, groups, evaluateShot, resolveGame, gameState, authState, reportAndSettle, syncGameData, turnNumber, log, checkNeedsCallPocket, extraShot]);

  // ---- Canvas rendering loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const render = () => {
      animFrameRef.current++;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawTable(ctx);

      // During opponent replay: run physics each frame
      if (animatingOpponentRef.current && opponentAnimEndRef.current) {
        // Run physics steps (same as the shooter's simulation)
        for (let i = 0; i < 2; i++) {
          stepPhysics(ballsRef.current, { firstContact: null, pocketed: [], cuePocketed: false, railAfterContact: false, contactMade: false });
        }

        // Check if all balls at rest
        if (allAtRest(ballsRef.current)) {
          animatingOpponentRef.current = false;
          // Snap to authoritative final positions to correct any drift
          for (const endBall of opponentAnimEndRef.current) {
            const b = ballsRef.current.find(bb => bb.id === endBall.id);
            if (b) {
              b.x = endBall.x;
              b.y = endBall.y;
              b.vx = 0;
              b.vy = 0;
              b.pocketed = endBall.pocketed;
            }
          }
        }
      }

      // Draw all balls at their current positions
      for (const b of ballsRef.current) {
        drawBall(ctx, b);
      }

      // Aiming visuals
      const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
      if (cueBall && aimingRef.current && dragStartRef.current && dragCurrentRef.current) {
        drawAimLine(ctx, cueBall, aimAngleRef.current, ballsRef.current);
        drawCueStick(ctx, cueBall, aimAngleRef.current, shotPowerRef.current);
        drawPowerMeter(ctx, shotPowerRef.current);
      }

      // Calling pocket visuals
      if (needsCallPocket && isMyTurn && !shootingRef.current) {
        drawCallingPockets(ctx, calledPocket, animFrameRef.current);
      }

      // Ball-in-hand indicator
      if (ballInHand && isMyTurn && cueBall) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cueBall.x, cueBall.y, BALL_RADIUS + 6, 0, Math.PI * 2);
        const pulse = 0.5 + 0.5 * Math.sin(animFrameRef.current * 0.08);
        ctx.strokeStyle = `rgba(0,200,255,${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [phase, needsCallPocket, calledPocket, isMyTurn, ballInHand]);

  // ---- Poll for opponent state changes ----
  useEffect(() => {
    if (!gameState?.gameData) return;
    const data = gameState.gameData as unknown as PoolGameData;
    if (!data.balls || data.turnNumber == null) return;

    // React to state changes (initial sync or opponent's moves)
    if (!prevGameDataRef.current || data.turnNumber > prevGameDataRef.current.turnNumber) {
      const newBalls = data.balls.map(bd => ({
        id: bd.id,
        x: bd.x,
        y: bd.y,
        vx: 0,
        vy: 0,
        pocketed: bd.pocketed,
      }));

      if (!prevGameDataRef.current) {
        // Initial sync — snap directly, no animation
        ballsRef.current = newBalls;
      } else if (data.lastShot && data.lastShot.angle !== undefined && data.lastShot.preShotBalls) {
        // Replay the shot with full physics for realistic animation
        const ls = data.lastShot;
        // Restore pre-shot ball positions
        ballsRef.current = ls.preShotBalls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, pocketed: b.pocketed }));
        // Apply shot velocity to cue ball
        const cue = ballsRef.current.find(b => b.id === 0);
        if (cue && !cue.pocketed) {
          cue.vx = Math.cos(ls.angle) * ls.power;
          cue.vy = Math.sin(ls.angle) * ls.power;
        }
        // Store final state to snap to when replay finishes
        opponentAnimEndRef.current = newBalls;
        animatingOpponentRef.current = true;
        // The physics render loop will run and animate the balls
        // When all at rest, we'll snap to the authoritative final positions
      } else {
        // Fallback: simple snap (no lastShot data)
        ballsRef.current = newBalls;
      }

      // Update state from server
      setCurrentTurn(data.currentTurn);
      setTurnNumber(data.turnNumber);
      setGroups(data.groups);
      setPocketedByA(data.pocketedByA);
      setPocketedByB(data.pocketedByB);
      setExtraShot(data.extraShot ?? false);

      if (data.poolState === 'ball_in_hand' && data.currentTurn === role) {
        setBallInHand(true);
        setPoolPhase('ball_in_hand');
      } else if (data.poolState === 'game_over') {
        setWinner(data.winner);
        setWinReason(data.winReason);
        setPoolPhase('game_over');
      } else {
        setBallInHand(false);
        setPoolPhase(data.isBreakShot ? 'break' : 'aiming');
      }

      if (data.lastShot) {
        const ls = data.lastShot;
        let msg = '';
        if (ls.pocketed.length > 0) msg += `Pocketed: ${ls.pocketed.map(id => `#${id}`).join(', ')}. `;
        if (ls.foul) msg += `FOUL: ${ls.foulReasons.join('; ')}. `;
        setLastShotInfo(msg || 'No balls pocketed.');
      }
    }

    prevGameDataRef.current = data;
  }, [gameState, role]);

  // ---- Canvas mouse handlers ----
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);


  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || shootingRef.current || winner) return;
    if (phase !== 'playing') return;

    const pos = getCanvasPos(e);

    // Ball-in-hand: place cue ball
    if (ballInHand) {
      const cueBall = ballsRef.current.find(b => b.id === 0);
      if (!cueBall) return;

      // Check bounds
      const nx = Math.max(OFFSET + BALL_RADIUS, Math.min(OFFSET + TABLE_WIDTH - BALL_RADIUS, pos.x));
      const ny = Math.max(OFFSET + BALL_RADIUS, Math.min(OFFSET + TABLE_HEIGHT - BALL_RADIUS, pos.y));

      // Check overlap with other balls
      const overlaps = ballsRef.current.some(b => b.id !== 0 && !b.pocketed && dist(nx, ny, b.x, b.y) < BALL_RADIUS * 2.2);
      if (overlaps) return;

      cueBall.x = nx;
      cueBall.y = ny;
      cueBall.pocketed = false;
      setBallInHand(false);

      const needsCall = checkNeedsCallPocket(currentTurn, groups, pocketedByA, pocketedByB);
      if (needsCall) {
        setNeedsCallPocket(true);
        setPoolPhase('calling_pocket');
      } else {
        setPoolPhase('aiming');
      }
      setRenderTick(t => t + 1);
      return;
    }

    // Calling pocket: click on a pocket to select it
    if (needsCallPocket && calledPocket === null) {
      for (let i = 0; i < POCKETS.length; i++) {
        const p = POCKETS[i];
        if (dist(pos.x, pos.y, p.x, p.y) < p.radius + 15) {
          setCalledPocket(i);
          setNeedsCallPocket(false);
          setPoolPhase('aiming');
          log(`Called pocket #${i + 1}`, 'info');
          return;
        }
      }
      return;
    }

    // Start aiming
    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;

    if (dist(pos.x, pos.y, cueBall.x, cueBall.y) < BALL_RADIUS * 4) {
      aimingRef.current = true;
      dragStartRef.current = pos;
      dragCurrentRef.current = pos;
      shotPowerRef.current = 0;
      aimAngleRef.current = 0;
    }
  }, [isMyTurn, winner, phase, ballInHand, needsCallPocket, calledPocket, getCanvasPos, currentTurn, groups, pocketedByA, pocketedByB, checkNeedsCallPocket, log]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || !dragStartRef.current) return;
    const pos = getCanvasPos(e);
    dragCurrentRef.current = pos;

    const dx = dragStartRef.current.x - pos.x;
    const dy = dragStartRef.current.y - pos.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    const power = Math.min(dragDist / MAX_DRAG_DISTANCE, 1.0);
    shotPowerRef.current = power;
    aimAngleRef.current = Math.atan2(dy, dx);

    setRenderTick(t => t + 1);
  }, [getCanvasPos]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!aimingRef.current) return;
    aimingRef.current = false;

    const power = shotPowerRef.current * MAX_SHOT_POWER;
    const angle = aimAngleRef.current;

    dragStartRef.current = null;
    dragCurrentRef.current = null;

    if (power < 0.5) {
      // Too weak, cancel
      shotPowerRef.current = 0;
      return;
    }

    executeShot(power, angle);
  }, [executeShot]);

  // ---- Touch handlers (mirror mouse handlers for mobile) ----
  const handleCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isMyTurnRef.current || shootingRef.current || winnerRef.current) return;
    if (phaseRef.current !== 'playing') return;
    const touch = e.touches[0];
    if (!touch) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const pos = { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };

    if (ballInHandRef.current) {
      const cueBall = ballsRef.current.find(b => b.id === 0);
      if (!cueBall) return;
      const nx = Math.max(OFFSET + BALL_RADIUS, Math.min(OFFSET + TABLE_WIDTH - BALL_RADIUS, pos.x));
      const ny = Math.max(OFFSET + BALL_RADIUS, Math.min(OFFSET + TABLE_HEIGHT - BALL_RADIUS, pos.y));
      const overlaps = ballsRef.current.some(b => b.id !== 0 && !b.pocketed && dist(nx, ny, b.x, b.y) < BALL_RADIUS * 2.2);
      if (overlaps) return;
      cueBall.x = nx;
      cueBall.y = ny;
      cueBall.pocketed = false;
      setBallInHand(false);
      const needsCall = checkNeedsCallPocket(currentTurnRef.current, groupsRef.current, pocketedByARef.current, pocketedByBRef.current);
      if (needsCall) {
        setNeedsCallPocket(true);
        setPoolPhase('calling_pocket');
      } else {
        setPoolPhase('aiming');
      }
      setRenderTick(t => t + 1);
      return;
    }

    if (needsCallPocketRef.current && calledPocketRef.current === null) {
      for (let i = 0; i < POCKETS.length; i++) {
        const p = POCKETS[i];
        if (dist(pos.x, pos.y, p.x, p.y) < p.radius + 15) {
          setCalledPocket(i);
          setNeedsCallPocket(false);
          setPoolPhase('aiming');
          return;
        }
      }
      return;
    }

    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;
    if (dist(pos.x, pos.y, cueBall.x, cueBall.y) < BALL_RADIUS * 4) {
      aimingRef.current = true;
      dragStartRef.current = pos;
      dragCurrentRef.current = pos;
      shotPowerRef.current = 0;
      aimAngleRef.current = 0;
    }
  }, [checkNeedsCallPocket]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || !dragStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const pos = { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    dragCurrentRef.current = pos;
    const dx = dragStartRef.current.x - pos.x;
    const dy = dragStartRef.current.y - pos.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    shotPowerRef.current = Math.min(dragDist / MAX_DRAG_DISTANCE, 1.0);
    aimAngleRef.current = Math.atan2(dy, dx);
    setRenderTick(t => t + 1);
  }, []);

  const handleCanvasTouchEnd = useCallback(() => {
    if (!aimingRef.current) return;
    aimingRef.current = false;
    const power = shotPowerRef.current * MAX_SHOT_POWER;
    const angle = aimAngleRef.current;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    if (power < 0.5) {
      shotPowerRef.current = 0;
      return;
    }
    executeShot(power, angle);
  }, [executeShot]);

  // ---- PlayStake integration (same pattern as tictactoe) ----
  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: Player ${r}`, 'info');
    const result = await setup(r);
    if (result) {
      setPhase('lobby');
    }
  }, [setup, log, setPhase]);

  const handleCreateGame = useCallback(async () => {
    if (!authState) return;
    setIsCreating(true);
    const id = await createGame(authState.playerId, 'pool');
    setIsCreating(false);
    if (id) {
      log('Open the widget to create a bet, then consent to lock funds.', 'info');
    }
  }, [authState, createGame, log]);

  const handleJoinGame = useCallback(async (code: string) => {
    if (!authState) return 'Not authenticated';
    setIsJoining(true);
    const result = await joinGame(code, authState.playerId, 'pool');
    setIsJoining(false);
    return result;
  }, [authState, joinGame]);

  const handleBetCreated = useCallback(async (bet: { betId: string; amount: number }) => {
    log(`Bet created: ${bet.betId} ($${(bet.amount / 100).toFixed(2)})`, 'bet');
    betIdRef.current = bet.betId;
    setBetAmountCents(bet.amount);
    if (sessionId) {
      await setBetId(bet.betId);
    }
  }, [sessionId, setBetId, log]);

  const handleBetAccepted = useCallback((bet: { betId: string }) => {
    log('Bet accepted! Match is on!', 'bet');
    betIdRef.current = bet.betId;
  }, [log]);

  const handleBetSettled = useCallback((bet: { outcome: string }) => {
    log(`Bet settled: ${bet.outcome}`, 'bet');
  }, [log]);

  const handlePlayAgain = useCallback(() => {
    window.location.reload();
  }, []);

  // Auto-settle when we detect finish via polling (for the non-moving player)
  const isFinished = phase === 'finished' || gameState?.status === 'finished';
  if (isFinished && !settledRef.current && gameState?.betId && authState) {
    settledRef.current = true;
    const activeBetId = gameState.betId || betIdRef.current;
    if (activeBetId) {
      reportAndSettle(authState.apiKey, activeBetId).then((settle) => {
        if (settle) {
          setSettlementResult(settle as SettlementResult);
          widgetHandleRef.current?.refreshBalance();
        }
      });
    }
  }

  // Start playing poll for Player A
  const playingPollStarted = useRef(false);
  if (phase === 'playing' && role === 'A' && sessionId && !playingPollStarted.current) {
    playingPollStarted.current = true;
    startPlayingPoll(sessionId);
  }

  // Initialize game data when playing starts
  const gameInitRef = useRef(false);
  useEffect(() => {
    if (phase === 'playing' && !gameInitRef.current) {
      gameInitRef.current = true;
      // Reset balls for fresh game
      ballsRef.current = rackBalls();
      setPoolPhase('break');
      setCurrentTurn('A');
      setTurnNumber(0);
      setGroups({ A: null, B: null });
      setPocketedByA([]);
      setPocketedByB([]);
      setWinner(null);
      setWinReason(null);
      setBallInHand(false);
      setCalledPocket(null);
      setNeedsCallPocket(false);
      settledRef.current = false;

      if (role === 'A') {
        syncGameData({ isBreakShot: true });
      }
    }
  }, [phase, role, syncGameData]);

  // ---- Status text ----
  let statusText = '';
  let statusColor = 'text-text-secondary';
  if (phase === 'playing' || phase === 'finished') {
    if (winner) {
      if (winner === role) {
        statusText = 'You Won!';
        statusColor = 'text-brand-400';
      } else {
        statusText = 'You Lost!';
        statusColor = 'text-danger-400';
      }
    } else if (groupAssignedMsg) {
      statusText = groupAssignedMsg;
      statusColor = 'text-brand-400';
    } else if (ballInHand && isMyTurn) {
      const shotLabel = extraShot ? ' (2 shots)' : '';
      statusText = `Ball in Hand${shotLabel} -- Click to place the cue ball`;
      statusColor = 'text-blue-400';
    } else if (needsCallPocket && isMyTurn) {
      statusText = 'Call Your Pocket -- Click a pocket for the 8-ball';
      statusColor = 'text-yellow-400';
    } else if (isMyTurn) {
      const myGroup = role ? groups[role] : null;
      const groupLabel = myGroup ? ` (${myGroup.toUpperCase()})` : '';
      const shotInfo = extraShot ? ' -- 2nd shot' : '';
      statusText = isBreakShot
        ? 'Your Break -- Drag from the cue ball to shoot'
        : `Your Turn${groupLabel}${shotInfo} -- Drag from the cue ball to shoot`;
      statusColor = 'text-brand-400';
    } else {
      statusText = "Opponent's Turn...";
      statusColor = 'text-warning-400';
    }
  }

  // ---- Ball rack display ----
  const solidBalls = [1, 2, 3, 4, 5, 6, 7];
  const stripeBalls = [9, 10, 11, 12, 13, 14, 15];

  const isInGame = phase === 'playing' || phase === 'finished';

  return (
    <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${isInGame ? 'game-fullscreen-mobile' : ''}`}>
      <RotatePrompt isInGame={isInGame} />
      {isInGame && (
        <GameMobileFAB
          onExit={() => window.location.reload()}
          betAmount={betAmountCents || undefined}
          betStatus={gameState?.status === 'finished' ? 'settled' : 'in progress'}
          turnInfo={statusText}
          playerInfo={`Player A${groups.A ? ` (${groups.A})` : ''} vs Player B${groups.B ? ` (${groups.B})` : ''}`}
        >
          <PlayStakeWidget
            widgetToken={authState?.widgetToken ?? null}
            gameId={authState?.gameId ?? null}
          />
        </GameMobileFAB>
      )}
      {/* Header */}
      <div className="game-header mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <Circle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            8-Ball Pool
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Two-player wagered match -- sink the 8-ball to win
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {/* Role selection */}
          {phase === 'role-select' && (
            <RoleSelector onSelect={handleRoleSelect} disabled={isSettingUp} />
          )}

          {/* Setting up indicator */}
          {isSettingUp && (
            <Card padding="sm">
              <p className="font-mono text-xs text-text-muted text-center uppercase tracking-widest">
                Setting up authentication...
              </p>
            </Card>
          )}

          {/* Lobby */}
          {phase === 'lobby' && role && (
            <LobbyPanel
              role={role}
              gameCode={sessionId}
              onCreateGame={handleCreateGame}
              onJoinGame={handleJoinGame}
              isCreating={isCreating}
              isJoining={isJoining}
            />
          )}

          {/* Game board */}
          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Players bar */}
              <Card padding="sm" className="game-players-bar flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: '#f5d800' }}
                    />
                    <span className="font-mono text-xs text-text-secondary">
                      Player A{role === 'A' ? ' (You)' : ''}
                    </span>
                    <span className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      groups.A === 'solids' ? 'bg-yellow-400/15 text-yellow-400'
                        : groups.A === 'stripes' ? 'bg-blue-400/15 text-blue-400'
                        : 'bg-white/5 text-text-muted'
                    }`}>
                      {groups.A ?? '?'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-text-muted">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: '#0055cc' }}
                    />
                    <span className="font-mono text-xs text-text-secondary">
                      Player B{role === 'B' ? ' (You)' : ''}
                    </span>
                    <span className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      groups.B === 'solids' ? 'bg-yellow-400/15 text-yellow-400'
                        : groups.B === 'stripes' ? 'bg-blue-400/15 text-blue-400'
                        : 'bg-white/5 text-text-muted'
                    }`}>
                      {groups.B ?? '?'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Status bar */}
              {statusText && (
                <Card padding="sm" className="game-status-bar">
                  <p className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${statusColor}`}>
                    {statusText}
                  </p>
                </Card>
              )}

              {/* Canvas */}
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="w-full rounded-sm border border-white/8 cursor-crosshair"
                  style={{ maxWidth: `${CANVAS_WIDTH}px`, touchAction: 'none' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasTouchEnd}
                />
              </div>

              {/* Ball rack display */}
              <Card padding="sm" className="game-ball-rack">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-text-muted mr-2 uppercase">Solids</span>
                    {solidBalls.map(id => {
                      const isPocketed = pocketedByA.includes(id) || pocketedByB.includes(id);
                      return (
                        <span
                          key={id}
                          className="inline-block rounded-full border border-white/10"
                          style={{
                            width: 16,
                            height: 16,
                            background: isPocketed ? '#333' : BALL_COLORS[id],
                            opacity: isPocketed ? 0.3 : 1,
                          }}
                        />
                      );
                    })}
                    <span
                      className="inline-block rounded-full border border-white/10 ml-2"
                      style={{
                        width: 16,
                        height: 16,
                        background: (pocketedByA.includes(8) || pocketedByB.includes(8)) ? '#333' : BALL_COLORS[8],
                        opacity: (pocketedByA.includes(8) || pocketedByB.includes(8)) ? 0.3 : 1,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-text-muted mr-2 uppercase">Stripes</span>
                    {stripeBalls.map(id => {
                      const isPocketed = pocketedByA.includes(id) || pocketedByB.includes(id);
                      return (
                        <span
                          key={id}
                          className="inline-block rounded-full border border-white/10"
                          style={{
                            width: 16,
                            height: 16,
                            background: isPocketed ? '#333' : BALL_COLORS[id],
                            opacity: isPocketed ? 0.3 : 1,
                            // Stripe indicator: ring style
                            boxShadow: isPocketed ? 'none' : `inset 0 0 0 4px ${BALL_COLORS[id]}, inset 0 0 0 6px #fff`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Last shot info */}
              {lastShotInfo && (
                <Card padding="sm" className="game-shot-info">
                  <p className="font-mono text-xs text-text-secondary text-center">
                    {lastShotInfo}
                  </p>
                </Card>
              )}

              {/* Result overlay */}
              {isFinished && gameState && winner && (
                settlementResult && role ? (
                  <GameResultOverlay
                    outcome={deriveOutcome(settlementResult, role)}
                    amount={formatResultAmount(
                      deriveOutcome(settlementResult, role),
                      settlementResult.winnerPayout,
                      betAmountCents
                    )}
                    visible
                    onPlayAgain={handlePlayAgain}
                  />
                ) : (
                  <Card
                    padding="sm"
                    className={
                      winner === role
                        ? 'border-brand-400/30 bg-brand-400/5'
                        : 'border-danger-400/30 bg-danger-400/5'
                    }
                  >
                    <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                      <span className={statusColor}>
                        {winner === role
                          ? `Victory! ${winReason || 'You won the match.'}`
                          : `Defeat! ${winReason || 'Better luck next time.'}`}
                      </span>
                    </p>
                  </Card>
                )
              )}
            </>
          )}
        </div>

        {/* Sidebar: Widget + Event Log */}
        <div className="game-sidebar space-y-4">
          <PlayStakeWidget
            ref={widgetHandleRef}
            widgetToken={authState?.widgetToken ?? null}
            gameId={authState?.gameId ?? null}
            onBetCreated={handleBetCreated}
            onBetAccepted={handleBetAccepted}
            onBetSettled={handleBetSettled}
            onError={(err) => log(`Widget error: ${err.message}`, 'error')}
          />
          <EventLog entries={entries} />
        </div>
      </div>
    </div>
  );
}
