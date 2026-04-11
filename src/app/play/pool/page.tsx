'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Circle } from 'lucide-react';
import { useLandscapeLock } from '@/hooks/useLandscapeLock';
import { useSoundEnabled } from '@/hooks/useSoundEnabled';
import { RotatePrompt } from '@/components/ui/RotatePrompt';
import { MobileGameChrome } from '@/components/ui/MobileGameChrome';
import { GameMobileFAB } from '@/components/ui/GameMobileFAB';
import { useEventLog } from '../_shared/use-event-log';
import { useDemoAuth } from '../_shared/use-demo-auth';
import { useGameSession } from '../_shared/use-game-session';
import { PlayStakeWidget, type PlayStakeWidgetHandle } from '../_shared/PlayStakeWidget';
import { GameResultOverlay, deriveOutcome, formatResultAmount, type SettlementResult } from '../_shared/GameResultOverlay';
import { EventLog } from '../_shared/EventLog';
import { GameLobbyLayout } from '@/components/games/game-lobby-layout';
import type { LobbyMatchResult } from '@/components/lobby/LobbyContainer';
import { EffectsManager, generateBurstParticles, type PhysicsEvent } from '../_shared/game-effects';
import { GameAudio } from '../_shared/game-audio';
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
const TOUCH_OFFSET_Y = 60;
const MIN_DRAG_DISTANCE = 15;
const TOUCH_TARGET_RADIUS = BALL_RADIUS * 8;

// Premium table visuals
const BG_SURROUND = '#0d1b2a';
const FELT_COLOR = '#0a6e3a';
const RAIL_OUTER = '#4a1a0a';
const RAIL_INNER = '#7a3018';
const RAIL_HIGHLIGHT = '#5c2010';
const POCKET_VOID = '#050505';
const DIAMOND_COLOR = '#d4a868';

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
  moving: boolean;
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
  balls.push({ id: 0, x: cueX, y: cueY, vx: 0, vy: 0, pocketed: false, moving: false });

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
      balls.push({ id: rowBalls[col], x: bx, y: by, vx: 0, vy: 0, pocketed: false, moving: false });
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

function stepPhysics(balls: Ball[], shotResult: ShotResult, onEvent?: (e: PhysicsEvent) => void, onSettle?: () => void): void {
  const activeBalls = balls.filter(b => !b.pocketed);

  // Move — only update balls flagged as moving
  for (const b of activeBalls) {
    if (!b.moving) continue;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < VELOCITY_THRESHOLD) b.vx = 0;
    if (Math.abs(b.vy) < VELOCITY_THRESHOLD) b.vy = 0;
    if (b.vx === 0 && b.vy === 0) {
      b.moving = false;
    }
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
          a.moving = true;
          b.moving = true;
          if (onEvent) {
            const relVel = Math.sqrt(dvx * dvx + dvy * dvy);
            if (relVel > 3) {
              onEvent({ type: 'collision', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, velocity: relVel });
            }
          }
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
    if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx) * RAIL_RESTITUTION; hitRail = true; b.moving = true; }
    if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * RAIL_RESTITUTION; hitRail = true; b.moving = true; }
    if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * RAIL_RESTITUTION; hitRail = true; b.moving = true; }
    if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy) * RAIL_RESTITUTION; hitRail = true; b.moving = true; }
    if (hitRail && shotResult.contactMade) {
      shotResult.railAfterContact = true;
    }
  }

  // Pocket detection + near-miss
  for (const b of activeBalls) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const d = dist(b.x, b.y, p.x, p.y);
      if (d < p.radius) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        b.moving = false;
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

  // Settle detection
  if (onSettle && !activeBalls.some(b => b.moving)) {
    onSettle();
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

  // "POWER" label
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('POWER', meterX + meterW / 2, meterY - 6);

  // Track background — rounded rect
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

  // Fill from bottom — clipped to track shape
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
    joinFromLobby,
    resolveGame,
    setGameData,
    setBetId,
    reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');
  const { isMuted, toggleMute } = useSoundEnabled();
  const [showFABPanel, setShowFABPanel] = useState(false);

  // Game feel: effects + audio
  const effectsRef = useRef<EffectsManager | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  if (!effectsRef.current) effectsRef.current = new EffectsManager();
  if (!audioRef.current) audioRef.current = new GameAudio();

  useEffect(() => { audioRef.current?.setMuted(isMuted); }, [isMuted]);

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
  const activeTouchIdRef = useRef<number | null>(null);
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
    cueBall.moving = true;

    // Cue strike effect + audio
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

    let settled = false;
    const simulateStart = performance.now();
    const handleSettle = () => { settled = true; };

    const simulate = () => {
      // Force-settle safety net
      if (performance.now() - simulateStart > 5000) {
        console.warn('Force settle — balls did not reach rest within 5s');
        for (const b of ballsRef.current) { b.vx = 0; b.vy = 0; b.moving = false; }
        settled = true;
      } else {
        // Run multiple sub-steps per frame for stability
        for (let i = 0; i < 2; i++) {
          stepPhysics(ballsRef.current, shotResult, handlePhysicsEvent, handleSettle);
        }
      }
      if (!settled) { requestAnimationFrame(simulate); return; }

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

        // Win celebration
        if (gw === role) {
          effectsRef.current?.spawn({
            type: 'particleBurst',
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            duration: 1500,
            particles: generateBurstParticles(60, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
          });
          audioRef.current?.playWinChime();
        }

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
          cue.moving = false;
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
      ctx.fillStyle = BG_SURROUND;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawTable(ctx);

      // During opponent replay: run physics each frame
      if (animatingOpponentRef.current && opponentAnimEndRef.current) {
        // Run physics steps (same as the shooter's simulation)
        for (let i = 0; i < 2; i++) {
          stepPhysics(ballsRef.current, { firstContact: null, pocketed: [], cuePocketed: false, railAfterContact: false, contactMade: false });
        }

        // Check if all balls at rest
        if (!ballsRef.current.some(b => b.moving)) {
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
              b.moving = false;
            }
          }
        }
      }

      // Draw all balls (with near-miss rattle offset)
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

      // Game effects overlay
      effectsRef.current?.render(ctx, now);

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
        moving: false,
      }));

      if (!prevGameDataRef.current) {
        // Initial sync — snap directly, no animation
        ballsRef.current = newBalls;
      } else if (data.lastShot && data.lastShot.angle !== undefined && data.lastShot.preShotBalls) {
        // Replay the shot with full physics for realistic animation
        const ls = data.lastShot;
        // Restore pre-shot ball positions
        ballsRef.current = ls.preShotBalls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, pocketed: b.pocketed, moving: false }));
        // Apply shot velocity to cue ball
        const cue = ballsRef.current.find(b => b.id === 0);
        if (cue && !cue.pocketed) {
          cue.vx = Math.cos(ls.angle) * ls.power;
          cue.vy = Math.sin(ls.angle) * ls.power;
          cue.moving = true;
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
    if (!isMyTurnRef.current || shootingRef.current || winnerRef.current) return;
    if (phaseRef.current !== 'playing') return;
    const touch = e.touches[0];
    if (!touch) return;

    // Palm rejection: only accept first touch
    if (activeTouchIdRef.current !== null) return;

    // Ball-in-hand and call-pocket use raw position (no offset)
    const rawPos = getTouchCanvasPos(touch.clientX, touch.clientY);
    if (!rawPos) return;

    if (ballInHandRef.current) {
      const cueBall = ballsRef.current.find(b => b.id === 0);
      if (!cueBall) return;
      const nx = Math.max(OFFSET + BALL_RADIUS, Math.min(OFFSET + TABLE_WIDTH - BALL_RADIUS, rawPos.x));
      const ny = Math.max(OFFSET + BALL_RADIUS, Math.min(OFFSET + TABLE_HEIGHT - BALL_RADIUS, rawPos.y));
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
        if (dist(rawPos.x, rawPos.y, p.x, p.y) < p.radius + 15) {
          setCalledPocket(i);
          setNeedsCallPocket(false);
          setPoolPhase('aiming');
          return;
        }
      }
      return;
    }

    // Aiming: use offset position and expanded target
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
  }, [checkNeedsCallPocket, getTouchCanvasPos]);

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
    const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchIdRef.current);
    if (!touch) return;

    // Clear touch tracking unconditionally to prevent stuck state
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
  }, [executeShot]);

  const handleCanvasTouchCancel = useCallback(() => {
    activeTouchIdRef.current = null;
    aimingRef.current = false;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    shotPowerRef.current = 0;
  }, []);

  // Register native non-passive touch listeners to allow preventDefault
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

  // ---- PlayStake integration (same pattern as tictactoe) ----
  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: Player ${r}`, 'info');
    const result = await setup(r);
    if (result) {
      setPhase('lobby');
    }
  }, [setup, log, setPhase]);

  const handleMatched = useCallback(async (match: LobbyMatchResult) => {
    if (!authState) return;
    log(`Match locked in — bet ${match.betId.slice(0, 8)}...`, 'bet');
    betIdRef.current = match.betId;
    setBetAmountCents(match.stakeCents);
    await joinFromLobby({
      betId: match.betId,
      myRole: match.myRole,
      playerId: authState.playerId,
      playerAId: match.playerAUserId,
      gameType: 'pool',
    });
  }, [authState, joinFromLobby, log]);

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

  // joinFromLobby already starts the game-state poll for both roles.

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

  // ---- Mobile HUD: status pill message ----
  const myGroup = role ? groups[role] : null;
  const oppGroup = role ? groups[role === 'A' ? 'B' : 'A'] : null;
  const allPocketed = [...pocketedByA, ...pocketedByB];

  let mobileStatusMsg = '';
  if (isInGame) {
    if (winner) {
      mobileStatusMsg = winner === role ? 'You win!' : 'Opponent wins!';
    } else if (ballInHand && isMyTurn) {
      mobileStatusMsg = 'Ball in hand — tap to place';
    } else if (needsCallPocket && isMyTurn) {
      mobileStatusMsg = 'Call your pocket for the 8-ball';
    } else if (isMyTurn) {
      mobileStatusMsg = isBreakShot ? 'You are breaking — good luck!' : 'Your turn — drag to shoot';
    } else {
      mobileStatusMsg = "Opponent's turn...";
    }
  }

  // Ball tracker for P1 (solids or unassigned)
  const p1Group = role === 'A' ? myGroup : oppGroup;
  const p1Balls = p1Group === 'solids' ? solidBalls : p1Group === 'stripes' ? stripeBalls : solidBalls;
  const p1Tracker = (
    <div className="flex gap-[3px]">
      {p1Balls.map(id => (
        <span
          key={id}
          className="inline-block rounded-full"
          style={{
            width: 7, height: 7,
            background: allPocketed.includes(id) ? '#1a2a3a' : (p1Group ? BALL_COLORS[id] : '#3a4a5a'),
            border: allPocketed.includes(id) ? '1px solid #2a3a4a' : 'none',
          }}
        />
      ))}
    </div>
  );

  // Ball tracker for P2 (stripes or unassigned)
  const p2Group = role === 'B' ? myGroup : oppGroup;
  const p2Balls = p2Group === 'solids' ? solidBalls : p2Group === 'stripes' ? stripeBalls : stripeBalls;
  const p2Tracker = (
    <div className="flex gap-[3px]">
      {p2Balls.map(id => (
        <span
          key={id}
          className="inline-block rounded-full"
          style={{
            width: 7, height: 7,
            background: allPocketed.includes(id) ? '#1a2a3a' : (p2Group ? BALL_COLORS[id] : '#3a4a5a'),
            border: allPocketed.includes(id) ? '1px solid #2a3a4a' : 'none',
          }}
        />
      ))}
    </div>
  );

  const wagerDisplay = betAmountCents > 0 ? `$${(betAmountCents / 100).toFixed(2)}` : undefined;

  // Pre-game: render the new lobby layout
  if (!isInGame) {
    return (
      <GameLobbyLayout
        gameKey="pool"
        phase={phase === 'role-select' || phase === 'lobby' ? phase : 'role-select'}
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

              {/* Mobile HUD */}
              <MobileGameChrome
                player1Name={role === 'A' ? 'You' : 'Player 1'}
                player2Name={role === 'B' ? 'You' : 'Player 2'}
                isPlayer1Turn={currentTurn === 'A'}
                player1Tracker={p1Tracker}
                player2Tracker={p2Tracker}
                wagerAmount={wagerDisplay}
                gameType="8 BALL"
                onExit={() => window.location.reload()}
                isMuted={isMuted}
                onSoundToggle={toggleMute}
                onFABTap={() => setShowFABPanel(true)}
                statusMessage={mobileStatusMsg}
              >
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
                    onTouchCancel={handleCanvasTouchCancel}
                  />
                </div>
              </MobileGameChrome>

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
                    mobile
                    onPlayAgain={handlePlayAgain}
                    onLobby={() => window.location.reload()}
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
