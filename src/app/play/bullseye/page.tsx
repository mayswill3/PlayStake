'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Crosshair } from 'lucide-react';
import { useLandscapeLock } from '@/hooks/useLandscapeLock';
import { useSoundEnabled } from '@/hooks/useSoundEnabled';
import { RotatePrompt } from '@/components/ui/RotatePrompt';
import { MobileGameChrome } from '@/components/ui/MobileGameChrome';
import { GameMobileFAB } from '@/components/ui/GameMobileFAB';
import { EffectsManager, generateBurstParticles } from '../_shared/game-effects';
import { GameAudio } from '../_shared/game-audio';
import { useEventLog } from '../_shared/use-event-log';
import { useDemoAuth } from '../_shared/use-demo-auth';
import { useGameSession } from '../_shared/use-game-session';
import { PlayStakeWidget, type PlayStakeWidgetHandle } from '../_shared/PlayStakeWidget';
import { GameResultOverlay, deriveOutcome, formatResultAmount, type SettlementResult } from '../_shared/GameResultOverlay';
import { GameLobbyLayout } from '@/components/games/game-lobby-layout';
import type { LobbyMatchResult } from '@/components/lobby/LobbyContainer';
import { EventLog } from '../_shared/EventLog';
import type { PlayerRole } from '../_shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABLE_WIDTH = 700;
const TABLE_HEIGHT = 340;
const RAIL_WIDTH = 50;
const BALL_RADIUS = 14;
const CANVAS_WIDTH = TABLE_WIDTH + RAIL_WIDTH * 2 + 20;
const CANVAS_HEIGHT = TABLE_HEIGHT + RAIL_WIDTH * 2 + 20;
const OFFSET = RAIL_WIDTH + 10;

// Felt bounds
const FELT_LEFT = OFFSET;
const FELT_RIGHT = OFFSET + TABLE_WIDTH;
const FELT_TOP = OFFSET;
const FELT_BOTTOM = OFFSET + TABLE_HEIGHT;

// Physics
const FRICTION = 0.988;
const MIN_SPEED = 0.1;
const RAIL_RESTITUTION = 0.72;
const MAX_SHOT_POWER = 24;
const MIN_POWER = 1.5;
const MAX_DRAG_DISTANCE = 150;
const TOUCH_OFFSET_Y = 60;
const MIN_DRAG_DISTANCE = 15;
const TOUCH_TARGET_RADIUS = BALL_RADIUS * 8;

// Game
const ROUNDS_TO_WIN = 2;
const ROUND_RESULT_MS = 3000;
const ROUND_TRANSITION_MS = 1500;
const P2_APPEAR_DELAY_MS = 500;

// Bullseye zones
const BULLSEYE_INNER = 16;
const BULLSEYE_MIDDLE = 35;
const BULLSEYE_OUTER = 60;

// Colors
const BG_SURROUND = '#1a2332';
const FELT_COLOR = '#1e8c54';
const PLAYER_COLORS: Record<string, string> = { A: '#16a34a', B: '#2563eb' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Ball {
  id: string; // 'A' or 'B'
  x: number;
  y: number;
  vx: number;
  vy: number;
  moving: boolean;
}

interface BullseyeGameData {
  phase: BullseyePhase;
  roundNumber: number;
  firstShooter: 'A' | 'B';
  bullseye: { x: number; y: number };
  ballA: { x: number; y: number } | null;
  ballB: { x: number; y: number } | null;
  distanceA: number | null;
  distanceB: number | null;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | null;
  lastShot: { player: 'A' | 'B'; angle: number; power: number } | null;
  shotNumber: number;
}

type BullseyePhase =
  | 'round_setup'
  | 'p1_aiming'
  | 'p1_rolling'
  | 'p1_settled'
  | 'p2_aiming'
  | 'p2_rolling'
  | 'round_result'
  | 'round_transition'
  | 'match_over';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.stroke();
}

function estimateStopDistance(power: number): number {
  if (power <= 0) return 0;
  return (power / (1 - FRICTION)) * 0.82;
}

function getGhostBallPosition(cx: number, cy: number, aimAngle: number, power: number): { x: number; y: number } {
  const d = estimateStopDistance(power);
  let gx = cx + Math.cos(aimAngle) * d;
  let gy = cy + Math.sin(aimAngle) * d;
  gx = Math.max(FELT_LEFT + BALL_RADIUS, Math.min(FELT_RIGHT - BALL_RADIUS, gx));
  gy = Math.max(FELT_TOP + BALL_RADIUS, Math.min(FELT_BOTTOM - BALL_RADIUS, gy));
  return { x: gx, y: gy };
}

// Place bullseye in a different quadrant each round
function placeBullseye(prevQuadrant: number | null): { x: number; y: number; quadrant: number } {
  const cx = FELT_LEFT + TABLE_WIDTH / 2;
  const cy = FELT_TOP + TABLE_HEIGHT / 2;
  const margin = 80;
  let quadrant: number;
  do {
    quadrant = Math.floor(Math.random() * 4);
  } while (quadrant === prevQuadrant);

  const offX = (quadrant % 2 === 0 ? -1 : 1) * (Math.random() * (TABLE_WIDTH / 2 - margin - 20) + 20);
  const offY = (quadrant < 2 ? -1 : 1) * (Math.random() * (TABLE_HEIGHT / 2 - margin - 20) + 20);

  return {
    x: Math.max(FELT_LEFT + margin, Math.min(FELT_RIGHT - margin, cx + offX)),
    y: Math.max(FELT_TOP + margin, Math.min(FELT_BOTTOM - margin, cy + offY)),
    quadrant,
  };
}

// ---------------------------------------------------------------------------
// Physics -- single ball, no pockets
// ---------------------------------------------------------------------------
function stepPhysics(ball: Ball, onSettle?: () => void): void {
  if (!ball.moving) return;

  ball.vx *= FRICTION;
  ball.vy *= FRICTION;
  ball.x += ball.vx;
  ball.y += ball.vy;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < MIN_SPEED) {
    ball.vx = 0;
    ball.vy = 0;
    ball.moving = false;
    onSettle?.();
    return;
  }

  // Rail bounces
  if (ball.x - BALL_RADIUS < FELT_LEFT) {
    ball.x = FELT_LEFT + BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * RAIL_RESTITUTION;
  }
  if (ball.x + BALL_RADIUS > FELT_RIGHT) {
    ball.x = FELT_RIGHT - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx) * RAIL_RESTITUTION;
  }
  if (ball.y - BALL_RADIUS < FELT_TOP) {
    ball.y = FELT_TOP + BALL_RADIUS;
    ball.vy = Math.abs(ball.vy) * RAIL_RESTITUTION;
  }
  if (ball.y + BALL_RADIUS > FELT_BOTTOM) {
    ball.y = FELT_BOTTOM - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy) * RAIL_RESTITUTION;
  }
}

// ---------------------------------------------------------------------------
// Drawing functions
// ---------------------------------------------------------------------------
function drawTable(ctx: CanvasRenderingContext2D): void {
  // 1. Dark surround
  ctx.fillStyle = BG_SURROUND;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Outer rail frame -- mahogany rounded rect
  const railGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  railGrad.addColorStop(0, '#8b4020');
  railGrad.addColorStop(0.08, '#6b2c12');
  railGrad.addColorStop(0.5, '#5a2210');
  railGrad.addColorStop(0.92, '#4a1a0a');
  railGrad.addColorStop(1, '#2a0e04');
  ctx.fillStyle = railGrad;
  fillRoundRect(ctx, 6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12, 14);

  // 3. Outer rail dark border
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, 6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12, 14);

  // 4. Inner rail shadow
  ctx.fillStyle = '#3a1608';
  fillRoundRect(ctx, OFFSET - 10, OFFSET - 10, TABLE_WIDTH + 20, TABLE_HEIGHT + 20, 10);

  // 5. Cushion strip -- green rubber
  ctx.fillStyle = '#0f5e30';
  fillRoundRect(ctx, OFFSET - 6, OFFSET - 6, TABLE_WIDTH + 12, TABLE_HEIGHT + 12, 6);

  // 6. Brass accent on cushion outer edge
  ctx.strokeStyle = '#c8a960';
  ctx.lineWidth = 1.5;
  strokeRoundRect(ctx, OFFSET - 6.5, OFFSET - 6.5, TABLE_WIDTH + 13, TABLE_HEIGHT + 13, 6);

  // 7. Felt surface
  ctx.fillStyle = FELT_COLOR;
  ctx.fillRect(FELT_LEFT, FELT_TOP, TABLE_WIDTH, TABLE_HEIGHT);

  // 8. Felt texture -- subtle horizontal lines
  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  ctx.lineWidth = 0.5;
  for (let y = FELT_TOP; y < FELT_BOTTOM; y += 4) {
    ctx.beginPath();
    ctx.moveTo(FELT_LEFT, y);
    ctx.lineTo(FELT_RIGHT, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.015)';
  for (let y = FELT_TOP + 2; y < FELT_BOTTOM; y += 4) {
    ctx.beginPath();
    ctx.moveTo(FELT_LEFT, y);
    ctx.lineTo(FELT_RIGHT, y);
    ctx.stroke();
  }

  // 9. Felt inner shadows for concave depth
  const sh = 20;
  let g = ctx.createLinearGradient(FELT_LEFT, FELT_TOP, FELT_LEFT, FELT_TOP + sh);
  g.addColorStop(0, 'rgba(0,0,0,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(FELT_LEFT, FELT_TOP, TABLE_WIDTH, sh);
  g = ctx.createLinearGradient(FELT_LEFT, FELT_BOTTOM - sh, FELT_LEFT, FELT_BOTTOM);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(FELT_LEFT, FELT_BOTTOM - sh, TABLE_WIDTH, sh);
  g = ctx.createLinearGradient(FELT_LEFT, FELT_TOP, FELT_LEFT + sh, FELT_TOP);
  g.addColorStop(0, 'rgba(0,0,0,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(FELT_LEFT, FELT_TOP, sh, TABLE_HEIGHT);
  g = ctx.createLinearGradient(FELT_RIGHT - sh, FELT_TOP, FELT_RIGHT, FELT_TOP);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(FELT_RIGHT - sh, FELT_TOP, sh, TABLE_HEIGHT);

  // 10. Diamond markers
  ctx.fillStyle = 'rgba(255,215,0,0.5)';
  const topDiamonds = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  for (const f of topDiamonds) {
    ctx.beginPath();
    ctx.arc(FELT_LEFT + TABLE_WIDTH * f, FELT_TOP - RAIL_WIDTH / 2 + 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(FELT_LEFT + TABLE_WIDTH * f, FELT_BOTTOM + RAIL_WIDTH / 2 - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const sideDiamonds = [0.25, 0.5, 0.75];
  for (const f of sideDiamonds) {
    ctx.beginPath();
    ctx.arc(FELT_LEFT - RAIL_WIDTH / 2 + 5, FELT_TOP + TABLE_HEIGHT * f, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(FELT_RIGHT + RAIL_WIDTH / 2 - 5, FELT_TOP + TABLE_HEIGHT * f, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullseye(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_OUTER, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Middle ring
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_MIDDLE, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Inner ring
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_INNER, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Centre dot
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  // Crosshairs
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x - 70, y);
  ctx.lineTo(x + 70, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 70);
  ctx.lineTo(x, y + 70);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball): void {
  const color = PLAYER_COLORS[b.id] || '#888';
  ctx.save();
  // Shadow
  ctx.beginPath();
  ctx.ellipse(b.x + 2, b.y + 3, BALL_RADIUS * 0.9, BALL_RADIUS * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  // Body
  const grad = ctx.createRadialGradient(b.x - 5, b.y - 5, 1, b.x, b.y, BALL_RADIUS);
  grad.addColorStop(0, lightenColor(color, 80));
  grad.addColorStop(0.35, lightenColor(color, 30));
  grad.addColorStop(0.7, color);
  grad.addColorStop(1, lightenColor(color, -40));
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  // Rim
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Specular
  ctx.beginPath();
  ctx.arc(b.x - BALL_RADIUS * 0.28, b.y - BALL_RADIUS * 0.32, BALL_RADIUS * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  // Label circle + letter
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS * 0.40, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.font = "bold 12px 'Sora', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.id, b.x, b.y + 0.5);
  ctx.restore();
}

function drawCueStick(ctx: CanvasRenderingContext2D, ball: Ball, angle: number, power: number): void {
  const stickLen = 180;
  const pullback = 8 + power * 45;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tipX = ball.x - ca * (BALL_RADIUS + pullback);
  const tipY = ball.y - sa * (BALL_RADIUS + pullback);
  const buttX = tipX - ca * stickLen;
  const buttY = tipY - sa * stickLen;

  ctx.save();
  // Dark outline
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(buttX, buttY);
  ctx.stroke();
  // Shaft
  const grad = ctx.createLinearGradient(tipX, tipY, buttX, buttY);
  grad.addColorStop(0, '#f0deb0');
  grad.addColorStop(0.5, '#c8952a');
  grad.addColorStop(0.85, '#6b3a0f');
  grad.addColorStop(1, '#2d1505');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(buttX, buttY);
  ctx.stroke();
  // Blue chalk tip
  ctx.beginPath();
  ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.restore();
}

function drawAimLine(ctx: CanvasRenderingContext2D, ball: Ball, angle: number): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  ctx.save();
  // Find rail intersection
  let minT = 9999;
  if (dx > 0) minT = Math.min(minT, (FELT_RIGHT - BALL_RADIUS - ball.x) / dx);
  if (dx < 0) minT = Math.min(minT, (FELT_LEFT + BALL_RADIUS - ball.x) / dx);
  if (dy > 0) minT = Math.min(minT, (FELT_BOTTOM - BALL_RADIUS - ball.y) / dy);
  if (dy < 0) minT = Math.min(minT, (FELT_TOP + BALL_RADIUS - ball.y) / dy);
  if (minT < 0) minT = 200;
  const endX = ball.x + dx * minT;
  const endY = ball.y + dy * minT;
  // Dashed line
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,0.40)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);
  // Arrow
  const arrowLen = 7;
  const arrowAngle = 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - Math.cos(angle - arrowAngle) * arrowLen, endY - Math.sin(angle - arrowAngle) * arrowLen);
  ctx.lineTo(endX - Math.cos(angle + arrowAngle) * arrowLen, endY - Math.sin(angle + arrowAngle) * arrowLen);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGhostBall(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function drawPowerMeter(ctx: CanvasRenderingContext2D, power: number): void {
  const meterW = 20;
  const meterH = TABLE_HEIGHT - 40;
  const meterX = 10;
  const meterY = OFFSET + 20;
  const r = meterW / 2;
  ctx.save();
  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POWER', meterX + meterW / 2, meterY - 7);
  // Track (capsule)
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  fillRoundRect(ctx, meterX, meterY, meterW, meterH, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, meterX, meterY, meterW, meterH, r);
  if (power > 0.01) {
    const fillH = meterH * power;
    ctx.save();
    // Clip to capsule
    ctx.beginPath();
    ctx.moveTo(meterX + r, meterY);
    ctx.lineTo(meterX + meterW - r, meterY);
    ctx.arcTo(meterX + meterW, meterY, meterX + meterW, meterY + r, r);
    ctx.lineTo(meterX + meterW, meterY + meterH - r);
    ctx.arcTo(meterX + meterW, meterY + meterH, meterX + meterW - r, meterY + meterH, r);
    ctx.lineTo(meterX + r, meterY + meterH);
    ctx.arcTo(meterX, meterY + meterH, meterX, meterY + meterH - r, r);
    ctx.lineTo(meterX, meterY + r);
    ctx.arcTo(meterX, meterY, meterX + r, meterY, r);
    ctx.closePath();
    ctx.clip();
    // Fill gradient
    const grad = ctx.createLinearGradient(0, meterY + meterH, 0, meterY);
    grad.addColorStop(0, '#22c55e');
    grad.addColorStop(0.4, '#22c55e');
    grad.addColorStop(0.65, '#f59e0b');
    grad.addColorStop(0.85, '#ef4444');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(meterX, meterY + meterH - fillH, meterW, fillH);
    // Glow at edge
    const glowColor = power < 0.4 ? '#22c55e' : power < 0.75 ? '#f59e0b' : '#ef4444';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = glowColor;
    ctx.fillRect(meterX + 2, meterY + meterH - fillH - 1, meterW - 4, 3);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  ctx.restore();
}

function drawLeaderLine(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  bullseye: { x: number; y: number },
  distance: number,
  status: 'winner' | 'loser' | 'pending',
): void {
  ctx.save();
  if (status === 'winner') {
    ctx.strokeStyle = PLAYER_COLORS[ball.id] || '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  } else if (status === 'loser') {
    ctx.strokeStyle = 'rgba(255,59,92,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
  }
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y);
  ctx.lineTo(bullseye.x, bullseye.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Distance label
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle =
    status === 'winner'
      ? PLAYER_COLORS[ball.id] || '#fff'
      : status === 'loser'
        ? '#ff3b5c'
        : 'rgba(255,255,255,0.7)';
  ctx.fillText(distance.toFixed(1), ball.x, ball.y - BALL_RADIUS - 6);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BullseyePoolPage() {
  // ---- Standard PlayStake state ----
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('bullseye', log);
  const {
    sessionId,
    gameState,
    phase,
    setPhase,
    joinFromLobby,
    resolveGame,
    setGameData,
    setBetId,
    reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');
  const { isMuted, toggleMute } = useSoundEnabled();

  const effectsRef = useRef<EffectsManager | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  if (!effectsRef.current) effectsRef.current = new EffectsManager();
  if (!audioRef.current) audioRef.current = new GameAudio();

  useEffect(() => {
    audioRef.current?.setMuted(isMuted);
  }, [isMuted]);

  const [showFABPanel, setShowFABPanel] = useState(false);

  // ---- Bullseye game state ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const [gamePhase, setGamePhase] = useState<BullseyePhase>('round_setup');
  const [roundNumber, setRoundNumber] = useState(1);
  const [firstShooter, setFirstShooter] = useState<'A' | 'B'>('A');
  const [bullseye, setBullseye] = useState<{ x: number; y: number }>({
    x: FELT_LEFT + TABLE_WIDTH / 2,
    y: FELT_TOP + TABLE_HEIGHT / 2,
  });
  const [distanceA, setDistanceA] = useState<number | null>(null);
  const [distanceB, setDistanceB] = useState<number | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [, setRenderTick] = useState(0);

  // Aiming state
  const aimingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const shotPowerRef = useRef(0);
  const aimAngleRef = useRef(0);
  const shootingRef = useRef(false);
  const activeTouchIdRef = useRef<number | null>(null);
  const animFrameRef = useRef(0);
  const prevGameDataRef = useRef<BullseyeGameData | null>(null);
  const animatingOpponentRef = useRef(false);
  const opponentBallEndRef = useRef<{ x: number; y: number } | null>(null);
  const shotNumberRef = useRef(0);
  const prevQuadrantRef = useRef<number | null>(null);

  // Refs for reading in callbacks/render loop
  const gamePhaseRef = useRef(gamePhase);
  const phaseRef = useRef(phase);
  const winnerRef = useRef(winner);
  const bullseyeRef = useRef(bullseye);
  const firstShooterRef = useRef(firstShooter);
  const roundNumberRef = useRef(roundNumber);
  const scoreARef = useRef(scoreA);
  const scoreBRef = useRef(scoreB);
  const distanceARef = useRef(distanceA);
  const distanceBRef = useRef(distanceB);
  gamePhaseRef.current = gamePhase;
  phaseRef.current = phase;
  winnerRef.current = winner;
  bullseyeRef.current = bullseye;
  firstShooterRef.current = firstShooter;
  roundNumberRef.current = roundNumber;
  scoreARef.current = scoreA;
  scoreBRef.current = scoreB;
  distanceARef.current = distanceA;
  distanceBRef.current = distanceB;

  // Current shooter based on game phase
  const currentShooter: 'A' | 'B' = (() => {
    if (gamePhase === 'p1_aiming' || gamePhase === 'p1_rolling' || gamePhase === 'p1_settled')
      return firstShooter;
    if (gamePhase === 'p2_aiming' || gamePhase === 'p2_rolling')
      return firstShooter === 'A' ? 'B' : 'A';
    return firstShooter;
  })();

  const isMyTurn = currentShooter === role;

  const AIMING_PHASES: BullseyePhase[] = ['p1_aiming', 'p2_aiming'];
  const canShoot =
    isMyTurn &&
    !shootingRef.current &&
    phase === 'playing' &&
    !winner &&
    AIMING_PHASES.includes(gamePhase);

  const canShootRef = useRef(canShoot);
  canShootRef.current = canShoot;

  // ---- Sync game data to server ----
  const syncGameData = useCallback(
    (overrides?: Partial<BullseyeGameData>) => {
      const ballA = ballsRef.current.find((b) => b.id === 'A');
      const ballB = ballsRef.current.find((b) => b.id === 'B');
      const data: BullseyeGameData = {
        phase: gamePhaseRef.current,
        roundNumber: roundNumberRef.current,
        firstShooter: firstShooterRef.current,
        bullseye: bullseyeRef.current,
        ballA: ballA ? { x: ballA.x, y: ballA.y } : null,
        ballB: ballB ? { x: ballB.x, y: ballB.y } : null,
        distanceA: distanceARef.current,
        distanceB: distanceBRef.current,
        scoreA: scoreARef.current,
        scoreB: scoreBRef.current,
        winner: winnerRef.current,
        lastShot: null,
        shotNumber: shotNumberRef.current,
        ...overrides,
      };
      setGameData(data as unknown as Record<string, unknown>);
    },
    [setGameData],
  );

  // ---- Settle winner ----
  const settleWinner = useCallback(
    (w: 'A' | 'B') => {
      setWinner(w);
      winnerRef.current = w;
      setGamePhase('match_over');
      gamePhaseRef.current = 'match_over';

      if (w === role) {
        effectsRef.current?.spawn({
          type: 'particleBurst',
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          duration: 1500,
          particles: generateBurstParticles(60, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        });
        audioRef.current?.playWinChime();
      }

      resolveGame(w).then(() => {
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

      syncGameData({ phase: 'match_over', winner: w });
    },
    [resolveGame, gameState, authState, reportAndSettle, syncGameData, role],
  );

  // ---- Start a new round ----
  const startRound = useCallback(
    (
      roundNum: number,
      sA: number,
      sB: number,
      prevQ: number | null,
      shooter: 'A' | 'B',
    ) => {
      const bsData = placeBullseye(prevQ);
      prevQuadrantRef.current = bsData.quadrant;
      setBullseye({ x: bsData.x, y: bsData.y });
      bullseyeRef.current = { x: bsData.x, y: bsData.y };

      setRoundNumber(roundNum);
      roundNumberRef.current = roundNum;
      setFirstShooter(shooter);
      firstShooterRef.current = shooter;
      setDistanceA(null);
      setDistanceB(null);
      distanceARef.current = null;
      distanceBRef.current = null;

      // Create first shooter's ball at starting position (left quarter)
      const startX = FELT_LEFT + TABLE_WIDTH * 0.2;
      const startY = FELT_TOP + TABLE_HEIGHT / 2;
      ballsRef.current = [
        { id: shooter, x: startX, y: startY, vx: 0, vy: 0, moving: false },
      ];

      setGamePhase('p1_aiming');
      gamePhaseRef.current = 'p1_aiming';

      log(
        `Round ${roundNum} -- ${shooter === role ? 'You shoot' : 'Opponent shoots'} first`,
        'info',
      );

      syncGameData({
        phase: 'p1_aiming',
        roundNumber: roundNum,
        firstShooter: shooter,
        bullseye: { x: bsData.x, y: bsData.y },
        ballA: shooter === 'A' ? { x: startX, y: startY } : null,
        ballB: shooter === 'B' ? { x: startX, y: startY } : null,
        distanceA: null,
        distanceB: null,
        scoreA: sA,
        scoreB: sB,
      });
    },
    [log, role, syncGameData],
  );

  // ---- Execute shot ----
  const executeShot = useCallback(
    (power: number, angle: number) => {
      if (shootingRef.current) return;
      shootingRef.current = true;

      const gp = gamePhaseRef.current;
      const shooterId: 'A' | 'B' = (() => {
        if (gp === 'p1_aiming') return firstShooterRef.current;
        if (gp === 'p2_aiming')
          return firstShooterRef.current === 'A' ? 'B' as const : 'A' as const;
        return 'A' as const;
      })();

      const ball = ballsRef.current.find((b) => b.id === shooterId);
      if (!ball) {
        shootingRef.current = false;
        return;
      }

      // Set rolling phase
      if (gp === 'p1_aiming') {
        setGamePhase('p1_rolling');
        gamePhaseRef.current = 'p1_rolling';
      } else if (gp === 'p2_aiming') {
        setGamePhase('p2_rolling');
        gamePhaseRef.current = 'p2_rolling';
      }

      ball.vx = Math.cos(angle) * power;
      ball.vy = Math.sin(angle) * power;
      ball.moving = true;

      audioRef.current?.ensureContext();
      effectsRef.current?.spawn({
        type: 'impact',
        x: ball.x + Math.cos(angle) * BALL_RADIUS,
        y: ball.y + Math.sin(angle) * BALL_RADIUS,
        angle: angle + Math.PI,
        intensity: power / MAX_SHOT_POWER,
        duration: 120,
      });
      audioRef.current?.playStrike(power / MAX_SHOT_POWER);

      shotNumberRef.current++;
      const shotNum = shotNumberRef.current;
      const lastShotData = { player: shooterId, angle, power };

      let settled = false;
      const simulateStart = performance.now();
      const handleSettle = () => {
        settled = true;
      };

      const simulate = () => {
        if (performance.now() - simulateStart > 5000) {
          console.warn('Force settle -- ball did not reach rest within 5s');
          ball.vx = 0;
          ball.vy = 0;
          ball.moving = false;
          settled = true;
        } else {
          for (let i = 0; i < 2; i++) {
            stepPhysics(ball, handleSettle);
          }
        }

        if (!settled) {
          requestAnimationFrame(simulate);
          return;
        }

        shootingRef.current = false;

        // Measure distance to bullseye
        const d = dist(ball.x, ball.y, bullseyeRef.current.x, bullseyeRef.current.y);

        // Play bullseye settle sound
        audioRef.current?.playBullseyeSettle(d);

        // Spawn landing effect
        if (d <= BULLSEYE_INNER) {
          effectsRef.current?.spawn({
            type: 'bullseyeLanding',
            x: ball.x,
            y: ball.y,
            zone: 'inner',
            duration: 400,
          });
        } else if (d <= BULLSEYE_MIDDLE) {
          effectsRef.current?.spawn({
            type: 'bullseyeLanding',
            x: ball.x,
            y: ball.y,
            zone: 'middle',
            duration: 300,
          });
        }

        log(
          `${shooterId === role ? 'You' : 'Opponent'}: Distance ${d.toFixed(1)}`,
          d < 30 ? 'success' : 'info',
        );

        const currentGP = gamePhaseRef.current;

        if (currentGP === 'p1_rolling') {
          // First shooter done
          if (shooterId === 'A') {
            setDistanceA(d);
            distanceARef.current = d;
          } else {
            setDistanceB(d);
            distanceBRef.current = d;
          }

          setGamePhase('p1_settled');
          gamePhaseRef.current = 'p1_settled';

          // After a short delay, set up second shooter
          setTimeout(() => {
            const secondShooter: 'A' | 'B' =
              firstShooterRef.current === 'A' ? 'B' : 'A';
            const startX = FELT_LEFT + TABLE_WIDTH * 0.2;
            const startY = FELT_TOP + TABLE_HEIGHT / 2;
            ballsRef.current.push({
              id: secondShooter,
              x: startX,
              y: startY,
              vx: 0,
              vy: 0,
              moving: false,
            });

            setGamePhase('p2_aiming');
            gamePhaseRef.current = 'p2_aiming';

            syncGameData({
              phase: 'p2_aiming',
              distanceA: shooterId === 'A' ? d : distanceARef.current,
              distanceB: shooterId === 'B' ? d : distanceBRef.current,
              ballA: shooterId === 'A' ? { x: ball.x, y: ball.y } : null,
              ballB: shooterId === 'B' ? { x: ball.x, y: ball.y } : null,
              lastShot: lastShotData,
              shotNumber: shotNum,
            });
          }, P2_APPEAR_DELAY_MS);
        } else if (currentGP === 'p2_rolling') {
          // Second shooter done -- determine round winner
          if (shooterId === 'A') {
            setDistanceA(d);
            distanceARef.current = d;
          } else {
            setDistanceB(d);
            distanceBRef.current = d;
          }

          const dA = shooterId === 'A' ? d : distanceARef.current;
          const dB = shooterId === 'B' ? d : distanceBRef.current;

          setGamePhase('round_result');
          gamePhaseRef.current = 'round_result';

          syncGameData({
            phase: 'round_result',
            distanceA: dA,
            distanceB: dB,
            ballA: shooterId === 'A' ? { x: ball.x, y: ball.y } : undefined,
            ballB: shooterId === 'B' ? { x: ball.x, y: ball.y } : undefined,
            lastShot: lastShotData,
            shotNumber: shotNum,
          });

          // Determine round winner after display period
          setTimeout(() => {
            const finalDA = dA ?? Infinity;
            const finalDB = dB ?? Infinity;
            let roundWinner: 'A' | 'B';
            if (finalDA < finalDB) {
              roundWinner = 'A';
            } else if (finalDB < finalDA) {
              roundWinner = 'B';
            } else {
              // Exact tie -- first shooter advantage
              roundWinner = firstShooterRef.current;
            }

            const newScoreA = scoreARef.current + (roundWinner === 'A' ? 1 : 0);
            const newScoreB = scoreBRef.current + (roundWinner === 'B' ? 1 : 0);
            setScoreA(newScoreA);
            setScoreB(newScoreB);
            scoreARef.current = newScoreA;
            scoreBRef.current = newScoreB;

            log(
              `Round ${roundNumberRef.current}: ${roundWinner === role ? 'You' : 'Opponent'} win! (${finalDA.toFixed(1)} vs ${finalDB.toFixed(1)})`,
              roundWinner === role ? 'success' : 'error',
            );

            // Check for match winner
            if (newScoreA >= ROUNDS_TO_WIN) {
              settleWinner('A');
            } else if (newScoreB >= ROUNDS_TO_WIN) {
              settleWinner('B');
            } else {
              // Start next round after transition
              setGamePhase('round_transition');
              gamePhaseRef.current = 'round_transition';

              syncGameData({
                phase: 'round_transition',
                scoreA: newScoreA,
                scoreB: newScoreB,
                shotNumber: shotNum,
              });

              setTimeout(() => {
                // Alternate first shooter
                const nextShooter: 'A' | 'B' =
                  firstShooterRef.current === 'A' ? 'B' : 'A';
                startRound(
                  roundNumberRef.current + 1,
                  newScoreA,
                  newScoreB,
                  prevQuadrantRef.current,
                  nextShooter,
                );
              }, ROUND_TRANSITION_MS);
            }
          }, ROUND_RESULT_MS);
        }
      };

      requestAnimationFrame(simulate);
    },
    [log, role, syncGameData, settleWinner, startRound],
  );

  // ---- Initialize game when phase becomes 'playing' ----
  const gameInitRef = useRef(false);
  useEffect(() => {
    if (phase === 'playing' && !gameInitRef.current) {
      gameInitRef.current = true;
      setScoreA(0);
      setScoreB(0);
      scoreARef.current = 0;
      scoreBRef.current = 0;
      setWinner(null);
      winnerRef.current = null;
      settledRef.current = false;
      shotNumberRef.current = 0;
      prevQuadrantRef.current = null;
      ballsRef.current = [];

      if (role === 'A') {
        startRound(1, 0, 0, null, 'A');
      }
    }
  }, [phase, role, startRound]);

  // ---- Poll for opponent state changes ----
  useEffect(() => {
    if (!gameState?.gameData) return;
    const data = gameState.gameData as unknown as BullseyeGameData;
    if (data.shotNumber == null) return;

    const prev = prevGameDataRef.current;

    if (!prev || data.shotNumber > prev.shotNumber || data.phase !== prev.phase) {
      // Update bullseye position
      if (data.bullseye) {
        setBullseye(data.bullseye);
        bullseyeRef.current = data.bullseye;
      }

      // Update scores
      setScoreA(data.scoreA);
      setScoreB(data.scoreB);
      scoreARef.current = data.scoreA;
      scoreBRef.current = data.scoreB;
      setRoundNumber(data.roundNumber);
      roundNumberRef.current = data.roundNumber;
      setFirstShooter(data.firstShooter);
      firstShooterRef.current = data.firstShooter;

      if (data.distanceA != null) {
        setDistanceA(data.distanceA);
        distanceARef.current = data.distanceA;
      }
      if (data.distanceB != null) {
        setDistanceB(data.distanceB);
        distanceBRef.current = data.distanceB;
      }

      // Replay opponent shot if there is a lastShot from opponent
      if (
        data.lastShot &&
        data.lastShot.player !== role &&
        data.shotNumber > (prev?.shotNumber ?? 0)
      ) {
        const ls = data.lastShot;
        // Find or create the opponent ball
        let opBall = ballsRef.current.find((b) => b.id === ls.player);
        if (!opBall) {
          opBall = {
            id: ls.player,
            x: FELT_LEFT + TABLE_WIDTH * 0.2,
            y: FELT_TOP + TABLE_HEIGHT / 2,
            vx: 0,
            vy: 0,
            moving: false,
          };
          ballsRef.current.push(opBall);
        } else {
          // Reset to start position for replay
          opBall.x = FELT_LEFT + TABLE_WIDTH * 0.2;
          opBall.y = FELT_TOP + TABLE_HEIGHT / 2;
        }
        opBall.vx = Math.cos(ls.angle) * ls.power;
        opBall.vy = Math.sin(ls.angle) * ls.power;
        opBall.moving = true;
        animatingOpponentRef.current = true;

        // Store expected end position
        if (ls.player === 'A' && data.ballA) {
          opponentBallEndRef.current = data.ballA;
        } else if (ls.player === 'B' && data.ballB) {
          opponentBallEndRef.current = data.ballB;
        }
      } else {
        // Just snap ball positions
        if (data.ballA) {
          let ballA = ballsRef.current.find((b) => b.id === 'A');
          if (!ballA) {
            ballA = {
              id: 'A',
              x: data.ballA.x,
              y: data.ballA.y,
              vx: 0,
              vy: 0,
              moving: false,
            };
            ballsRef.current.push(ballA);
          } else {
            ballA.x = data.ballA.x;
            ballA.y = data.ballA.y;
            ballA.vx = 0;
            ballA.vy = 0;
            ballA.moving = false;
          }
        }
        if (data.ballB) {
          let ballB = ballsRef.current.find((b) => b.id === 'B');
          if (!ballB) {
            ballB = {
              id: 'B',
              x: data.ballB.x,
              y: data.ballB.y,
              vx: 0,
              vy: 0,
              moving: false,
            };
            ballsRef.current.push(ballB);
          } else {
            ballB.x = data.ballB.x;
            ballB.y = data.ballB.y;
            ballB.vx = 0;
            ballB.vy = 0;
            ballB.moving = false;
          }
        }
      }

      // If transitioning to p1_aiming in a new round and no balls for shooter
      if (data.phase === 'p1_aiming') {
        const shooterBall = ballsRef.current.find(
          (b) => b.id === data.firstShooter,
        );
        if (!shooterBall) {
          ballsRef.current = [
            {
              id: data.firstShooter,
              x: FELT_LEFT + TABLE_WIDTH * 0.2,
              y: FELT_TOP + TABLE_HEIGHT / 2,
              vx: 0,
              vy: 0,
              moving: false,
            },
          ];
        }
        // Reset distances for new round
        setDistanceA(null);
        setDistanceB(null);
        distanceARef.current = null;
        distanceBRef.current = null;
      }

      // If transitioning to p2_aiming, ensure second shooter ball exists
      if (data.phase === 'p2_aiming') {
        const secondShooter = data.firstShooter === 'A' ? 'B' : 'A';
        const secondBall = ballsRef.current.find((b) => b.id === secondShooter);
        if (!secondBall) {
          ballsRef.current.push({
            id: secondShooter,
            x: FELT_LEFT + TABLE_WIDTH * 0.2,
            y: FELT_TOP + TABLE_HEIGHT / 2,
            vx: 0,
            vy: 0,
            moving: false,
          });
        }
      }

      setGamePhase(data.phase);
      gamePhaseRef.current = data.phase;

      if (data.winner) {
        setWinner(data.winner);
        winnerRef.current = data.winner;
        setGamePhase('match_over');
        gamePhaseRef.current = 'match_over';
      }
    }

    prevGameDataRef.current = data;
  }, [gameState, role]);

  // ---- Auto-settle when finished detected via polling ----
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

  // ---- Canvas render loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const render = () => {
      animFrameRef.current++;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = BG_SURROUND;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawTable(ctx);

      // Draw bullseye
      const bs = bullseyeRef.current;
      drawBullseye(ctx, bs.x, bs.y);

      // Animate opponent ball if replaying
      if (animatingOpponentRef.current) {
        const movingBalls = ballsRef.current.filter((b) => b.moving);
        for (const mb of movingBalls) {
          for (let i = 0; i < 2; i++) {
            stepPhysics(mb);
          }
        }

        if (!ballsRef.current.some((b) => b.moving)) {
          animatingOpponentRef.current = false;
          // Snap to final position
          if (opponentBallEndRef.current) {
            // Find the ball that was just animating (the opponent)
            for (const b of ballsRef.current) {
              if (b.id !== role) {
                if (
                  (b.id === 'A' && opponentBallEndRef.current) ||
                  (b.id === 'B' && opponentBallEndRef.current)
                ) {
                  b.x = opponentBallEndRef.current.x;
                  b.y = opponentBallEndRef.current.y;
                }
              }
            }
            opponentBallEndRef.current = null;
          }
        }
      }

      const now = performance.now();

      // Draw balls
      for (const b of ballsRef.current) {
        drawBall(ctx, b);
      }

      // Draw leader lines when distances are available
      const gp = gamePhaseRef.current;
      const showDistances =
        gp === 'p1_settled' ||
        gp === 'p2_aiming' ||
        gp === 'p2_rolling' ||
        gp === 'round_result' ||
        gp === 'round_transition' ||
        gp === 'match_over';

      if (showDistances) {
        const dA = distanceARef.current;
        const dB = distanceBRef.current;
        const ballA = ballsRef.current.find((b) => b.id === 'A');
        const ballB = ballsRef.current.find((b) => b.id === 'B');

        if (ballA && dA != null) {
          const statusA: 'winner' | 'loser' | 'pending' =
            dB != null ? (dA <= dB ? 'winner' : 'loser') : 'pending';
          drawLeaderLine(ctx, ballA, bs, dA, statusA);
        }
        if (ballB && dB != null) {
          const statusB: 'winner' | 'loser' | 'pending' =
            dA != null ? (dB <= dA ? 'winner' : 'loser') : 'pending';
          drawLeaderLine(ctx, ballB, bs, dB, statusB);
        }
      }

      // Aiming visuals
      if (
        canShootRef.current &&
        aimingRef.current &&
        dragStartRef.current &&
        dragCurrentRef.current
      ) {
        const shooterId: string =
          gamePhaseRef.current === 'p1_aiming'
            ? firstShooterRef.current
            : firstShooterRef.current === 'A'
              ? 'B'
              : 'A';
        const myBall = ballsRef.current.find((b) => b.id === shooterId);
        if (myBall) {
          drawAimLine(ctx, myBall, aimAngleRef.current);
          drawCueStick(ctx, myBall, aimAngleRef.current, shotPowerRef.current);
          drawPowerMeter(ctx, shotPowerRef.current);

          // Ghost ball
          const ghost = getGhostBallPosition(
            myBall.x,
            myBall.y,
            aimAngleRef.current,
            shotPowerRef.current * MAX_SHOT_POWER,
          );
          drawGhostBall(ctx, ghost.x, ghost.y, PLAYER_COLORS[shooterId] || '#fff');
        }
      }

      effectsRef.current?.render(ctx, now);

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [phase]); // Only recreate when entering/exiting game -- volatile state read via refs

  // ---- Canvas mouse helpers ----
  const getCanvasPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const getMyBall = useCallback((): Ball | undefined => {
    const gp = gamePhaseRef.current;
    const shooterId =
      gp === 'p1_aiming'
        ? firstShooterRef.current
        : firstShooterRef.current === 'A'
          ? 'B'
          : 'A';
    return ballsRef.current.find((b) => b.id === shooterId);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (
        shootingRef.current ||
        winnerRef.current ||
        phaseRef.current !== 'playing'
      )
        return;
      if (!AIMING_PHASES.includes(gamePhaseRef.current)) return;
      if (!canShootRef.current) return;

      const pos = getCanvasPos(e);
      const myBall = getMyBall();
      if (!myBall) return;

      if (dist(pos.x, pos.y, myBall.x, myBall.y) < BALL_RADIUS * 4) {
        aimingRef.current = true;
        dragStartRef.current = pos;
        dragCurrentRef.current = pos;
        shotPowerRef.current = 0;
        aimAngleRef.current = 0;
        audioRef.current?.ensureContext();
      }
    },
    [getCanvasPos, getMyBall],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!aimingRef.current || !dragStartRef.current) return;
      const pos = getCanvasPos(e);
      dragCurrentRef.current = pos;

      const dx = dragStartRef.current.x - pos.x;
      const dy = dragStartRef.current.y - pos.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);
      shotPowerRef.current = Math.min(dragDist / MAX_DRAG_DISTANCE, 1.0);
      aimAngleRef.current = Math.atan2(dy, dx);

      setRenderTick((t) => t + 1);
    },
    [getCanvasPos],
  );

  const handleMouseUp = useCallback(() => {
    if (!aimingRef.current) return;
    aimingRef.current = false;

    const power = shotPowerRef.current * MAX_SHOT_POWER;
    const angle = aimAngleRef.current;

    dragStartRef.current = null;
    dragCurrentRef.current = null;

    if (power < MIN_POWER) {
      shotPowerRef.current = 0;
      return;
    }

    shotPowerRef.current = 0;
    executeShot(power, angle);
  }, [executeShot]);

  // ---- Touch handlers ----
  const getTouchCanvasPos = useCallback(
    (clientX: number, clientY: number, applyOffset: boolean = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const pos = {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
      if (applyOffset) pos.y -= TOUCH_OFFSET_Y;
      return pos;
    },
    [],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (shootingRef.current || winnerRef.current) return;
      if (phaseRef.current !== 'playing') return;
      if (!AIMING_PHASES.includes(gamePhaseRef.current)) return;
      if (!canShootRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;
      if (activeTouchIdRef.current !== null) return;

      const pos = getTouchCanvasPos(touch.clientX, touch.clientY, true);
      if (!pos) return;

      const myBall = getMyBall();
      if (!myBall) return;

      if (dist(pos.x, pos.y, myBall.x, myBall.y) < TOUCH_TARGET_RADIUS) {
        activeTouchIdRef.current = touch.identifier;
        aimingRef.current = true;
        dragStartRef.current = pos;
        dragCurrentRef.current = pos;
        shotPowerRef.current = 0;
        aimAngleRef.current = 0;
        audioRef.current?.ensureContext();
      }
    },
    [getTouchCanvasPos, getMyBall],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!aimingRef.current || !dragStartRef.current) return;
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === activeTouchIdRef.current,
      );
      if (!touch) return;
      const pos = getTouchCanvasPos(touch.clientX, touch.clientY, true);
      if (!pos) return;
      dragCurrentRef.current = pos;
      const dx = dragStartRef.current.x - pos.x;
      const dy = dragStartRef.current.y - pos.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);
      shotPowerRef.current = Math.min(dragDist / MAX_DRAG_DISTANCE, 1.0);
      aimAngleRef.current = Math.atan2(dy, dx);
      setRenderTick((t) => t + 1);
    },
    [getTouchCanvasPos],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === activeTouchIdRef.current,
      );
      if (!touch) return;
      activeTouchIdRef.current = null;

      if (!aimingRef.current) {
        dragStartRef.current = null;
        dragCurrentRef.current = null;
        shotPowerRef.current = 0;
        return;
      }

      aimingRef.current = false;
      const start = dragStartRef.current;
      const current = dragCurrentRef.current;
      dragStartRef.current = null;
      dragCurrentRef.current = null;

      if (!start || !current) {
        shotPowerRef.current = 0;
        return;
      }

      const dx = start.x - current.x;
      const dy = start.y - current.y;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_DISTANCE) {
        shotPowerRef.current = 0;
        return;
      }

      const power = shotPowerRef.current * MAX_SHOT_POWER;
      const angle = aimAngleRef.current;
      shotPowerRef.current = 0;
      executeShot(power, angle);
    },
    [executeShot],
  );

  const handleTouchCancel = useCallback(() => {
    activeTouchIdRef.current = null;
    aimingRef.current = false;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    shotPowerRef.current = 0;
  }, []);

  // Register native non-passive touch listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevent = (e: Event) => e.preventDefault();
    canvas.addEventListener('touchstart', prevent, { passive: false });
    canvas.addEventListener('touchmove', prevent, { passive: false });
    canvas.addEventListener('touchend', prevent, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', prevent);
      canvas.removeEventListener('touchmove', prevent);
      canvas.removeEventListener('touchend', prevent);
    };
  }, []);

  // ---- PlayStake integration ----
  const handleRoleSelect = useCallback(
    async (r: PlayerRole) => {
      setRole(r);
      log(`Selected role: Player ${r}`, 'info');
      const result = await setup(r);
      if (result) {
        setPhase('lobby');
      }
    },
    [setup, log, setPhase],
  );

  const handleMatched = useCallback(
    async (match: LobbyMatchResult) => {
      if (!authState) return;
      log(`Match locked in -- bet ${match.betId.slice(0, 8)}...`, 'bet');
      betIdRef.current = match.betId;
      setBetAmountCents(match.stakeCents);
      await joinFromLobby({
        betId: match.betId,
        myRole: match.myRole,
        playerId: authState.playerId,
        playerAId: match.playerAUserId,
        gameType: 'bullseye',
      });
    },
    [authState, joinFromLobby, log],
  );

  const handleBetCreated = useCallback(
    async (bet: { betId: string; amount: number }) => {
      log(
        `Bet created: ${bet.betId} ($${(bet.amount / 100).toFixed(2)})`,
        'bet',
      );
      betIdRef.current = bet.betId;
      setBetAmountCents(bet.amount);
      if (sessionId) {
        await setBetId(bet.betId);
      }
    },
    [sessionId, setBetId, log],
  );

  const handleBetAccepted = useCallback(
    (bet: { betId: string }) => {
      log('Bet accepted!', 'bet');
      betIdRef.current = bet.betId;
    },
    [log],
  );

  const handleBetSettled = useCallback(
    (bet: { outcome: string }) => {
      log(`Bet settled: ${bet.outcome}`, 'bet');
    },
    [log],
  );

  // ---- Status text ----
  let statusMsg = '';
  let statusColor = 'text-text-secondary';

  if (phase === 'playing' || phase === 'finished') {
    if (winner) {
      statusMsg = winner === role ? 'You Won!' : 'You Lost!';
      statusColor = winner === role ? 'text-brand-400' : 'text-danger-400';
    } else if (gamePhase === 'round_setup') {
      statusMsg = 'Setting up round...';
    } else if (gamePhase === 'p1_aiming') {
      statusMsg = isMyTurn
        ? 'YOUR SHOT -- Drag from the ball to aim'
        : 'Opponent is aiming...';
      statusColor = isMyTurn ? 'text-brand-400' : 'text-warning-400';
    } else if (gamePhase === 'p1_rolling') {
      statusMsg = '';
    } else if (gamePhase === 'p1_settled') {
      const shooterIsA = firstShooter === 'A';
      const d = shooterIsA ? distanceA : distanceB;
      statusMsg =
        d != null
          ? `Distance: ${d.toFixed(1)} -- Waiting for second shot`
          : 'Ball settled';
      statusColor = 'text-blue-400';
    } else if (gamePhase === 'p2_aiming') {
      statusMsg = isMyTurn
        ? 'YOUR SHOT -- Get closer to the bullseye!'
        : 'Opponent is aiming...';
      statusColor = isMyTurn ? 'text-brand-400' : 'text-warning-400';
    } else if (gamePhase === 'p2_rolling') {
      statusMsg = '';
    } else if (gamePhase === 'round_result') {
      const dA = distanceA ?? Infinity;
      const dB = distanceB ?? Infinity;
      const rWinner = dA < dB ? 'A' : dB < dA ? 'B' : firstShooter;
      statusMsg =
        rWinner === role
          ? `You win the round! (${dA.toFixed(1)} vs ${dB.toFixed(1)})`
          : `Opponent wins the round! (${dA.toFixed(1)} vs ${dB.toFixed(1)})`;
      statusColor = rWinner === role ? 'text-brand-400' : 'text-danger-400';
    } else if (gamePhase === 'round_transition') {
      statusMsg = 'Next round starting...';
      statusColor = 'text-blue-400';
    } else if (gamePhase === 'match_over') {
      statusMsg = winner === role ? 'Match Won!' : 'Match Lost!';
      statusColor = winner === role ? 'text-brand-400' : 'text-danger-400';
    }
  }

  const isInGame = phase === 'playing' || phase === 'finished';

  // Mobile status
  let mobileStatusMsg = '';
  if (isInGame) {
    if (winner) {
      mobileStatusMsg = winner === role ? 'You win!' : 'Opponent wins!';
    } else if (isMyTurn && canShoot) {
      mobileStatusMsg = `Round ${roundNumber} -- Your shot!`;
    } else if (!isMyTurn) {
      mobileStatusMsg = "Opponent's turn...";
    } else if (gamePhase === 'round_result') {
      mobileStatusMsg = 'Round complete';
    } else if (gamePhase === 'round_transition') {
      mobileStatusMsg = 'Next round...';
    }
  }

  // Round trackers for mobile HUD
  const maxRounds = ROUNDS_TO_WIN * 2 - 1;
  const p1Tracker = (
    <div className="flex gap-1">
      {Array.from({ length: maxRounds }).map((_, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 8,
            height: 8,
            background: i < scoreA ? '#00ff87' : 'transparent',
            border: '1.5px solid rgba(255,255,255,0.4)',
          }}
        />
      ))}
    </div>
  );

  const p2Tracker = (
    <div className="flex gap-1">
      {Array.from({ length: maxRounds }).map((_, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 8,
            height: 8,
            background: i < scoreB ? '#00ff87' : 'transparent',
            border: '1.5px solid rgba(255,255,255,0.4)',
          }}
        />
      ))}
    </div>
  );

  const wagerDisplay =
    betAmountCents > 0
      ? `$${(betAmountCents / 100).toFixed(2)}`
      : undefined;

  // ---- Pre-game lobby ----
  if (!isInGame) {
    return (
      <GameLobbyLayout
        gameKey="bullseye"
        phase={
          phase === 'role-select' || phase === 'lobby' ? phase : 'role-select'
        }
        role={role}
        isSettingUp={isSettingUp}
        onRoleSelect={handleRoleSelect}
        myUserId={authState?.playerId ?? ''}
        myDisplayName={authState?.displayName ?? 'Player'}
        onMatched={handleMatched}
        events={entries}
      />
    );
  }

  // ---- In-game render ----
  return (
    <div
      className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${isInGame ? 'game-fullscreen-mobile' : ''}`}
    >
      <RotatePrompt isInGame={isInGame} />
      {isInGame && showFABPanel && (
        <GameMobileFAB
          onExit={() => window.location.reload()}
          onClose={() => setShowFABPanel(false)}
          betAmount={betAmountCents || undefined}
          betStatus={
            gameState?.status === 'finished' ? 'settled' : 'in progress'
          }
          turnInfo={statusMsg}
          playerInfo={`P1: ${scoreA} | P2: ${scoreB}`}
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
          <Crosshair className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Bullseye Pool
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Land closest to the target -- best of 3
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Players bar */}
              <Card padding="sm" className="game-players-bar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* P1 score */}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: PLAYER_COLORS.A }}
                      />
                      <span className="font-mono text-xs text-text-secondary">
                        P1{role === 'A' ? ' (You)' : ''}
                      </span>
                      <span className="font-display text-lg font-bold text-text-primary">
                        {scoreA}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-text-muted">
                      vs
                    </span>

                    {/* P2 score */}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: PLAYER_COLORS.B }}
                      />
                      <span className="font-mono text-xs text-text-secondary">
                        P2{role === 'B' ? ' (You)' : ''}
                      </span>
                      <span className="font-display text-lg font-bold text-text-primary">
                        {scoreB}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Round number */}
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-text-muted">
                      RD {roundNumber} / {maxRounds}
                    </span>

                    {/* Turn indicator */}
                    {!winner && (
                      <span
                        className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{
                          background: isMyTurn
                            ? 'rgba(0,255,135,0.15)'
                            : 'rgba(255,184,0,0.15)',
                          color: isMyTurn ? '#00ff87' : '#f59e0b',
                        }}
                      >
                        {isMyTurn ? 'YOUR TURN' : 'WAITING'}
                      </span>
                    )}

                    {/* Wager display */}
                    {betAmountCents > 0 && (
                      <span className="font-mono text-[10px] text-text-muted uppercase">
                        STAKE: ${(betAmountCents / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </Card>

              {/* Status bar */}
              {statusMsg && (
                <Card padding="sm" className="game-status-bar">
                  <p
                    className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${statusColor}`}
                  >
                    {statusMsg}
                  </p>
                </Card>
              )}

              {/* Canvas wrapped with MobileGameChrome */}
              <MobileGameChrome
                player1Name={role === 'A' ? 'You' : 'Player 1'}
                player2Name={role === 'B' ? 'You' : 'Player 2'}
                isPlayer1Turn={currentShooter === 'A'}
                player1Tracker={p1Tracker}
                player2Tracker={p2Tracker}
                wagerAmount={wagerDisplay}
                gameType="BULLSEYE"
                onExit={() => window.location.reload()}
                isMuted={isMuted}
                onSoundToggle={toggleMute}
                onFABTap={() => setShowFABPanel(true)}
                statusMessage={mobileStatusMsg}
              >
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="w-full rounded-sm border border-white/8 cursor-crosshair"
                    style={{
                      maxWidth: `${CANVAS_WIDTH}px`,
                      touchAction: 'none',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                  />
                </div>
              </MobileGameChrome>

              {/* Game result overlay */}
              {isFinished && gameState && winner && settlementResult && role && (
                <GameResultOverlay
                  outcome={deriveOutcome(settlementResult, role)}
                  amount={formatResultAmount(
                    deriveOutcome(settlementResult, role),
                    settlementResult.winnerPayout,
                    betAmountCents,
                  )}
                  scoreText={`${scoreA} -- ${scoreB}`}
                  visible
                  mobile
                  onPlayAgain={() => window.location.reload()}
                  onLobby={() => window.location.reload()}
                />
              )}
              {isFinished && gameState && winner && !settlementResult && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div
                    className="pointer-events-auto rounded-sm px-6 py-4 text-center"
                    style={{
                      background: 'rgba(15,17,23,0.92)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <p
                      className="font-display text-lg font-bold uppercase tracking-widest mb-1"
                      style={{
                        color: winner === role ? '#00ff87' : '#ff3b5c',
                      }}
                    >
                      {winner === role ? 'Victory!' : 'Defeat'}
                    </p>
                    <p className="font-mono text-sm text-text-secondary mb-1">
                      P1: {scoreA} -- P2: {scoreB}
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="font-mono text-xs uppercase tracking-widest px-5 py-2 rounded-sm bg-brand-400/90 text-black font-semibold hover:bg-brand-400 transition-colors"
                    >
                      Play Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
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
