'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Target } from 'lucide-react';
import { useLandscapeLock } from '@/hooks/useLandscapeLock';
import { useSoundEnabled } from '@/hooks/useSoundEnabled';
import { RotatePrompt } from '@/components/ui/RotatePrompt';
import { MobileGameChrome } from '@/components/ui/MobileGameChrome';
import { GameMobileFAB } from '@/components/ui/GameMobileFAB';
import { EffectsManager, generateBurstParticles, type PhysicsEvent } from '../_shared/game-effects';
import { GameAudio } from '../_shared/game-audio';
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
const TOUCH_OFFSET_Y = 60;
const MIN_DRAG_DISTANCE = 15;
const TOUCH_TARGET_RADIUS = BALL_RADIUS * 8;

const CANVAS_WIDTH = TABLE_WIDTH + RAIL_INSET * 2 + 20;
const CANVAS_HEIGHT = TABLE_HEIGHT + RAIL_INSET * 2 + 20;

// Premium table visuals
const BG_SURROUND = '#0d1b2a';
const FELT_COLOR = '#0a6e3a';
const RAIL_OUTER = '#4a1a0a';
const RAIL_INNER = '#7a3018';
const RAIL_HIGHLIGHT = '#5c2010';
const POCKET_VOID = '#050505';
const DIAMOND_COLOR = '#d4a868';

// 3-Shot specific
const SHOTS_PER_PLAYER = 3;
const SHOT_CLOCK_SECONDS = 30;
const SHOT_CLOCK_WARNING = 3;
const AUTO_SHOT_POWER_FRAC = 0.15;
const SHOT_RESULT_DISPLAY_MS = 1500;
const TURN_COMPLETE_DISPLAY_MS = 2000;
const P2_SETUP_PAUSE_MS = 1000;
const OVERTIME_ANNOUNCE_MS = 2000;
const MAX_OVERTIME_ROUNDS = 3;

const OFFSET = RAIL_INSET + 10;
const CUE_RESPOT_X = OFFSET + TABLE_WIDTH * 0.25;
const CUE_RESPOT_Y = OFFSET + TABLE_HEIGHT / 2;

// ---------------------------------------------------------------------------
// Ball colors
// ---------------------------------------------------------------------------
const BALL_COLORS: Record<number, string> = {
  0: '#ffffff',
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

type ThreeShotPhase =
  | 'p1_break'
  | 'p1_shooting'
  | 'p1_rolling'
  | 'p1_result'
  | 'p1_complete'
  | 'p2_setup'
  | 'p2_shooting'
  | 'p2_rolling'
  | 'p2_result'
  | 'scoring'
  | 'overtime_announce'
  | 'ot_p1_shooting'
  | 'ot_p1_rolling'
  | 'ot_p1_result'
  | 'ot_p2_shooting'
  | 'ot_p2_rolling'
  | 'ot_p2_result'
  | 'ot_scoring'
  | 'forced_tiebreak_announce'
  | 'ft_p1_shooting'
  | 'ft_p1_rolling'
  | 'ft_p2_shooting'
  | 'ft_p2_rolling'
  | 'ft_scoring'
  | 'game_over';

interface ThreeShotGameData {
  phase: ThreeShotPhase;
  currentPlayer: 'A' | 'B';
  shotsRemainingA: number;
  shotsRemainingB: number;
  scoreA: number;
  scoreB: number;
  otRound: number;
  otScoreA: number;
  otScoreB: number;
  ftDistA: number | null;
  ftDistB: number | null;
  balls: { id: number; x: number; y: number; pocketed: boolean }[];
  winner: 'A' | 'B' | null;
  lastShot: {
    player: 'A' | 'B';
    angle: number;
    power: number;
    preShotBalls: { id: number; x: number; y: number; pocketed: boolean }[];
    pocketed: number[];
    cuePocketed: boolean;
  } | null;
  shotNumber: number;
}

// ---------------------------------------------------------------------------
// Pocket positions
// ---------------------------------------------------------------------------
function getPockets(): { x: number; y: number; radius: number }[] {
  return [
    { x: OFFSET, y: OFFSET, radius: POCKET_RADIUS_CORNER },
    { x: OFFSET + TABLE_WIDTH, y: OFFSET, radius: POCKET_RADIUS_CORNER },
    { x: OFFSET, y: OFFSET + TABLE_HEIGHT, radius: POCKET_RADIUS_CORNER },
    { x: OFFSET + TABLE_WIDTH, y: OFFSET + TABLE_HEIGHT, radius: POCKET_RADIUS_CORNER },
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
      balls.push({ id: rowBalls[col], x: rowX, y: startY + colOffset, vx: 0, vy: 0, pocketed: false });
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

function stepPhysics(balls: Ball[], shotResult: ShotResult, onEvent?: (e: PhysicsEvent) => void): void {
  const activeBalls = balls.filter(b => !b.pocketed);

  for (const b of activeBalls) {
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < VELOCITY_THRESHOLD) b.vx = 0;
    if (Math.abs(b.vy) < VELOCITY_THRESHOLD) b.vy = 0;
  }

  for (let i = 0; i < activeBalls.length; i++) {
    for (let j = i + 1; j < activeBalls.length; j++) {
      const a = activeBalls[i];
      const b = activeBalls[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < BALL_RADIUS * 2 && d > 0) {
        if (a.id === 0 && shotResult.firstContact === null) {
          shotResult.firstContact = b.id;
          shotResult.contactMade = true;
        }
        if (b.id === 0 && shotResult.firstContact === null) {
          shotResult.firstContact = a.id;
          shotResult.contactMade = true;
        }

        const overlap = BALL_RADIUS * 2 - d;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * overlap / 2;
        a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2;
        b.y += ny * overlap / 2;

        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          a.vx -= dot * nx * BALL_RESTITUTION;
          a.vy -= dot * ny * BALL_RESTITUTION;
          b.vx += dot * nx * BALL_RESTITUTION;
          b.vy += dot * ny * BALL_RESTITUTION;
        }

        if (onEvent) {
          const relVel = Math.sqrt(dvx * dvx + dvy * dvy);
          if (relVel > 3) {
            onEvent({ type: 'collision', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, velocity: relVel });
          }
        }
      }
    }
  }

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

  for (const b of activeBalls) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const d = dist(b.x, b.y, p.x, p.y);
      if (d < p.radius) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        if (b.id === 0) {
          shotResult.cuePocketed = true;
        } else {
          shotResult.pocketed.push(b.id);
        }
        if (onEvent) {
          onEvent({ type: 'pocketed', ballId: b.id, pocketX: p.x, pocketY: p.y });
        }
        break;
      } else if (onEvent && d < p.radius * 2.5 && (b.vx * b.vx + b.vy * b.vy) > 4) {
        onEvent({ type: 'nearMiss', ballId: b.id, pocketX: p.x, pocketY: p.y });
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
    const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_RADIUS);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#dddddd');
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(b.x - BALL_RADIUS, b.y - BALL_RADIUS * 0.45, BALL_RADIUS * 2, BALL_RADIUS * 0.9);

    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `bold ${BALL_RADIUS * 0.8}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.id), b.x, b.y + 0.5);

    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else {
    const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_RADIUS);
    grad.addColorStop(0, lightenColor(color, 40));
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

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
  const rx = OFFSET - RAIL_INSET;
  const ry = OFFSET - RAIL_INSET;
  const rw = TABLE_WIDTH + RAIL_INSET * 2;
  const rh = TABLE_HEIGHT + RAIL_INSET * 2;

  // Outer rail body — gradient for 3D depth
  const railGrad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
  railGrad.addColorStop(0, RAIL_HIGHLIGHT);
  railGrad.addColorStop(0.15, RAIL_OUTER);
  railGrad.addColorStop(0.85, RAIL_OUTER);
  railGrad.addColorStop(1, '#2a0e04');
  ctx.fillStyle = railGrad;
  ctx.fillRect(rx, ry, rw, rh);

  // Outer rail subtle border
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);

  // Inner cushion face — brighter strip along inner edge
  ctx.fillStyle = RAIL_INNER;
  ctx.fillRect(OFFSET - 4, OFFSET - 4, TABLE_WIDTH + 8, TABLE_HEIGHT + 8);

  // Inner rail border — darker line separating cushion from felt
  ctx.fillStyle = RAIL_OUTER;
  ctx.fillRect(OFFSET - 1.5, OFFSET - 1.5, TABLE_WIDTH + 3, TABLE_HEIGHT + 3);

  // Felt surface
  ctx.fillStyle = FELT_COLOR;
  ctx.fillRect(OFFSET, OFFSET, TABLE_WIDTH, TABLE_HEIGHT);

  // Felt texture — two layers of faint lines simulating woven fabric
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  for (let y = OFFSET; y < OFFSET + TABLE_HEIGHT; y += 6) {
    ctx.beginPath();
    ctx.moveTo(OFFSET, y);
    ctx.lineTo(OFFSET + TABLE_WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  for (let y = OFFSET + 3; y < OFFSET + TABLE_HEIGHT; y += 10) {
    ctx.beginPath();
    ctx.moveTo(OFFSET, y);
    ctx.lineTo(OFFSET + TABLE_WIDTH, y);
    ctx.stroke();
  }

  // Felt inner shadow — subtle edge darkening for concave depth
  const shadowSize = 15;
  // Top edge
  const topShadow = ctx.createLinearGradient(OFFSET, OFFSET, OFFSET, OFFSET + shadowSize);
  topShadow.addColorStop(0, 'rgba(0,0,0,0.12)');
  topShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(OFFSET, OFFSET, TABLE_WIDTH, shadowSize);
  // Bottom edge
  const botShadow = ctx.createLinearGradient(OFFSET, OFFSET + TABLE_HEIGHT - shadowSize, OFFSET, OFFSET + TABLE_HEIGHT);
  botShadow.addColorStop(0, 'rgba(0,0,0,0)');
  botShadow.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = botShadow;
  ctx.fillRect(OFFSET, OFFSET + TABLE_HEIGHT - shadowSize, TABLE_WIDTH, shadowSize);
  // Left edge
  const leftShadow = ctx.createLinearGradient(OFFSET, OFFSET, OFFSET + shadowSize, OFFSET);
  leftShadow.addColorStop(0, 'rgba(0,0,0,0.10)');
  leftShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftShadow;
  ctx.fillRect(OFFSET, OFFSET, shadowSize, TABLE_HEIGHT);
  // Right edge
  const rightShadow = ctx.createLinearGradient(OFFSET + TABLE_WIDTH - shadowSize, OFFSET, OFFSET + TABLE_WIDTH, OFFSET);
  rightShadow.addColorStop(0, 'rgba(0,0,0,0)');
  rightShadow.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = rightShadow;
  ctx.fillRect(OFFSET + TABLE_WIDTH - shadowSize, OFFSET, shadowSize, TABLE_HEIGHT);

  // Centre line
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(OFFSET + TABLE_WIDTH / 2, OFFSET);
  ctx.lineTo(OFFSET + TABLE_WIDTH / 2, OFFSET + TABLE_HEIGHT);
  ctx.stroke();

  // Head string
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const headX = OFFSET + TABLE_WIDTH * 0.25;
  ctx.beginPath();
  ctx.moveTo(headX, OFFSET);
  ctx.lineTo(headX, OFFSET + TABLE_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Foot spot
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(OFFSET + TABLE_WIDTH * 0.73, OFFSET + TABLE_HEIGHT / 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Pockets — dark void with wear ring
  for (const p of POCKETS) {
    // Wear ring on felt
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
    ctx.fill();

    // Pocket void — radial gradient for depth
    const pocketGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
    pocketGrad.addColorStop(0, '#000000');
    pocketGrad.addColorStop(0.7, '#030303');
    pocketGrad.addColorStop(1, POCKET_VOID);
    ctx.fillStyle = pocketGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Pocket rim highlight
    ctx.strokeStyle = 'rgba(40,20,10,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Diamond markers
  ctx.fillStyle = DIAMOND_COLOR;
  const diamonds = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  for (const frac of diamonds) {
    ctx.beginPath();
    ctx.arc(OFFSET + TABLE_WIDTH * frac, OFFSET - RAIL_INSET / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(OFFSET + TABLE_WIDTH * frac, OFFSET + TABLE_HEIGHT + RAIL_INSET / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const sideDiamonds = [0.25, 0.5, 0.75];
  for (const frac of sideDiamonds) {
    ctx.beginPath();
    ctx.arc(OFFSET - RAIL_INSET / 2, OFFSET + TABLE_HEIGHT * frac, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(OFFSET + TABLE_WIDTH + RAIL_INSET / 2, OFFSET + TABLE_HEIGHT * frac, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPowerMeter(ctx: CanvasRenderingContext2D, power: number): void {
  const meterW = 16;
  const meterH = TABLE_HEIGHT - 40;
  const meterX = 12;
  const meterY = OFFSET + 20;
  const r = meterW / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('POWER', meterX + meterW / 2, meterY - 6);

  ctx.beginPath();
  ctx.moveTo(meterX + r, meterY);
  ctx.lineTo(meterX + meterW - r, meterY);
  ctx.arc(meterX + meterW - r, meterY + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(meterX + r, meterY + meterH);
  ctx.arc(meterX + r, meterY + meterH - r, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (power > 0.01) {
    const fillH = meterH * power;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(meterX + r, meterY);
    ctx.lineTo(meterX + meterW - r, meterY);
    ctx.arc(meterX + meterW - r, meterY + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(meterX + r, meterY + meterH);
    ctx.arc(meterX + r, meterY + meterH - r, r, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.clip();
    const grad = ctx.createLinearGradient(0, meterY + meterH, 0, meterY);
    grad.addColorStop(0, '#2ecc71');
    grad.addColorStop(0.5, '#f39c12');
    grad.addColorStop(1, '#e74c3c');
    ctx.fillStyle = grad;
    ctx.fillRect(meterX, meterY + meterH - fillH, meterW, fillH);
    ctx.restore();
  }
  ctx.restore();
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

  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + Math.cos(aimAngle) * 6, tipY + Math.sin(aimAngle) * 6);
  ctx.stroke();

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

    ctx.beginPath();
    ctx.arc(hit.cx, hit.cy, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();

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

// Draw shot clock on canvas
function drawShotClock(ctx: CanvasRenderingContext2D, secondsLeft: number): void {
  const x = OFFSET + TABLE_WIDTH - 5;
  const y = OFFSET + 20;

  const displayTime = Math.ceil(secondsLeft);

  // Color transitions: white > 8s, amber <= 8s, red <= 4s
  let color: string;
  let alpha = 1;
  if (secondsLeft <= 3) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
    alpha = 0.7 + 0.3 * pulse;
    color = `rgba(255,59,92,${alpha})`;
  } else if (secondsLeft <= 4) {
    color = `rgba(255,59,92,0.9)`;
  } else if (secondsLeft <= 8) {
    color = `rgba(255,184,0,0.8)`;
  } else {
    color = 'rgba(255,255,255,0.5)';
  }

  ctx.save();
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(displayTime), x, y);

  // Progress bar below text
  const barWidth = 40;
  const barX = x - barWidth;
  const barY = y + 12;
  const progress = secondsLeft / SHOT_CLOCK_SECONDS;

  // Bar background
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(barX, barY, barWidth, 3);

  // Bar fill
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, barWidth * progress, 3);

  ctx.restore();
}

// Draw center target for forced tiebreak
function drawCenterTarget(ctx: CanvasRenderingContext2D, animFrame: number): void {
  const cx = OFFSET + TABLE_WIDTH / 2;
  const cy = OFFSET + TABLE_HEIGHT / 2;
  const pulse = 0.5 + 0.5 * Math.sin(animFrame * 0.05);

  ctx.save();
  // Crosshair
  ctx.strokeStyle = `rgba(255,215,0,${0.4 + pulse * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(cx - 20, cy);
  ctx.lineTo(cx + 20, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy + 20);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,215,0,${0.5 + pulse * 0.3})`;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,215,0,${0.6 + pulse * 0.4})`;
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Respot cue ball avoiding overlaps (Edge case E17)
// ---------------------------------------------------------------------------
function findRespotPosition(balls: Ball[]): { x: number; y: number } {
  const checkClear = (x: number, y: number) =>
    !balls.some(b => b.id !== 0 && !b.pocketed && dist(x, y, b.x, b.y) < BALL_RADIUS * 2.2);

  // Try center of head string first
  if (checkClear(CUE_RESPOT_X, CUE_RESPOT_Y)) return { x: CUE_RESPOT_X, y: CUE_RESPOT_Y };

  // Try along the head string (varying Y)
  for (let offset = BALL_RADIUS * 2.5; offset < TABLE_HEIGHT / 2; offset += BALL_RADIUS * 2.5) {
    if (checkClear(CUE_RESPOT_X, CUE_RESPOT_Y - offset)) return { x: CUE_RESPOT_X, y: CUE_RESPOT_Y - offset };
    if (checkClear(CUE_RESPOT_X, CUE_RESPOT_Y + offset)) return { x: CUE_RESPOT_X, y: CUE_RESPOT_Y + offset };
  }

  // Fallback: shift left
  for (let xOff = BALL_RADIUS * 3; xOff < TABLE_WIDTH * 0.25; xOff += BALL_RADIUS * 3) {
    if (checkClear(CUE_RESPOT_X - xOff, CUE_RESPOT_Y)) return { x: CUE_RESPOT_X - xOff, y: CUE_RESPOT_Y };
  }

  return { x: CUE_RESPOT_X, y: CUE_RESPOT_Y };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ThreeShotPoolPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('3shot', log);
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
  const { isMuted, toggleMute } = useSoundEnabled();
  const effectsRef = useRef<EffectsManager | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  if (!effectsRef.current) effectsRef.current = new EffectsManager();
  if (!audioRef.current) audioRef.current = new GameAudio();
  const lastTickSecRef = useRef(0);

  useEffect(() => { audioRef.current?.setMuted(isMuted); }, [isMuted]);

  const [showFABPanel, setShowFABPanel] = useState(false);

  // ---- 3-Shot specific state ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>(rackBalls());
  const [gamePhase, setGamePhase] = useState<ThreeShotPhase>('p1_break');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [shotsRemainingA, setShotsRemainingA] = useState(SHOTS_PER_PLAYER);
  const [shotsRemainingB, setShotsRemainingB] = useState(SHOTS_PER_PLAYER);
  const [otRound, setOtRound] = useState(0);
  const [otScoreA, setOtScoreA] = useState(0);
  const [otScoreB, setOtScoreB] = useState(0);
  const [ftDistA, setFtDistA] = useState<number | null>(null);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [lastShotInfo, setLastShotInfo] = useState<string>('');
  const [shotResultMsg, setShotResultMsg] = useState<string | null>(null);
  const [, setRenderTick] = useState(0);

  // Shot clock
  const shotClockStartRef = useRef<number | null>(null);
  const [shotClockRemaining, setShotClockRemaining] = useState(SHOT_CLOCK_SECONDS);
  const shotClockFiredRef = useRef(false);

  // Aiming state
  const aimingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const shotPowerRef = useRef(0);
  const aimAngleRef = useRef(0);
  const shootingRef = useRef(false);
  const activeTouchIdRef = useRef<number | null>(null);
  const animFrameRef = useRef(0);
  const prevGameDataRef = useRef<ThreeShotGameData | null>(null);
  const animatingOpponentRef = useRef(false);
  const opponentAnimEndRef = useRef<Ball[] | null>(null);
  const shotNumberRef = useRef(0);

  // Refs for touch handlers
  const gamePhaseRef = useRef(gamePhase);
  const phaseRef = useRef(phase);
  const winnerRef = useRef(winner);
  gamePhaseRef.current = gamePhase;
  phaseRef.current = phase;
  winnerRef.current = winner;

  // Who is currently shooting?
  const currentShooter = (() => {
    if (['p1_break', 'p1_shooting', 'p1_rolling', 'p1_result', 'p1_complete'].includes(gamePhase)) return 'A';
    if (['p2_setup', 'p2_shooting', 'p2_rolling', 'p2_result'].includes(gamePhase)) return 'B';
    if (['ot_p1_shooting', 'ot_p1_rolling', 'ot_p1_result', 'ft_p1_shooting', 'ft_p1_rolling'].includes(gamePhase)) return 'A';
    if (['ot_p2_shooting', 'ot_p2_rolling', 'ot_p2_result', 'ft_p2_shooting', 'ft_p2_rolling'].includes(gamePhase)) return 'B';
    return 'A';
  })();

  const isMyTurn = currentShooter === role;
  const canShoot = isMyTurn && !shootingRef.current && phase === 'playing' && !winner &&
    ['p1_break', 'p1_shooting', 'p2_shooting', 'ot_p1_shooting', 'ot_p2_shooting', 'ft_p1_shooting', 'ft_p2_shooting'].includes(gamePhase);

  const canShootRef = useRef(canShoot);
  canShootRef.current = canShoot;

  // ---- Shot clock effect ----
  useEffect(() => {
    if (!canShoot) {
      shotClockStartRef.current = null;
      shotClockFiredRef.current = false;
      return;
    }

    shotClockStartRef.current = Date.now();
    shotClockFiredRef.current = false;
    setShotClockRemaining(SHOT_CLOCK_SECONDS);

    const interval = setInterval(() => {
      if (!shotClockStartRef.current || shootingRef.current) return;
      const elapsed = (Date.now() - shotClockStartRef.current) / 1000;
      const remaining = Math.max(0, SHOT_CLOCK_SECONDS - elapsed);
      setShotClockRemaining(remaining);

      if (remaining <= 0 && !shotClockFiredRef.current) {
        shotClockFiredRef.current = true;
        // Auto-fire
        aimingRef.current = false;
        dragStartRef.current = null;
        dragCurrentRef.current = null;
        const angle = aimAngleRef.current || 0;
        const power = AUTO_SHOT_POWER_FRAC * MAX_SHOT_POWER;
        setShotResultMsg("Time's up! Auto-shot fired.");
        // We need to fire the shot — trigger via a custom event
        window.dispatchEvent(new CustomEvent('3shot-auto-fire', { detail: { angle, power } }));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [canShoot, gamePhase]);

  // ---- Sync game data to server ----
  const syncGameData = useCallback((overrides?: Partial<ThreeShotGameData>) => {
    const data: ThreeShotGameData = {
      phase: gamePhase,
      currentPlayer: currentShooter,
      shotsRemainingA,
      shotsRemainingB,
      scoreA,
      scoreB,
      otRound,
      otScoreA,
      otScoreB,
      ftDistA: ftDistA,
      ftDistB: null,
      balls: ballsRef.current.map(b => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed })),
      winner,
      lastShot: null,
      shotNumber: shotNumberRef.current,
      ...overrides,
    };
    setGameData(data as unknown as Record<string, unknown>);
  }, [gamePhase, currentShooter, shotsRemainingA, shotsRemainingB, scoreA, scoreB, otRound, otScoreA, otScoreB, ftDistA, winner, setGameData]);

  // ---- Resolve game with winner ----
  const settleWinner = useCallback((w: 'A' | 'B') => {
    setWinner(w);
    setGamePhase('game_over');

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

    syncGameData({ phase: 'game_over', winner: w });
  }, [resolveGame, gameState, authState, reportAndSettle, syncGameData, role]);

  // ---- Respot cue ball helper ----
  const respotCueBall = useCallback(() => {
    const cue = ballsRef.current.find(b => b.id === 0);
    if (cue) {
      const pos = findRespotPosition(ballsRef.current);
      cue.pocketed = false;
      cue.x = pos.x;
      cue.y = pos.y;
      cue.vx = 0;
      cue.vy = 0;
    }
  }, []);

  // ---- Execute shot ----
  const executeShot = useCallback((power: number, angle: number) => {
    if (shootingRef.current) return;
    shootingRef.current = true;
    shotClockStartRef.current = null;

    const cueBall = ballsRef.current.find(b => b.id === 0);
    if (!cueBall || cueBall.pocketed) { shootingRef.current = false; return; }

    const preShotBalls = ballsRef.current.map(b => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed }));

    // Set rolling phase
    if (gamePhase === 'p1_break' || gamePhase === 'p1_shooting') setGamePhase('p1_rolling');
    else if (gamePhase === 'p2_shooting') setGamePhase('p2_rolling');
    else if (gamePhase === 'ot_p1_shooting') setGamePhase('ot_p1_rolling');
    else if (gamePhase === 'ot_p2_shooting') setGamePhase('ot_p2_rolling');
    else if (gamePhase === 'ft_p1_shooting') setGamePhase('ft_p1_rolling');
    else if (gamePhase === 'ft_p2_shooting') setGamePhase('ft_p2_rolling');

    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;

    audioRef.current?.ensureContext();
    effectsRef.current?.spawn({
      type: 'impact',
      x: cueBall.x + Math.cos(angle) * BALL_RADIUS,
      y: cueBall.y + Math.sin(angle) * BALL_RADIUS,
      angle: angle + Math.PI,
      intensity: power / MAX_SHOT_POWER,
      duration: 120,
    });
    audioRef.current?.playStrike(power / MAX_SHOT_POWER);

    const shotResult: ShotResult = {
      firstContact: null,
      pocketed: [],
      cuePocketed: false,
      railAfterContact: false,
      contactMade: false,
    };

    const handlePhysicsEvent = (event: PhysicsEvent) => {
      if (event.type === 'collision') {
        if (effectsRef.current?.spawnCollision(event.x, event.y, event.velocity, 0, 0)) {
          audioRef.current?.playCollision(event.velocity);
        }
      } else if (event.type === 'pocketed') {
        const color = BALL_COLORS[event.ballId as number] || '#888';
        effectsRef.current?.spawn({ type: 'pocketRipple', x: event.pocketX, y: event.pocketY, duration: 300 });
        effectsRef.current?.spawn({ type: 'ghostBall', x: event.pocketX, y: event.pocketY, color, radius: BALL_RADIUS, duration: 200 });
        audioRef.current?.playPot();
      } else if (event.type === 'nearMiss') {
        if (effectsRef.current?.spawnNearMiss(event.ballId, `${event.pocketX}-${event.pocketY}`)) {
          audioRef.current?.playNearMiss();
        }
      }
    };

    const simulate = () => {
      for (let i = 0; i < 2; i++) {
        stepPhysics(ballsRef.current, shotResult, handlePhysicsEvent);
      }

      if (!allAtRest(ballsRef.current)) {
        requestAnimationFrame(simulate);
        return;
      }

      shootingRef.current = false;
      shotNumberRef.current++;
      const shotNum = shotNumberRef.current;
      const pottedCount = shotResult.pocketed.length;
      const scratched = shotResult.cuePocketed;

      // Build shot result message
      let msg = '';
      if (pottedCount > 0 && scratched) {
        msg = pottedCount === 1
          ? 'Scratch! But you potted 1 ball -- it counts.'
          : `Scratch! But you potted ${pottedCount} balls -- they count.`;
      } else if (scratched) {
        msg = 'Scratch! Cue ball pocketed.';
      } else if (pottedCount === 0) {
        msg = 'No balls potted.';
      } else if (pottedCount === 1) {
        msg = 'Nice! Potted 1 ball.';
      } else if (pottedCount === 2) {
        msg = `Great shot! Potted ${pottedCount} balls!`;
      } else {
        msg = `Incredible! Potted ${pottedCount} balls!`;
      }
      setShotResultMsg(msg);
      setLastShotInfo(msg);
      log(`${currentShooter === 'A' ? 'P1' : 'P2'}: ${msg}`, scratched ? 'error' : 'info');

      // Respot cue if scratched
      if (scratched) {
        respotCueBall();
      }

      const lastShotData = {
        player: currentShooter as 'A' | 'B',
        angle,
        power,
        preShotBalls,
        pocketed: shotResult.pocketed,
        cuePocketed: scratched,
      };

      // Handle based on current game phase
      const gp = gamePhaseRef.current;

      // --- FORCED TIEBREAK ---
      if (gp === 'ft_p1_rolling') {
        const cue = ballsRef.current.find(b => b.id === 0);
        let d = Math.sqrt((OFFSET + TABLE_WIDTH) ** 2 + (OFFSET + TABLE_HEIGHT) ** 2); // max
        if (cue && !cue.pocketed) {
          d = dist(cue.x, cue.y, OFFSET + TABLE_WIDTH / 2, OFFSET + TABLE_HEIGHT / 2);
        }
        setFtDistA(d);
        setGamePhase('ft_p2_shooting');
        respotCueBall();
        syncGameData({ phase: 'ft_p2_shooting', ftDistA: d, lastShot: lastShotData, shotNumber: shotNum });
        return;
      }

      if (gp === 'ft_p2_rolling') {
        const cue = ballsRef.current.find(b => b.id === 0);
        let dB = Math.sqrt((OFFSET + TABLE_WIDTH) ** 2 + (OFFSET + TABLE_HEIGHT) ** 2);
        if (cue && !cue.pocketed) {
          dB = dist(cue.x, cue.y, OFFSET + TABLE_WIDTH / 2, OFFSET + TABLE_HEIGHT / 2);
        }
        // Compare
        const dA = ftDistA ?? Infinity;
        const ftWinner = dA < dB ? 'A' : dB < dA ? 'B' : 'B'; // tie goes to P2
        settleWinner(ftWinner);
        return;
      }

      // --- OVERTIME ---
      if (gp === 'ot_p1_rolling') {
        const newOtA = otScoreA + pottedCount;
        setOtScoreA(newOtA);
        setGamePhase('ot_p1_result');
        respotCueBall();

        setTimeout(() => {
          setGamePhase('ot_p2_shooting');
          setShotResultMsg(null);
          syncGameData({ phase: 'ot_p2_shooting', otScoreA: newOtA, lastShot: lastShotData, shotNumber: shotNum });
        }, SHOT_RESULT_DISPLAY_MS);
        return;
      }

      if (gp === 'ot_p2_rolling') {
        const newOtB = otScoreB + pottedCount;
        setOtScoreB(newOtB);
        setGamePhase('ot_p2_result');

        setTimeout(() => {
          setShotResultMsg(null);
          // Compare OT scores
          if (otScoreA + (gp === 'ot_p2_rolling' ? 0 : 0) !== newOtB) {
            // Actually compare cumulative OT: we compare per-round
            // Per the GDD: each OT round P1 and P2 each get 1 shot, compare that round's pots
          }
          // Actually let's simplify: each OT round is independent
          // We need to track per-round scores. Let's use otScoreA/otScoreB as THIS round's scores
          const roundScoreA = otScoreA; // set during ot_p1_result
          const roundScoreB = newOtB;

          if (roundScoreA > roundScoreB) {
            settleWinner('A');
          } else if (roundScoreB > roundScoreA) {
            settleWinner('B');
          } else {
            // Still tied
            const nextOtRound = otRound + 1;
            if (nextOtRound > MAX_OVERTIME_ROUNDS) {
              // Check if any object balls remain
              const objectBallsLeft = ballsRef.current.filter(b => b.id !== 0 && !b.pocketed).length;
              if (objectBallsLeft === 0) {
                // No balls left, go to forced tiebreak immediately
                setOtRound(nextOtRound);
                setOtScoreA(0);
                setOtScoreB(0);
                setGamePhase('forced_tiebreak_announce');
                respotCueBall();
                setTimeout(() => {
                  setGamePhase('ft_p1_shooting');
                  syncGameData({ phase: 'ft_p1_shooting', otRound: nextOtRound, shotNumber: shotNum });
                }, OVERTIME_ANNOUNCE_MS);
              } else {
                // Forced tiebreak
                setOtRound(nextOtRound);
                setOtScoreA(0);
                setOtScoreB(0);
                setGamePhase('forced_tiebreak_announce');
                respotCueBall();
                setTimeout(() => {
                  setGamePhase('ft_p1_shooting');
                  syncGameData({ phase: 'ft_p1_shooting', otRound: nextOtRound, shotNumber: shotNum });
                }, OVERTIME_ANNOUNCE_MS);
              }
            } else {
              // Another OT round
              setOtRound(nextOtRound);
              setOtScoreA(0);
              setOtScoreB(0);
              setGamePhase('overtime_announce');
              respotCueBall();
              setTimeout(() => {
                setGamePhase('ot_p1_shooting');
                syncGameData({ phase: 'ot_p1_shooting', otRound: nextOtRound, otScoreA: 0, otScoreB: 0, shotNumber: shotNum });
              }, OVERTIME_ANNOUNCE_MS);
            }
          }
        }, SHOT_RESULT_DISPLAY_MS);
        return;
      }

      // --- REGULATION: P1 ---
      if (gp === 'p1_rolling') {
        const newScore = scoreA + pottedCount;
        setScoreA(newScore);
        const newRemaining = shotsRemainingA - 1;
        setShotsRemainingA(newRemaining);

        const objectBallsLeft = ballsRef.current.filter(b => b.id !== 0 && !b.pocketed).length;

        if (newRemaining <= 0 || objectBallsLeft === 0) {
          // P1 done — show result then transition
          setGamePhase('p1_result');

          setTimeout(() => {
            setShotResultMsg(null);
            setGamePhase('p1_complete');
            log(`Player 1 finished. Score: ${newScore}`, 'success');

            setTimeout(() => {
              if (objectBallsLeft === 0) {
                setGamePhase('scoring');
                setTimeout(() => {
                  if (newScore > scoreB) {
                    settleWinner('A');
                  } else if (scoreB > newScore) {
                    settleWinner('B');
                  } else {
                    setOtRound(1);
                    setGamePhase('forced_tiebreak_announce');
                    respotCueBall();
                    setTimeout(() => {
                      setGamePhase('ft_p1_shooting');
                      syncGameData({ phase: 'ft_p1_shooting', scoreA: newScore, shotsRemainingA: newRemaining, shotNumber: shotNum });
                    }, OVERTIME_ANNOUNCE_MS);
                  }
                }, TURN_COMPLETE_DISPLAY_MS);
              } else {
                setGamePhase('p2_setup');
                respotCueBall();
                setTimeout(() => {
                  setGamePhase('p2_shooting');
                  syncGameData({
                    phase: 'p2_shooting',
                    scoreA: newScore,
                    shotsRemainingA: newRemaining,
                    lastShot: lastShotData,
                    shotNumber: shotNum,
                  });
                }, P2_SETUP_PAUSE_MS);
              }
            }, TURN_COMPLETE_DISPLAY_MS);
          }, SHOT_RESULT_DISPLAY_MS);
        } else {
          // P1 has more shots — transition immediately so aiming is re-enabled
          setGamePhase('p1_shooting');
          syncGameData({
            phase: 'p1_shooting',
            scoreA: newScore,
            shotsRemainingA: newRemaining,
            lastShot: lastShotData,
            shotNumber: shotNum,
          });
          // Clear result message after display period
          setTimeout(() => { setShotResultMsg(null); }, SHOT_RESULT_DISPLAY_MS);
        }
        return;
      }

      // --- REGULATION: P2 ---
      if (gp === 'p2_rolling') {
        const newScore = scoreB + pottedCount;
        setScoreB(newScore);
        const newRemaining = shotsRemainingB - 1;
        setShotsRemainingB(newRemaining);

        const objectBallsLeft = ballsRef.current.filter(b => b.id !== 0 && !b.pocketed).length;

        if (newRemaining <= 0 || objectBallsLeft === 0) {
          // P2 done — show result then transition
          setGamePhase('p2_result');

          setTimeout(() => {
            setShotResultMsg(null);
            setGamePhase('scoring');
            log(`Player 2 finished. Score: ${newScore}`, 'success');

            setTimeout(() => {
              if (scoreA > newScore) {
                settleWinner('A');
              } else if (newScore > scoreA) {
                settleWinner('B');
              } else {
                const objectBallsRemain = ballsRef.current.filter(b => b.id !== 0 && !b.pocketed).length;
                if (objectBallsRemain === 0) {
                  setOtRound(1);
                  setGamePhase('forced_tiebreak_announce');
                  respotCueBall();
                  setTimeout(() => {
                    setGamePhase('ft_p1_shooting');
                    syncGameData({ phase: 'ft_p1_shooting', scoreB: newScore, shotsRemainingB: newRemaining, shotNumber: shotNum });
                  }, OVERTIME_ANNOUNCE_MS);
                } else {
                  setOtRound(1);
                  setOtScoreA(0);
                  setOtScoreB(0);
                  setGamePhase('overtime_announce');
                  respotCueBall();
                  setTimeout(() => {
                    setGamePhase('ot_p1_shooting');
                    syncGameData({
                      phase: 'ot_p1_shooting',
                      scoreB: newScore,
                      shotsRemainingB: newRemaining,
                      otRound: 1,
                      otScoreA: 0,
                      otScoreB: 0,
                      lastShot: lastShotData,
                      shotNumber: shotNum,
                    });
                  }, OVERTIME_ANNOUNCE_MS);
                }
              }
            }, TURN_COMPLETE_DISPLAY_MS);
          }, SHOT_RESULT_DISPLAY_MS);
        } else {
          // P2 has more shots — transition immediately so aiming is re-enabled
          setGamePhase('p2_shooting');
          syncGameData({
            phase: 'p2_shooting',
            scoreB: newScore,
            shotsRemainingB: newRemaining,
            lastShot: lastShotData,
            shotNumber: shotNum,
          });
          setTimeout(() => { setShotResultMsg(null); }, SHOT_RESULT_DISPLAY_MS);
        }
        return;
      }
    };

    requestAnimationFrame(simulate);
  }, [gamePhase, currentShooter, scoreA, scoreB, shotsRemainingA, shotsRemainingB, otRound, otScoreA, otScoreB, ftDistA, log, syncGameData, settleWinner, respotCueBall]);

  // Listen for auto-fire events from shot clock
  useEffect(() => {
    const handler = (e: Event) => {
      const { angle, power } = (e as CustomEvent).detail;
      if (canShootRef.current && !shootingRef.current) {
        executeShot(power, angle);
      }
    };
    window.addEventListener('3shot-auto-fire', handler);
    return () => window.removeEventListener('3shot-auto-fire', handler);
  }, [executeShot]);

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

      ctx.fillStyle = BG_SURROUND;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawTable(ctx);

      // Draw center target during forced tiebreak
      if (['forced_tiebreak_announce', 'ft_p1_shooting', 'ft_p1_rolling', 'ft_p2_shooting', 'ft_p2_rolling', 'ft_scoring'].includes(gamePhase)) {
        drawCenterTarget(ctx, animFrameRef.current);
      }

      // During opponent replay: run physics each frame
      if (animatingOpponentRef.current && opponentAnimEndRef.current) {
        for (let i = 0; i < 2; i++) {
          stepPhysics(ballsRef.current, { firstContact: null, pocketed: [], cuePocketed: false, railAfterContact: false, contactMade: false });
        }

        if (allAtRest(ballsRef.current)) {
          animatingOpponentRef.current = false;
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

      const now = performance.now();
      for (const b of ballsRef.current) {
        const rattleX = effectsRef.current?.getRattleOffset(b.id, now) ?? 0;
        if (rattleX !== 0) {
          const origX = b.x;
          b.x += rattleX;
          drawBall(ctx, b);
          b.x = origX;
        } else {
          drawBall(ctx, b);
        }
      }

      // Aiming visuals
      const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
      if (cueBall && aimingRef.current && dragStartRef.current && dragCurrentRef.current) {
        drawAimLine(ctx, cueBall, aimAngleRef.current, ballsRef.current);
        drawCueStick(ctx, cueBall, aimAngleRef.current, shotPowerRef.current);
        drawPowerMeter(ctx, shotPowerRef.current);
      }

      // Shot clock now shown in status pill (not on canvas)

      // Shot clock tick audio
      if (shotClockRemaining !== null && shotClockRemaining <= 5) {
        const sec = Math.ceil(shotClockRemaining);
        if (sec !== lastTickSecRef.current && sec > 0) {
          lastTickSecRef.current = sec;
          audioRef.current?.playTick();
        }
      }

      effectsRef.current?.render(ctx, now);

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [phase, gamePhase, canShoot, shotClockRemaining]);

  // ---- Poll for opponent state changes ----
  useEffect(() => {
    if (!gameState?.gameData) return;
    const data = gameState.gameData as unknown as ThreeShotGameData;
    if (!data.balls || data.shotNumber == null) return;

    if (!prevGameDataRef.current || data.shotNumber > prevGameDataRef.current.shotNumber) {
      const newBalls = data.balls.map(bd => ({
        id: bd.id, x: bd.x, y: bd.y, vx: 0, vy: 0, pocketed: bd.pocketed,
      }));

      if (!prevGameDataRef.current) {
        ballsRef.current = newBalls;
      } else if (data.lastShot && data.lastShot.angle !== undefined && data.lastShot.preShotBalls && data.lastShot.player !== role) {
        const ls = data.lastShot;
        ballsRef.current = ls.preShotBalls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, pocketed: b.pocketed }));
        const cue = ballsRef.current.find(b => b.id === 0);
        if (cue && !cue.pocketed) {
          cue.vx = Math.cos(ls.angle) * ls.power;
          cue.vy = Math.sin(ls.angle) * ls.power;
        }
        opponentAnimEndRef.current = newBalls;
        animatingOpponentRef.current = true;
      } else {
        ballsRef.current = newBalls;
      }

      setGamePhase(data.phase);
      setScoreA(data.scoreA);
      setScoreB(data.scoreB);
      setShotsRemainingA(data.shotsRemainingA);
      setShotsRemainingB(data.shotsRemainingB);
      setOtRound(data.otRound);
      setOtScoreA(data.otScoreA);
      setOtScoreB(data.otScoreB);
      if (data.ftDistA != null) setFtDistA(data.ftDistA);
      shotNumberRef.current = data.shotNumber;

      if (data.winner) {
        setWinner(data.winner);
        setGamePhase('game_over');
      }

      if (data.lastShot) {
        const ls = data.lastShot;
        let msg = '';
        if (ls.pocketed.length > 0 && ls.cuePocketed) {
          msg = `Scratch! But potted ${ls.pocketed.length} ball(s).`;
        } else if (ls.cuePocketed) {
          msg = 'Scratch!';
        } else if (ls.pocketed.length > 0) {
          msg = `Potted ${ls.pocketed.length} ball(s).`;
        } else {
          msg = 'No balls potted.';
        }
        setLastShotInfo(msg);
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
    if (!canShoot) return;
    const pos = getCanvasPos(e);
    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;

    if (dist(pos.x, pos.y, cueBall.x, cueBall.y) < BALL_RADIUS * 4) {
      aimingRef.current = true;
      dragStartRef.current = pos;
      dragCurrentRef.current = pos;
      shotPowerRef.current = 0;
      aimAngleRef.current = 0;
    }
  }, [canShoot, getCanvasPos]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || !dragStartRef.current) return;
    const pos = getCanvasPos(e);
    dragCurrentRef.current = pos;

    const dx = dragStartRef.current.x - pos.x;
    const dy = dragStartRef.current.y - pos.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    shotPowerRef.current = Math.min(dragDist / MAX_DRAG_DISTANCE, 1.0);
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
      shotPowerRef.current = 0;
      return;
    }

    executeShot(power, angle);
  }, [executeShot]);

  // ---- Touch handlers (mobile — with offset, palm rejection, min drag) ----
  const getTouchCanvasPos = useCallback((clientX: number, clientY: number, applyOffset: boolean = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const pos = { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    if (applyOffset) pos.y -= TOUCH_OFFSET_Y;
    return pos;
  }, []);

  const handleCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canShootRef.current) return;
    if (shootingRef.current || winnerRef.current) return;
    if (phaseRef.current !== 'playing') return;
    const touch = e.touches[0];
    if (!touch) return;

    // Palm rejection: only accept first touch
    if (activeTouchIdRef.current !== null) return;

    const pos = getTouchCanvasPos(touch.clientX, touch.clientY, true);
    if (!pos) return;

    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;
    if (dist(pos.x, pos.y, cueBall.x, cueBall.y) < TOUCH_TARGET_RADIUS) {
      activeTouchIdRef.current = touch.identifier;
      aimingRef.current = true;
      dragStartRef.current = pos;
      dragCurrentRef.current = pos;
      shotPowerRef.current = 0;
      aimAngleRef.current = 0;
    }
  }, [getTouchCanvasPos]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || !dragStartRef.current) return;
    // Palm rejection: track only the active touch
    const touch = Array.from(e.touches).find(t => t.identifier === activeTouchIdRef.current);
    if (!touch) return;
    const pos = getTouchCanvasPos(touch.clientX, touch.clientY, true);
    if (!pos) return;
    dragCurrentRef.current = pos;
    const dx = dragStartRef.current.x - pos.x;
    const dy = dragStartRef.current.y - pos.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    shotPowerRef.current = Math.min(dragDist / MAX_DRAG_DISTANCE, 1.0);
    aimAngleRef.current = Math.atan2(dy, dx);
    setRenderTick(t => t + 1);
  }, [getTouchCanvasPos]);

  const handleCanvasTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // Always check if the active touch ended — clear it regardless of aiming state
    const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchIdRef.current);
    if (!touch) return;

    // Clear touch tracking unconditionally to prevent stuck state
    activeTouchIdRef.current = null;

    if (!aimingRef.current) {
      // Touch ended but we weren't aiming — just clean up
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
    // Min drag distance prevents accidental shots
    if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_DISTANCE) {
      shotPowerRef.current = 0;
      return;
    }
    const power = shotPowerRef.current * MAX_SHOT_POWER;
    const angle = aimAngleRef.current;
    shotPowerRef.current = 0;
    executeShot(power, angle);
  }, [executeShot]);

  // Touch cancel — clean up all touch state to prevent stuck interactions
  const handleCanvasTouchCancel = useCallback(() => {
    activeTouchIdRef.current = null;
    aimingRef.current = false;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    shotPowerRef.current = 0;
  }, []);

  // Register native non-passive touch listeners to allow preventDefault
  // React registers touch listeners as passive, making preventDefault fail
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
    const id = await createGame(authState.playerId, '3shot');
    setIsCreating(false);
    if (id) {
      log('Open the widget to create a bet, then consent to lock funds.', 'info');
    }
  }, [authState, createGame, log]);

  const handleJoinGame = useCallback(async (code: string) => {
    if (!authState) return 'Not authenticated';
    setIsJoining(true);
    const result = await joinGame(code, authState.playerId, '3shot');
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

  // Auto-settle when we detect finish via polling
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
      ballsRef.current = rackBalls();
      setGamePhase('p1_break');
      setScoreA(0);
      setScoreB(0);
      setShotsRemainingA(SHOTS_PER_PLAYER);
      setShotsRemainingB(SHOTS_PER_PLAYER);
      setOtRound(0);
      setOtScoreA(0);
      setOtScoreB(0);
      setFtDistA(null);
      setWinner(null);
      setLastShotInfo('');
      settledRef.current = false;
      shotNumberRef.current = 0;

      if (role === 'A') {
        syncGameData({ phase: 'p1_break' });
      }
    }
  }, [phase, role, syncGameData]);

  // ---- Status text ----
  const shotsLeft = currentShooter === 'A' ? shotsRemainingA : shotsRemainingB;

  let statusText = '';
  let statusColor = 'text-text-secondary';

  if (phase === 'playing' || phase === 'finished') {
    if (winner) {
      statusText = winner === role ? 'You Won!' : 'You Lost!';
      statusColor = winner === role ? 'text-brand-400' : 'text-danger-400';
    } else if (shotResultMsg) {
      statusText = shotResultMsg;
      statusColor = shotResultMsg.includes('Scratch') ? 'text-danger-400' : 'text-brand-400';
    } else if (gamePhase === 'p1_break') {
      statusText = isMyTurn
        ? 'YOUR BREAK -- Drag from the cue ball to shoot'
        : 'Player 1 is breaking...';
      statusColor = isMyTurn ? 'text-brand-400' : 'text-warning-400';
    } else if (gamePhase === 'p1_shooting') {
      if (isMyTurn) {
        statusText = shotsRemainingA === 1
          ? 'LAST SHOT -- Make it count!'
          : `YOUR SHOT -- ${shotsRemainingA} shots remaining`;
        statusColor = 'text-brand-400';
      } else {
        statusText = shotsRemainingA === 1
          ? 'Player 1 is on their last shot...'
          : `Player 1 is shooting... (${shotsRemainingA} shots left)`;
        statusColor = 'text-warning-400';
      }
    } else if (gamePhase === 'p1_complete') {
      statusText = `PLAYER 1 DONE -- Score: ${scoreA}`;
      statusColor = 'text-blue-400';
    } else if (gamePhase === 'p2_setup') {
      statusText = `PLAYER 2'S TURN -- Target: beat ${scoreA}`;
      statusColor = 'text-blue-400';
    } else if (gamePhase === 'p2_shooting') {
      if (isMyTurn) {
        const diff = scoreA - scoreB;
        if (diff > 0) {
          statusText = shotsRemainingB === 1
            ? `LAST SHOT -- Need ${diff} to tie, ${diff + 1} to win!`
            : `YOUR SHOT -- Need ${diff} more (${shotsRemainingB} shots remaining)`;
        } else if (diff === 0) {
          statusText = `YOUR SHOT -- Tied at ${scoreA}! (${shotsRemainingB} shots remaining)`;
        } else {
          statusText = `YOUR SHOT -- You're leading! (${shotsRemainingB} shots remaining)`;
        }
        statusColor = 'text-brand-400';
      } else {
        statusText = `Player 2 is shooting... (${shotsRemainingB} shots left)`;
        statusColor = 'text-warning-400';
      }
    } else if (gamePhase === 'scoring') {
      statusText = `FINAL SCORE -- P1: ${scoreA}  P2: ${scoreB}`;
      statusColor = 'text-blue-400';
    } else if (gamePhase === 'overtime_announce') {
      statusText = `OVERTIME -- Tied at ${scoreA}-${scoreB}. Sudden death!`;
      statusColor = 'text-yellow-400';
    } else if (gamePhase.startsWith('ot_')) {
      const isOtMyTurn = (gamePhase === 'ot_p1_shooting' && role === 'A') || (gamePhase === 'ot_p2_shooting' && role === 'B');
      if (isOtMyTurn) {
        statusText = `OVERTIME RD ${otRound} -- Your shot!`;
        statusColor = 'text-yellow-400';
      } else if (gamePhase === 'ot_p2_shooting' && role === 'A') {
        statusText = `OVERTIME -- Opponent's shot (you potted ${otScoreA})`;
        statusColor = 'text-warning-400';
      } else {
        statusText = `OVERTIME RD ${otRound} -- Opponent's shot...`;
        statusColor = 'text-warning-400';
      }
    } else if (gamePhase === 'forced_tiebreak_announce') {
      statusText = 'FINAL TIEBREAK -- Closest to center wins!';
      statusColor = 'text-yellow-400';
    } else if (gamePhase.startsWith('ft_')) {
      const isFtMyTurn = (gamePhase === 'ft_p1_shooting' && role === 'A') || (gamePhase === 'ft_p2_shooting' && role === 'B');
      statusText = isFtMyTurn
        ? 'Shoot the cue ball closest to the center dot.'
        : "Opponent's tiebreak shot...";
      statusColor = isFtMyTurn ? 'text-yellow-400' : 'text-warning-400';
    } else if (['p1_rolling', 'p2_rolling', 'ot_p1_rolling', 'ot_p2_rolling', 'ft_p1_rolling', 'ft_p2_rolling'].includes(gamePhase)) {
      statusText = '';
    } else {
      statusText = "Waiting...";
      statusColor = 'text-warning-400';
    }
  }

  const isInGame = phase === 'playing' || phase === 'finished';

  // Mobile HUD: status pill message
  let mobileStatusMsg = '';
  if (isInGame) {
    if (winner) {
      mobileStatusMsg = winner === role ? 'You win!' : 'Opponent wins!';
    } else if (gamePhase === 'overtime_announce') {
      mobileStatusMsg = `Overtime! Tied ${scoreA}-${scoreB}`;
    } else if (gamePhase === 'forced_tiebreak_announce') {
      mobileStatusMsg = 'Final tiebreak — closest to center wins';
    } else if (gamePhase === 'p1_break' && isMyTurn) {
      mobileStatusMsg = 'Your break — good luck!';
    } else if (gamePhase === 'p1_break' && !isMyTurn) {
      mobileStatusMsg = "Opponent's break...";
    } else if (isMyTurn && canShoot) {
      const shots = currentShooter === 'A' ? shotsRemainingA : shotsRemainingB;
      const clockStr = shotClockRemaining > 0 ? ` (${Math.ceil(shotClockRemaining)}s)` : '';
      if (gamePhase.startsWith('ot_')) {
        mobileStatusMsg = `Overtime Rd ${otRound} — your shot!${clockStr}`;
      } else if (gamePhase.startsWith('ft_')) {
        mobileStatusMsg = `Tiebreak — shoot closest to center${clockStr}`;
      } else if (shots === 1) {
        mobileStatusMsg = `Last shot — make it count!${clockStr}`;
      } else {
        mobileStatusMsg = `Your turn — ${shots} shots remaining${clockStr}`;
      }
    } else if (!isMyTurn) {
      mobileStatusMsg = "Opponent's turn...";
    } else if (shotResultMsg) {
      mobileStatusMsg = shotResultMsg;
    }
  }

  // Shot dot trackers for P1 and P2
  const p1Tracker = (
    <div className="flex gap-1">
      {Array.from({ length: SHOTS_PER_PLAYER }).map((_, i) => (
        <span key={i} className="inline-block rounded-full" style={{
          width: 8, height: 8,
          background: i < shotsRemainingA ? '#ffffff' : 'transparent',
          border: '1.5px solid rgba(255,255,255,0.4)',
        }} />
      ))}
    </div>
  );

  const p2Tracker = (
    <div className="flex gap-1">
      {Array.from({ length: SHOTS_PER_PLAYER }).map((_, i) => (
        <span key={i} className="inline-block rounded-full" style={{
          width: 8, height: 8,
          background: i < shotsRemainingB ? '#ffffff' : 'transparent',
          border: '1.5px solid rgba(255,255,255,0.4)',
        }} />
      ))}
    </div>
  );

  const wagerDisplay = betAmountCents > 0 ? `$${(betAmountCents / 100).toFixed(2)}` : undefined;

  return (
    <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${isInGame ? 'game-fullscreen-mobile' : ''}`}>
      <RotatePrompt isInGame={isInGame} />
      {isInGame && showFABPanel && (
        <GameMobileFAB
          onExit={() => window.location.reload()}
          onClose={() => setShowFABPanel(false)}
          betAmount={betAmountCents || undefined}
          betStatus={gameState?.status === 'finished' ? 'settled' : 'in progress'}
          turnInfo={statusText}
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
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            3-Shot Pool
          </h1>
          <p className="text-sm text-text-muted font-mono">
            3 shots each. Most balls potted wins. Real money on the line.
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {phase === 'role-select' && (
            <RoleSelector onSelect={handleRoleSelect} disabled={isSettingUp} />
          )}

          {isSettingUp && (
            <Card padding="sm">
              <p className="font-mono text-xs text-text-muted text-center uppercase tracking-widest">
                Setting up authentication...
              </p>
            </Card>
          )}

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

          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Score bar */}
              <Card padding="sm" className="game-players-bar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* P1 score */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-secondary">
                        P1{role === 'A' ? ' (You)' : ''}
                      </span>
                      <span className="font-display text-lg font-bold text-text-primary">
                        {scoreA}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-text-muted">vs</span>

                    {/* P2 score */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-secondary">
                        P2{role === 'B' ? ' (You)' : ''}
                      </span>
                      <span className="font-display text-lg font-bold text-text-primary">
                        {gamePhase === 'p1_break' || gamePhase === 'p1_shooting' || gamePhase === 'p1_rolling' || gamePhase === 'p1_result' || gamePhase === 'p1_complete' || gamePhase === 'p2_setup'
                          ? '--'
                          : scoreB}
                      </span>
                    </div>
                  </div>

                  {/* Shot pips */}
                  {!gamePhase.startsWith('ot_') && !gamePhase.startsWith('ft_') && gamePhase !== 'overtime_announce' && gamePhase !== 'forced_tiebreak_announce' && !winner && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-text-muted uppercase">
                        {currentShooter === 'A' ? 'P1' : 'P2'} Shots
                      </span>
                      <div className="flex gap-1">
                        {Array.from({ length: SHOTS_PER_PLAYER }).map((_, i) => (
                          <span
                            key={i}
                            className="inline-block h-2.5 w-2.5 rounded-full border border-white/20"
                            style={{
                              background: i < (currentShooter === 'A' ? shotsRemainingA : shotsRemainingB) ? '#00ff87' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OT indicator */}
                  {(gamePhase.startsWith('ot_') || gamePhase === 'overtime_announce') && (
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-yellow-400/15 text-yellow-400">
                      OT RD {otRound}
                    </span>
                  )}

                  {/* Tiebreak indicator */}
                  {(gamePhase.startsWith('ft_') || gamePhase === 'forced_tiebreak_announce') && (
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-yellow-400/15 text-yellow-400">
                      TIEBREAK
                    </span>
                  )}

                  {/* Wager display */}
                  {betAmountCents > 0 && (
                    <span className="font-mono text-[10px] text-text-muted uppercase">
                      STAKE: ${(betAmountCents / 100).toFixed(2)}
                    </span>
                  )}
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

              {/* Canvas wrapped with MobileGameChrome */}
              <MobileGameChrome
                player1Name={role === 'A' ? 'You' : 'Player 1'}
                player2Name={role === 'B' ? 'You' : 'Player 2'}
                isPlayer1Turn={currentShooter === 'A'}
                player1Tracker={p1Tracker}
                player2Tracker={p2Tracker}
                wagerAmount={wagerDisplay}
                gameType="3 SHOT"
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
                    style={{ maxWidth: `${CANVAS_WIDTH}px`, touchAction: 'none' }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onTouchStart={handleCanvasTouchStart}
                    onTouchMove={handleCanvasTouchMove}
                    onTouchEnd={handleCanvasTouchEnd}
                    onTouchCancel={handleCanvasTouchCancel}
                  />
                </div>
              </MobileGameChrome>

              {/* Game over overlay */}
              {isFinished && gameState && winner && settlementResult && role && (
                <GameResultOverlay
                  outcome={deriveOutcome(settlementResult, role)}
                  amount={formatResultAmount(
                    deriveOutcome(settlementResult, role),
                    settlementResult.winnerPayout,
                    betAmountCents
                  )}
                  visible
                  mobile
                  onPlayAgain={handlePlayAgain}
                  onLobby={() => window.location.reload()}
                />
              )}
              {isFinished && gameState && winner && !settlementResult && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="pointer-events-auto rounded-sm px-6 py-4 text-center"
                    style={{ background: 'rgba(15,17,23,0.92)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <p className="font-display text-lg font-bold uppercase tracking-widest mb-1"
                      style={{ color: winner === role ? '#00ff87' : '#ff3b5c' }}
                    >
                      {winner === role ? 'Victory!' : 'Defeat'}
                    </p>
                    <p className="font-mono text-sm text-text-secondary mb-1">
                      P1: {scoreA} -- P2: {scoreB}
                    </p>
                    <button
                      onClick={handlePlayAgain}
                      className="font-mono text-xs uppercase tracking-widest px-5 py-2 rounded-sm bg-brand-400/90 text-black font-semibold hover:bg-brand-400 transition-colors"
                    >
                      Play Again
                    </button>
                  </div>
                </div>
              )}

              {/* Last shot info */}
              {lastShotInfo && !winner && (
                <Card padding="sm" className="game-shot-info">
                  <p className="font-mono text-xs text-text-secondary text-center">
                    {lastShotInfo}
                  </p>
                </Card>
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
