'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Disc } from 'lucide-react';
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
import { GameLobbyLayout } from '@/components/games/game-lobby-layout';
import type { LobbyMatchResult } from '@/components/lobby/LobbyContainer';
import { EventLog } from '../_shared/EventLog';
import type { PlayerRole } from '../_shared/types';

// ---------------------------------------------------------------------------
// Constants (reused from pool physics)
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

const OFFSET = RAIL_INSET + 10;

// Bullseye-specific
const ROUNDS_TO_WIN = 2;
const SHOT_CLOCK_SECONDS = 12;
const SHOT_CLOCK_WARNING = 3;
const AUTO_SHOT_POWER_FRAC = 0.15;
const TABLE_UNIT = TABLE_WIDTH / 100; // 8px per table unit
const MAX_DISTANCE = 112; // foul penalty (> corner-to-corner ~111.8)
const POCKET_EXCLUSION = 0.12 * TABLE_WIDTH; // 96px
const BULLSEYE_INNER = 3 * TABLE_UNIT; // 24px
const BULLSEYE_MIDDLE = 8 * TABLE_UNIT; // 64px
const BULLSEYE_OUTER = 15 * TABLE_UNIT; // 120px
const ROUND_RESULT_MS = 1500;
const ROUND_TRANSITION_MS = 1500;
const P2_APPEAR_DELAY_MS = 500;
const HEAD_X = OFFSET + TABLE_WIDTH * 0.25;
const HEAD_Y = OFFSET + TABLE_HEIGHT / 2;

const PLAYER_COLORS = { A: '#f5d800', B: '#0055cc' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Ball {
  id: string; // 'A' or 'B'
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  moving: boolean;
}

interface ShotResult {
  pocketed: string[]; // ball ids that were pocketed
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

interface BullseyeGameData {
  phase: BullseyePhase;
  roundNumber: number;
  firstShooter: 'A' | 'B';
  bullseye: { x: number; y: number };
  previousQuadrant: number | null;
  ballA: { x: number; y: number; pocketed: boolean } | null;
  ballB: { x: number; y: number; pocketed: boolean } | null;
  distanceA: number | null;
  distanceB: number | null;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | null;
  lastShot: { player: 'A' | 'B'; angle: number; power: number } | null;
  shotNumber: number;
}

// ---------------------------------------------------------------------------
// Pocket positions
// ---------------------------------------------------------------------------
function getPockets() {
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
// Helpers
// ---------------------------------------------------------------------------
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}


function distanceInTableUnits(bx: number, by: number, tx: number, ty: number) {
  return dist(bx, by, tx, ty) / TABLE_UNIT;
}

// ---------------------------------------------------------------------------
// Physics (simplified — only 1-2 balls, no rack)
// ---------------------------------------------------------------------------
function stepPhysics(
  balls: Ball[],
  shotResult: ShotResult,
  onEvent?: (e: PhysicsEvent) => void,
  onSettle?: () => void,
): void {
  const activeBalls = balls.filter(b => !b.pocketed);

  // Move + friction + hard-zero (only moving balls)
  for (const b of activeBalls) {
    if (!b.moving) continue;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < VELOCITY_THRESHOLD && Math.abs(b.vy) < VELOCITY_THRESHOLD) {
      b.vx = 0;
      b.vy = 0;
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
          a.moving = true;
          b.moving = true;
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

  // Rail bounces
  const minX = OFFSET + BALL_RADIUS;
  const maxX = OFFSET + TABLE_WIDTH - BALL_RADIUS;
  const minY = OFFSET + BALL_RADIUS;
  const maxY = OFFSET + TABLE_HEIGHT - BALL_RADIUS;
  for (const b of activeBalls) {
    if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx) * RAIL_RESTITUTION; b.moving = true; }
    if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * RAIL_RESTITUTION; b.moving = true; }
    if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * RAIL_RESTITUTION; b.moving = true; }
    if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy) * RAIL_RESTITUTION; b.moving = true; }
  }

  // Pocket detection
  for (const b of activeBalls) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const d = dist(b.x, b.y, p.x, p.y);
      if (d < p.radius) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        b.moving = false;
        shotResult.pocketed.push(b.id);
        if (onEvent) {
          onEvent({ type: 'pocketed', ballId: b.id, pocketX: p.x, pocketY: p.y });
        }
        break;
      } else if (onEvent && d < p.radius * 2.5 && (b.vx * b.vx + b.vy * b.vy) > 4) {
        onEvent({ type: 'nearMiss', ballId: b.id, pocketX: p.x, pocketY: p.y });
      }
    }
  }

  // Settle detection — fires when no active ball is moving
  if (onSettle && !activeBalls.some(b => b.moving)) {
    onSettle();
  }
}

// ---------------------------------------------------------------------------
// Bullseye placement algorithm
// ---------------------------------------------------------------------------
function placeBullseye(prevQuadrant: number | null): { x: number; y: number; quadrant: number } {
  for (let attempt = 0; attempt < 100; attempt++) {
    // Pick zone
    const roll = Math.random();
    let normX: number, normY: number;

    if (roll < 0.30) {
      // Centre diamond
      normX = 0.35 + Math.random() * 0.30;
      normY = 0.30 + Math.random() * 0.40;
    } else if (roll < 0.75) {
      // Mid-table
      normX = 0.15 + Math.random() * 0.70;
      normY = Math.random();
    } else {
      // Rail-adjacent
      const rail = Math.floor(Math.random() * 4);
      if (rail === 0) { normY = Math.random() * 0.15; normX = 0.15 + Math.random() * 0.70; }
      else if (rail === 1) { normY = 0.85 + Math.random() * 0.15; normX = 0.15 + Math.random() * 0.70; }
      else if (rail === 2) { normX = 0.15 + Math.random() * 0.05; normY = 0.15 + Math.random() * 0.70; }
      else { normX = 0.80 + Math.random() * 0.05; normY = 0.15 + Math.random() * 0.70; }
    }

    // Exclusions
    if (normX < 0.15 || normX > 0.85) continue;
    if (normY < 0.0 || normY > 1.0) continue;

    const cx = OFFSET + normX * TABLE_WIDTH;
    const cy = OFFSET + normY * TABLE_HEIGHT;

    // Pocket exclusion
    if (POCKETS.some(p => dist(cx, cy, p.x, p.y) < POCKET_EXCLUSION)) continue;

    // Quadrant check
    const quadrant = (normX >= 0.5 ? 1 : 0) + (normY >= 0.5 ? 2 : 0);
    if (quadrant === prevQuadrant) continue;

    return { x: cx, y: cy, quadrant };
  }

  // Fallback
  return { x: OFFSET + TABLE_WIDTH / 2, y: OFFSET + TABLE_HEIGHT / 2, quadrant: -1 };
}

// ---------------------------------------------------------------------------
// Raycast for aim line
// ---------------------------------------------------------------------------
function raycastFirstBall(
  ox: number, oy: number, dx: number, dy: number, balls: Ball[], skipId: string
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
        closest = { ball: b, cx: ox + ndx * (t - backDist), cy: oy + ndy * (t - backDist), t: t - backDist };
      }
    }
  }
  return closest ? { ball: closest.ball, cx: closest.cx, cy: closest.cy } : null;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function lightenColor(hex: string, pct: number) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + pct);
  const g = Math.min(255, ((num >> 8) & 0xff) + pct);
  const b = Math.min(255, (num & 0xff) + pct);
  return `rgb(${r},${g},${b})`;
}

function drawPlayerBall(ctx: CanvasRenderingContext2D, b: Ball) {
  if (b.pocketed) return;
  const color = PLAYER_COLORS[b.id as 'A' | 'B'] || '#888';

  ctx.save();
  const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_RADIUS);
  grad.addColorStop(0, lightenColor(color, 40));
  grad.addColorStop(1, color);
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Letter label
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = `bold ${BALL_RADIUS * 0.85}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.id, b.x, b.y + 0.5);

  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
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

function drawBullseye(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, nearestBallDist: number) {
  const pulse = 0.5 + 0.5 * Math.sin(animFrame * 0.04);
  const frozen = nearestBallDist < 10 * TABLE_UNIT;
  const pulseFactor = frozen ? 1.0 : pulse;

  ctx.save();

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_OUTER, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,215,0,${0.03 + 0.02 * pulseFactor})`;
  ctx.fill();

  // Middle ring
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_MIDDLE, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,215,0,${0.08 + 0.04 * pulseFactor})`;
  ctx.fill();

  // Inner ring
  const innerGlow = nearestBallDist < 3 * TABLE_UNIT;
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_INNER, 0, Math.PI * 2);
  ctx.fillStyle = innerGlow
    ? `rgba(255,215,0,${0.35 + 0.05 * pulseFactor})`
    : `rgba(255,215,0,${0.15 + 0.10 * pulseFactor})`;
  ctx.fill();

  // Ring outlines
  for (const r of [BULLSEYE_INNER, BULLSEYE_MIDDLE, BULLSEYE_OUTER]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${0.15 + 0.10 * pulseFactor})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Crosshair
  ctx.strokeStyle = `rgba(255,215,0,${0.4 + 0.2 * pulseFactor})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = frozen ? 'rgba(255,215,0,1.0)' : `rgba(255,215,0,${0.6 + 0.3 * pulseFactor})`;
  ctx.fill();

  ctx.restore();
}

function drawLeaderLine(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  bullseye: { x: number; y: number },
  distance: number,
  status: 'winner' | 'loser' | 'pending' | 'foul'
) {
  if (ball.pocketed && status === 'foul') {
    // Show FOUL text above where ball was
    ctx.save();
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b5c';
    ctx.fillText('FOUL', ball.x, ball.y - 18);
    ctx.restore();
    return;
  }
  if (ball.pocketed) return;

  ctx.save();

  // Line
  if (status === 'winner') {
    ctx.strokeStyle = '#00ff87';
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
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  if (status === 'winner') ctx.fillStyle = '#00ff87';
  else if (status === 'loser') ctx.fillStyle = '#ff3b5c';
  else ctx.fillStyle = 'rgba(255,255,255,0.7)';

  ctx.fillText(distance.toFixed(1), ball.x, ball.y - 16);

  ctx.restore();
}

function drawPowerMeter(ctx: CanvasRenderingContext2D, power: number) {
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

function drawCueStick(ctx: CanvasRenderingContext2D, ball: Ball, angle: number, power: number) {
  const stickLen = 200;
  const tipOff = BALL_RADIUS + 4 + power * 60;
  const tipX = ball.x - Math.cos(angle) * tipOff;
  const tipY = ball.y - Math.sin(angle) * tipOff;
  const endX = tipX - Math.cos(angle) * stickLen;
  const endY = tipY - Math.sin(angle) * stickLen;

  ctx.save();
  ctx.strokeStyle = '#d4a853'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(endX, endY); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + Math.cos(angle) * 6, tipY + Math.sin(angle) * 6); ctx.stroke();
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(endX, endY); ctx.lineTo(endX - Math.cos(angle) * 30, endY - Math.sin(angle) * 30); ctx.stroke();
  ctx.restore();
}

function drawAimLine(ctx: CanvasRenderingContext2D, ball: Ball, angle: number, balls: Ball[]) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;

  const hit = raycastFirstBall(ball.x, ball.y, dx, dy, balls, ball.id);
  if (hit) {
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(hit.cx, hit.cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(hit.cx, hit.cy, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([3, 3]); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + dx * 600, ball.y + dy * 600); ctx.stroke();
  }
  ctx.restore();
}

function drawShotClock(ctx: CanvasRenderingContext2D, secondsLeft: number) {
  const x = OFFSET + TABLE_WIDTH - 5;
  const y = OFFSET + 20;
  ctx.save();
  ctx.font = 'bold 18px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';

  // Color transitions: white > 8s, amber <= 8s, red <= 4s
  let color: string;
  if (secondsLeft <= 4) {
    const p = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
    color = `rgba(255,${Math.floor(60 * p)},${Math.floor(92 * p)},${0.7 + 0.3 * p})`;
  } else if (secondsLeft <= 8) {
    color = '#ffb800';
  } else {
    color = 'rgba(255,255,255,0.5)';
  }

  ctx.fillStyle = color;
  ctx.fillText(String(Math.ceil(secondsLeft)), x, y);

  // Progress bar below text
  const barW = 60;
  const barH = 3;
  const barX = x - barW;
  const barY = y + 14;
  const progress = Math.max(0, secondsLeft / SHOT_CLOCK_SECONDS);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(barX, barY, barW, barH);

  if (secondsLeft <= 4) {
    ctx.fillStyle = '#ff3b5c';
  } else if (secondsLeft <= 8) {
    ctx.fillStyle = '#ffb800';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
  }
  ctx.fillRect(barX, barY, barW * progress, barH);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BullseyePoolPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('bullseye', log);
  const {
    sessionId, gameState, phase, setPhase,
    joinFromLobby, resolveGame,
    setGameData, setBetId, reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');
  const { isMuted, toggleMute } = useSoundEnabled();
  const effectsRef = useRef<EffectsManager | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  if (!effectsRef.current) effectsRef.current = new EffectsManager();
  if (!audioRef.current) audioRef.current = new GameAudio();

  useEffect(() => { audioRef.current?.setMuted(isMuted); }, [isMuted]);

  const [showFABPanel, setShowFABPanel] = useState(false);

  // ---- Game state ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const [gamePhase, setGamePhase] = useState<BullseyePhase>('round_setup');
  const [roundNumber, setRoundNumber] = useState(1);
  const [firstShooter, setFirstShooter] = useState<'A' | 'B'>('A');
  const [bullseye, setBullseye] = useState<{ x: number; y: number }>({ x: OFFSET + TABLE_WIDTH / 2, y: OFFSET + TABLE_HEIGHT / 2 });
  const [prevQuadrant, setPrevQuadrant] = useState<number | null>(null);
  const [distanceA, setDistanceA] = useState<number | null>(null);
  const [distanceB, setDistanceB] = useState<number | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [, setRenderTick] = useState(0);

  const shotNumberRef = useRef(0);
  const shootingRef = useRef(false);
  const aimingRef = useRef(false);
  const activeTouchIdRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const shotPowerRef = useRef(0);
  const aimAngleRef = useRef(0);
  const animFrameRef = useRef(0);
  const prevGameDataRef = useRef<BullseyeGameData | null>(null);
  const animatingOpponentRef = useRef(false);
  const gamePhaseRef = useRef(gamePhase);
  gamePhaseRef.current = gamePhase;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const winnerRef = useRef(winner);
  winnerRef.current = winner;

  // Shot clock
  const shotClockStartRef = useRef<number | null>(null);
  const shotClockFiredRef = useRef(false);
  const [shotClockRemaining, setShotClockRemaining] = useState(SHOT_CLOCK_SECONDS);
  const lastTickSecRef = useRef<number | null>(null);

  // Who shoots when
  const secondShooter = firstShooter === 'A' ? 'B' : 'A';
  const currentShooter = (() => {
    if (gamePhase === 'p1_aiming' || gamePhase === 'p1_rolling') return firstShooter;
    if (gamePhase === 'p2_aiming' || gamePhase === 'p2_rolling') return secondShooter;
    return firstShooter;
  })();
  const isMyTurn = currentShooter === role;
  const canShoot = isMyTurn && !shootingRef.current && phase === 'playing' && !winner &&
    (gamePhase === 'p1_aiming' || gamePhase === 'p2_aiming');
  const canShootRef = useRef(canShoot);
  canShootRef.current = canShoot;
  const bullseyeRef = useRef(bullseye);
  bullseyeRef.current = bullseye;
  const distanceARef = useRef(distanceA);
  distanceARef.current = distanceA;
  const distanceBRef = useRef(distanceB);
  distanceBRef.current = distanceB;
  const currentShooterRef = useRef(currentShooter);
  currentShooterRef.current = currentShooter;
  const shotClockRemainingRef = useRef(shotClockRemaining);
  shotClockRemainingRef.current = shotClockRemaining;

  // ---- Shot clock effect ----
  useEffect(() => {
    if (!canShoot) { shotClockStartRef.current = null; shotClockFiredRef.current = false; return; }
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
        aimingRef.current = false;
        dragStartRef.current = null;
        dragCurrentRef.current = null;
        window.dispatchEvent(new CustomEvent('bullseye-auto-fire', {
          detail: { angle: aimAngleRef.current || 0, power: AUTO_SHOT_POWER_FRAC * MAX_SHOT_POWER }
        }));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [canShoot, gamePhase]);

  // ---- Sync to server ----
  const syncGameData = useCallback((overrides?: Partial<BullseyeGameData>) => {
    const data: BullseyeGameData = {
      phase: gamePhase, roundNumber, firstShooter, bullseye, previousQuadrant: prevQuadrant,
      ballA: ballsRef.current.find(b => b.id === 'A') ? { x: ballsRef.current.find(b => b.id === 'A')!.x, y: ballsRef.current.find(b => b.id === 'A')!.y, pocketed: ballsRef.current.find(b => b.id === 'A')!.pocketed } : null,
      ballB: ballsRef.current.find(b => b.id === 'B') ? { x: ballsRef.current.find(b => b.id === 'B')!.x, y: ballsRef.current.find(b => b.id === 'B')!.y, pocketed: ballsRef.current.find(b => b.id === 'B')!.pocketed } : null,
      distanceA, distanceB, scoreA, scoreB, winner,
      lastShot: null, shotNumber: shotNumberRef.current,
      ...overrides,
    };
    setGameData(data as unknown as Record<string, unknown>);
  }, [gamePhase, roundNumber, firstShooter, bullseye, prevQuadrant, distanceA, distanceB, scoreA, scoreB, winner, setGameData]);

  // ---- Settle winner ----
  const settleWinner = useCallback((w: 'A' | 'B') => {
    setWinner(w);
    setGamePhase('match_over');
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
          if (settle) { setSettlementResult(settle as SettlementResult); widgetHandleRef.current?.refreshBalance(); }
        });
      }
    });
    syncGameData({ phase: 'match_over', winner: w });
  }, [role, resolveGame, gameState, authState, reportAndSettle, syncGameData]);

  // ---- Start a new round ----
  const startRound = useCallback((rNum: number, prevQ: number | null) => {
    const placement = placeBullseye(prevQ);
    setBullseye({ x: placement.x, y: placement.y });
    setPrevQuadrant(placement.quadrant);

    effectsRef.current?.spawn({
      type: 'sonarPing',
      x: placement.x,
      y: placement.y,
      maxRadius: BULLSEYE_OUTER,
      duration: 600,
    });

    const shooter = rNum % 2 === 1 ? 'A' : 'B';
    setFirstShooter(shooter);
    setDistanceA(null);
    setDistanceB(null);

    // Place first shooter's ball
    const ball: Ball = { id: shooter, x: HEAD_X, y: HEAD_Y, vx: 0, vy: 0, pocketed: false, moving: false };
    ballsRef.current = [ball];

    setGamePhase('p1_aiming');
    setStatusMsg(`Round ${rNum}`);
  }, []);

  // ---- Execute shot ----
  const executeShot = useCallback((power: number, angle: number) => {
    if (shootingRef.current) return;
    shootingRef.current = true;
    shotClockStartRef.current = null;

    const shooterId = currentShooter;
    const ball = ballsRef.current.find(b => b.id === shooterId);
    if (!ball || ball.pocketed) { shootingRef.current = false; return; }

    // Read from ref (not closure) and sync both ref + state
    const gp = gamePhaseRef.current;
    if (gp === 'p1_aiming') { setGamePhase('p1_rolling'); gamePhaseRef.current = 'p1_rolling'; }
    else if (gp === 'p2_aiming') { setGamePhase('p2_rolling'); gamePhaseRef.current = 'p2_rolling'; }

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

    const shotResult: ShotResult = { pocketed: [] };

    const handlePhysicsEvent = (event: PhysicsEvent) => {
      if (event.type === 'collision') {
        if (effectsRef.current?.spawnCollision(event.x, event.y, event.velocity, 0, 0)) {
          audioRef.current?.playCollision(event.velocity);
        }
      } else if (event.type === 'pocketed') {
        const color = PLAYER_COLORS[event.ballId as 'A' | 'B'] || '#888';
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
      if (performance.now() - simulateStart > 5000) {
        console.warn('Force settle — balls did not reach rest within 5s');
        for (const b of ballsRef.current) { b.vx = 0; b.vy = 0; b.moving = false; }
        settled = true;
      } else {
        for (let i = 0; i < 2; i++) {
          stepPhysics(ballsRef.current, shotResult, handlePhysicsEvent, handleSettle);
        }
      }

      if (!settled) {
        requestAnimationFrame(simulate);
        return;
      }

      shootingRef.current = false;
      shotNumberRef.current++;
      const shotNum = shotNumberRef.current;

      const gp = gamePhaseRef.current;

      if (gp === 'p1_rolling') {
        // First shooter settled
        const b = ballsRef.current.find(bl => bl.id === firstShooter)!;
        const d = b.pocketed ? MAX_DISTANCE : distanceInTableUnits(b.x, b.y, bullseye.x, bullseye.y);

        if (firstShooter === 'A') setDistanceA(d); else setDistanceB(d);

        if (!b.pocketed) {
          const dPx = d * TABLE_UNIT;
          if (dPx < BULLSEYE_INNER) {
            effectsRef.current?.spawn({ type: 'bullseyeLanding', x: b.x, y: b.y, zone: 'inner', duration: 400 });
          } else if (dPx < BULLSEYE_MIDDLE) {
            effectsRef.current?.spawn({ type: 'bullseyeLanding', x: b.x, y: b.y, zone: 'middle', duration: 300 });
          }
          audioRef.current?.playBullseyeSettle(d);
        }

        if (b.pocketed) {
          setStatusMsg(`FOUL! ${firstShooter === 'A' ? 'Player A' : 'Player B'} ball pocketed.`);
          log(`P${firstShooter}: FOUL - ball pocketed`, 'error');
        } else {
          setStatusMsg(`${firstShooter === 'A' ? 'P1' : 'P2'} distance: ${d.toFixed(1)}`);
          log(`P${firstShooter}: Distance ${d.toFixed(1)}`, 'info');
        }

        setGamePhase('p1_settled');

        // After a delay, place second shooter's ball
        setTimeout(() => {
          // Place second shooter's ball
          let spawnX = HEAD_X, spawnY = HEAD_Y;
          // Check overlap with first shooter's ball
          if (!b.pocketed && dist(spawnX, spawnY, b.x, b.y) < BALL_RADIUS * 3) {
            spawnY = HEAD_Y - BALL_RADIUS * 4;
            if (spawnY < OFFSET + BALL_RADIUS) spawnY = HEAD_Y + BALL_RADIUS * 4;
          }
          const ball2: Ball = { id: secondShooter, x: spawnX, y: spawnY, vx: 0, vy: 0, pocketed: false, moving: false };
          ballsRef.current = [...ballsRef.current.filter(bl => bl.id === firstShooter), ball2];
          setGamePhase('p2_aiming');
          gamePhaseRef.current = 'p2_aiming';

          syncGameData({
            phase: 'p2_aiming',
            [firstShooter === 'A' ? 'distanceA' : 'distanceB']: d,
            lastShot: { player: firstShooter, angle, power },
            shotNumber: shotNum,
          });
        }, P2_APPEAR_DELAY_MS);
        return;
      }

      if (gp === 'p2_rolling') {
        // Second shooter settled
        const b = ballsRef.current.find(bl => bl.id === secondShooter)!;
        const d2 = b.pocketed ? MAX_DISTANCE : distanceInTableUnits(b.x, b.y, bullseye.x, bullseye.y);

        if (secondShooter === 'A') setDistanceA(d2); else setDistanceB(d2);

        if (!b.pocketed) {
          const dPx2 = d2 * TABLE_UNIT;
          if (dPx2 < BULLSEYE_INNER) {
            effectsRef.current?.spawn({ type: 'bullseyeLanding', x: b.x, y: b.y, zone: 'inner', duration: 400 });
          } else if (dPx2 < BULLSEYE_MIDDLE) {
            effectsRef.current?.spawn({ type: 'bullseyeLanding', x: b.x, y: b.y, zone: 'middle', duration: 300 });
          }
          audioRef.current?.playBullseyeSettle(d2);
        }

        // Also re-measure first shooter (might have been knocked)
        const b1 = ballsRef.current.find(bl => bl.id === firstShooter);
        let d1 = firstShooter === 'A' ? distanceA : distanceB;
        if (b1) {
          d1 = b1.pocketed ? MAX_DISTANCE : distanceInTableUnits(b1.x, b1.y, bullseye.x, bullseye.y);
          if (firstShooter === 'A') setDistanceA(d1); else setDistanceB(d1);
        }
        d1 = d1 ?? MAX_DISTANCE;

        if (b.pocketed) {
          log(`P${secondShooter}: FOUL - ball pocketed`, 'error');
        } else {
          log(`P${secondShooter}: Distance ${d2.toFixed(1)}`, 'info');
        }

        setGamePhase('round_result');

        // Determine round winner
        setTimeout(() => {
          // Check for double foul
          if (d1 >= MAX_DISTANCE && d2 >= MAX_DISTANCE) {
            setStatusMsg('DOUBLE FOUL -- Round replayed');
            log('Double foul — replaying round', 'error');
            setTimeout(() => startRound(roundNumber, prevQuadrant), ROUND_TRANSITION_MS);
            return;
          }

          let newScoreA = scoreA;
          let newScoreB = scoreB;
          const dA = firstShooter === 'A' ? d1 : d2;
          const dB = firstShooter === 'A' ? d2 : d1;

          if (Math.abs(dA - dB) < 0.005) {
            // Tie
            newScoreA += 0.5;
            newScoreB += 0.5;
            setStatusMsg('ROUND TIED -- 0.5 EACH');
            log(`Round ${roundNumber} tied. Score: ${newScoreA}-${newScoreB}`, 'info');
          } else if (dA < dB) {
            newScoreA += 1;
            setStatusMsg(`PLAYER A WINS ROUND (${dA.toFixed(1)} vs ${dB.toFixed(1)})`);
            log(`Round ${roundNumber}: P1 wins. Score: ${newScoreA}-${newScoreB}`, 'success');
          } else {
            newScoreB += 1;
            setStatusMsg(`PLAYER B WINS ROUND (${dB.toFixed(1)} vs ${dA.toFixed(1)})`);
            log(`Round ${roundNumber}: P2 wins. Score: ${newScoreA}-${newScoreB}`, 'success');
          }

          setScoreA(newScoreA);
          setScoreB(newScoreB);

          syncGameData({
            phase: 'round_result',
            distanceA: dA, distanceB: dB,
            scoreA: newScoreA, scoreB: newScoreB,
            lastShot: { player: secondShooter, angle, power },
            shotNumber: shotNum,
          });

          // Check match end
          setTimeout(() => {
            if (newScoreA >= ROUNDS_TO_WIN) {
              settleWinner('A');
            } else if (newScoreB >= ROUNDS_TO_WIN) {
              settleWinner('B');
            } else {
              // Next round
              const nextRound = roundNumber + 1;
              setRoundNumber(nextRound);
              setGamePhase('round_transition');
              setTimeout(() => startRound(nextRound, prevQuadrant), ROUND_TRANSITION_MS);
            }
          }, ROUND_RESULT_MS);
        }, ROUND_RESULT_MS);
        return;
      }
    };

    requestAnimationFrame(simulate);
  }, [gamePhase, currentShooter, firstShooter, secondShooter, bullseye, distanceA, distanceB, scoreA, scoreB, roundNumber, prevQuadrant, log, syncGameData, settleWinner, startRound]);

  // Auto-fire listener
  useEffect(() => {
    const handler = (e: Event) => {
      const { angle, power } = (e as CustomEvent).detail;
      if (canShootRef.current && !shootingRef.current) executeShot(power, angle);
    };
    window.addEventListener('bullseye-auto-fire', handler);
    return () => window.removeEventListener('bullseye-auto-fire', handler);
  }, [executeShot]);

  // ---- Canvas rendering ----
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

      // Bullseye
      const be = bullseyeRef.current;
      let nearestDist = Infinity;
      for (const b of ballsRef.current) {
        if (!b.pocketed) {
          const d = dist(b.x, b.y, be.x, be.y);
          if (d < nearestDist) nearestDist = d;
        }
      }
      drawBullseye(ctx, be.x, be.y, animFrameRef.current, nearestDist);

      // Opponent replay physics
      if (animatingOpponentRef.current) {
        for (let i = 0; i < 2; i++) stepPhysics(ballsRef.current, { pocketed: [] });
        if (!ballsRef.current.some(b => b.moving)) animatingOpponentRef.current = false;
      }

      // Draw balls
      const now = performance.now();
      for (const b of ballsRef.current) {
        const rattleX = effectsRef.current?.getRattleOffset(b.id, now) ?? 0;
        if (rattleX !== 0) {
          const origX = b.x;
          b.x += rattleX;
          drawPlayerBall(ctx, b);
          b.x = origX;
        } else {
          drawPlayerBall(ctx, b);
        }
      }

      // Leader lines (after both settle or after P1 settles)
      const ballA = ballsRef.current.find(b => b.id === 'A');
      const ballB = ballsRef.current.find(b => b.id === 'B');
      const dA = distanceARef.current;
      const dB = distanceBRef.current;
      if (dA != null && ballA) {
        const statusA = dB != null
          ? (dA <= MAX_DISTANCE - 1 ? (dA <= dB ? 'winner' : 'loser') : 'foul')
          : (dA >= MAX_DISTANCE ? 'foul' : 'pending');
        drawLeaderLine(ctx, ballA, be, dA, statusA as 'winner' | 'loser' | 'pending' | 'foul');
      }
      if (dB != null && ballB) {
        const statusB = dA != null
          ? (dB <= MAX_DISTANCE - 1 ? (dB < dA ? 'winner' : 'loser') : 'foul')
          : (dB >= MAX_DISTANCE ? 'foul' : 'pending');
        drawLeaderLine(ctx, ballB, be, dB, statusB as 'winner' | 'loser' | 'pending' | 'foul');
      }

      // Aiming visuals
      const shooterBall = ballsRef.current.find(b => b.id === currentShooterRef.current && !b.pocketed);
      if (shooterBall && aimingRef.current && dragStartRef.current) {
        drawAimLine(ctx, shooterBall, aimAngleRef.current, ballsRef.current);
        drawCueStick(ctx, shooterBall, aimAngleRef.current, shotPowerRef.current);
        drawPowerMeter(ctx, shotPowerRef.current);
      }

      // Shot clock now shown in status pill (not on canvas)
      if (canShootRef.current && !shootingRef.current) {
        // Shot clock tick sound under 5 seconds
        if (shotClockRemainingRef.current <= 5 && shotClockRemainingRef.current > 0) {
          const sec = Math.ceil(shotClockRemainingRef.current);
          if (lastTickSecRef.current !== sec) {
            lastTickSecRef.current = sec;
            audioRef.current?.playTick();
          }
        }
      } else {
        lastTickSecRef.current = null;
      }

      effectsRef.current?.render(ctx, now);

      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [phase]); // Only recreate when entering/exiting game — volatile state read via refs

  // ---- Poll for opponent ----
  useEffect(() => {
    if (!gameState?.gameData) return;
    const data = gameState.gameData as unknown as BullseyeGameData;
    if (data.shotNumber == null) return;

    if (!prevGameDataRef.current || data.shotNumber > prevGameDataRef.current.shotNumber) {
      // Reconstruct balls from server
      const newBalls: Ball[] = [];
      if (data.ballA) newBalls.push({ id: 'A', x: data.ballA.x, y: data.ballA.y, vx: 0, vy: 0, pocketed: data.ballA.pocketed, moving: false });
      if (data.ballB) newBalls.push({ id: 'B', x: data.ballB.x, y: data.ballB.y, vx: 0, vy: 0, pocketed: data.ballB.pocketed, moving: false });

      if (data.lastShot && data.lastShot.player !== role) {
        // Replay opponent's shot
        const shooterBall = newBalls.find(b => b.id === data.lastShot!.player);
        if (shooterBall && !shooterBall.pocketed) {
          // We need pre-shot positions; for now snap to result
          ballsRef.current = newBalls;
        }
      } else {
        ballsRef.current = newBalls;
      }

      setGamePhase(data.phase);
      setRoundNumber(data.roundNumber);
      setFirstShooter(data.firstShooter);
      setBullseye(data.bullseye);
      if (data.previousQuadrant != null) setPrevQuadrant(data.previousQuadrant);
      if (data.distanceA != null) setDistanceA(data.distanceA);
      if (data.distanceB != null) setDistanceB(data.distanceB);
      setScoreA(data.scoreA);
      setScoreB(data.scoreB);
      shotNumberRef.current = data.shotNumber;

      if (data.winner) { setWinner(data.winner); setGamePhase('match_over'); }
    }
    prevGameDataRef.current = data;
  }, [gameState, role]);

  // ---- Input handlers ----
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width), y: (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (shootingRef.current || winnerRef.current) return;
    if (phaseRef.current !== 'playing') return;
    if (gamePhaseRef.current !== 'p1_aiming' && gamePhaseRef.current !== 'p2_aiming') return;
    const pos = getCanvasPos(e);
    const ball = ballsRef.current.find(b => b.id === currentShooterRef.current && !b.pocketed);
    if (!ball) return;
    if (dist(pos.x, pos.y, ball.x, ball.y) < BALL_RADIUS * 4) {
      aimingRef.current = true;
      dragStartRef.current = pos;
      dragCurrentRef.current = pos;
      shotPowerRef.current = 0;
      aimAngleRef.current = 0;
    }
  }, [canShoot, getCanvasPos, currentShooter]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || !dragStartRef.current) return;
    const pos = getCanvasPos(e);
    dragCurrentRef.current = pos;
    const dx = dragStartRef.current.x - pos.x, dy = dragStartRef.current.y - pos.y;
    shotPowerRef.current = Math.min(Math.sqrt(dx * dx + dy * dy) / MAX_DRAG_DISTANCE, 1.0);
    aimAngleRef.current = Math.atan2(dy, dx);
    setRenderTick(t => t + 1);
  }, [getCanvasPos]);

  const handleMouseUp = useCallback(() => {
    if (!aimingRef.current) return;
    aimingRef.current = false;
    const power = shotPowerRef.current * MAX_SHOT_POWER;
    const angle = aimAngleRef.current;
    dragStartRef.current = null; dragCurrentRef.current = null;
    if (power < 0.5) { shotPowerRef.current = 0; return; }
    executeShot(power, angle);
  }, [executeShot]);

  // Touch handlers (with palm rejection, touch offset, expanded target, min drag distance)
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // Compute canShoot from refs — React state may be stale
    if (shootingRef.current || winnerRef.current) return;
    if (phaseRef.current !== 'playing') return;
    if (gamePhaseRef.current !== 'p1_aiming' && gamePhaseRef.current !== 'p2_aiming') return;
    const touch = e.touches[0]; if (!touch) return;
    // Palm rejection: only accept first touch
    if (activeTouchIdRef.current !== null) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pos = { x: (touch.clientX - rect.left) * (CANVAS_WIDTH / rect.width), y: (touch.clientY - rect.top) * (CANVAS_HEIGHT / rect.height) };
    pos.y -= TOUCH_OFFSET_Y;
    const ball = ballsRef.current.find(b => b.id === (gamePhaseRef.current === 'p1_aiming' ? (firstShooter) : (secondShooter)) && !b.pocketed);
    if (!ball) return;
    if (dist(pos.x, pos.y, ball.x, ball.y) < TOUCH_TARGET_RADIUS) {
      activeTouchIdRef.current = touch.identifier;
      aimingRef.current = true; dragStartRef.current = pos; dragCurrentRef.current = pos; shotPowerRef.current = 0; aimAngleRef.current = 0;
    }
  }, [firstShooter, secondShooter]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || !dragStartRef.current) return;
    // Palm rejection: track only the active touch
    const touch = Array.from(e.touches).find(t => t.identifier === activeTouchIdRef.current);
    if (!touch) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pos = { x: (touch.clientX - rect.left) * (CANVAS_WIDTH / rect.width), y: (touch.clientY - rect.top) * (CANVAS_HEIGHT / rect.height) };
    pos.y -= TOUCH_OFFSET_Y;
    dragCurrentRef.current = pos;
    const dx = dragStartRef.current.x - pos.x, dy = dragStartRef.current.y - pos.y;
    shotPowerRef.current = Math.min(Math.sqrt(dx * dx + dy * dy) / MAX_DRAG_DISTANCE, 1.0);
    aimAngleRef.current = Math.atan2(dy, dx);
    setRenderTick(t => t + 1);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
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
    if (!start || !current) { shotPowerRef.current = 0; return; }
    const dx = start.x - current.x;
    const dy = start.y - current.y;
    if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_DISTANCE) { shotPowerRef.current = 0; return; }
    const power = shotPowerRef.current * MAX_SHOT_POWER;
    const angle = aimAngleRef.current;
    shotPowerRef.current = 0;
    executeShot(power, angle);
  }, [executeShot]);

  const handleTouchCancel = useCallback(() => {
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

  // ---- PlayStake integration ----
  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r); log(`Selected role: Player ${r}`, 'info');
    const result = await setup(r);
    if (result) setPhase('lobby');
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
      gameType: 'bullseye',
    });
  }, [authState, joinFromLobby, log]);

  const handleBetCreated = useCallback(async (bet: { betId: string; amount: number }) => {
    log(`Bet created: ${bet.betId} ($${(bet.amount / 100).toFixed(2)})`, 'bet');
    betIdRef.current = bet.betId; setBetAmountCents(bet.amount);
    if (sessionId) await setBetId(bet.betId);
  }, [sessionId, setBetId, log]);

  const handleBetAccepted = useCallback((bet: { betId: string }) => {
    log('Bet accepted! Match is on!', 'bet'); betIdRef.current = bet.betId;
  }, [log]);

  const handleBetSettled = useCallback((bet: { outcome: string }) => {
    log(`Bet settled: ${bet.outcome}`, 'bet');
  }, [log]);

  const handlePlayAgain = useCallback(() => { window.location.reload(); }, []);

  // Auto-settle
  const isFinished = phase === 'finished' || gameState?.status === 'finished';
  if (isFinished && !settledRef.current && gameState?.betId && authState) {
    settledRef.current = true;
    const activeBetId = gameState.betId || betIdRef.current;
    if (activeBetId) {
      reportAndSettle(authState.apiKey, activeBetId).then((settle) => {
        if (settle) { setSettlementResult(settle as SettlementResult); widgetHandleRef.current?.refreshBalance(); }
      });
    }
  }

  // joinFromLobby already starts the game-state poll for both roles.

  // Initialize game
  const gameInitRef = useRef(false);
  useEffect(() => {
    if (phase === 'playing' && !gameInitRef.current) {
      gameInitRef.current = true;
      setScoreA(0); setScoreB(0); setWinner(null);
      setRoundNumber(1);
      settledRef.current = false;
      shotNumberRef.current = 0;
      startRound(1, null);
      if (role === 'A') syncGameData({ phase: 'p1_aiming' });
    }
  }, [phase, role, syncGameData, startRound]);

  const isInGame = phase === 'playing' || phase === 'finished';

  // ---- Mobile HUD: status pill message ----
  let mobileStatusMsg = '';
  if (isInGame) {
    if (winner) {
      mobileStatusMsg = winner === role ? 'You win!' : 'Opponent wins!';
    } else if (canShoot) {
      const clockStr = shotClockRemaining > 0 ? ` (${Math.ceil(shotClockRemaining)}s)` : '';
      mobileStatusMsg = `Your shot — aim for the bullseye!${clockStr}`;
    } else if (gamePhase === 'p1_rolling' || gamePhase === 'p2_rolling') {
      mobileStatusMsg = 'Rolling...';
    } else if (gamePhase === 'round_result' || gamePhase === 'round_transition') {
      mobileStatusMsg = 'Round over!';
    } else if (!isMyTurn) {
      mobileStatusMsg = "Opponent's turn...";
    }
  }

  // ---- Mobile HUD: player trackers ----
  const p1Tracker = (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm font-bold text-white">{scoreA % 1 === 0 ? scoreA : scoreA.toFixed(1)}</span>
      <span className="font-mono text-[8px] text-white/40">/{ROUNDS_TO_WIN}</span>
    </div>
  );
  const p2Tracker = (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm font-bold text-white">{scoreB % 1 === 0 ? scoreB : scoreB.toFixed(1)}</span>
      <span className="font-mono text-[8px] text-white/40">/{ROUNDS_TO_WIN}</span>
    </div>
  );
  const wagerDisplay = betAmountCents > 0 ? `$${(betAmountCents / 100).toFixed(2)}` : undefined;

  // Pre-game: render the new lobby layout
  if (!isInGame) {
    return (
      <GameLobbyLayout
        gameKey="bullseye"
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
          turnInfo={statusMsg}
          playerInfo={`P1: ${scoreA} | P2: ${scoreB}`}
        >
          <PlayStakeWidget widgetToken={authState?.widgetToken ?? null} gameId={authState?.gameId ?? null} />
        </GameMobileFAB>
      )}

      {/* Header */}
      <div className="game-header mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <Disc className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Bullseye Pool</h1>
          <p className="text-sm text-text-muted font-mono">Land closest to the target. Win the round.</p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        <div className="game-area lg:col-span-2 space-y-4">
          {isInGame && (
            <>
              {/* Score bar */}
              <Card padding="sm" className="game-players-bar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: PLAYER_COLORS.A }} />
                      <span className="font-mono text-xs text-text-secondary">P1{role === 'A' ? ' (You)' : ''}</span>
                      <span className="font-display text-lg font-bold text-text-primary">{scoreA % 1 === 0 ? scoreA : scoreA.toFixed(1)}</span>
                    </div>
                    <span className="font-mono text-[11px] text-text-muted">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: PLAYER_COLORS.B }} />
                      <span className="font-mono text-xs text-text-secondary">P2{role === 'B' ? ' (You)' : ''}</span>
                      <span className="font-display text-lg font-bold text-text-primary">{scoreB % 1 === 0 ? scoreB : scoreB.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-text-muted uppercase">FIRST TO {ROUNDS_TO_WIN}</span>
                    <span className="font-mono text-[10px] text-text-muted uppercase">RD {roundNumber}</span>
                    {betAmountCents > 0 && (
                      <span className="font-mono text-[10px] text-text-muted uppercase">STAKE: ${(betAmountCents / 100).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </Card>

              {/* Status */}
              {statusMsg && (
                <Card padding="sm" className="game-status-bar">
                  <p className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${
                    statusMsg.includes('FOUL') ? 'text-danger-400' : statusMsg.includes('WINS') ? 'text-brand-400' : 'text-blue-400'
                  }`}>{statusMsg}</p>
                </Card>
              )}

              {/* Mobile chrome: Zone A (top bar) + Zone C (scoreboard) */}
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
                {/* Canvas */}
                <div className="relative">
                  <canvas
                    ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
                    className="w-full rounded-sm border border-white/8 cursor-crosshair"
                    style={{ maxWidth: `${CANVAS_WIDTH}px`, touchAction: 'none' }}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}
                  />
                </div>
              </MobileGameChrome>

              {/* Game result overlay */}
              {winner && (
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
                    scoreText={`P1: ${scoreA % 1 === 0 ? scoreA : scoreA.toFixed(1)} — P2: ${scoreB % 1 === 0 ? scoreB : scoreB.toFixed(1)}`}
                  />
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="pointer-events-auto rounded-sm px-6 py-4 text-center" style={{ background: 'rgba(15,17,23,0.92)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <p className="font-display text-lg font-bold uppercase tracking-widest mb-1" style={{ color: winner === role ? '#00ff87' : '#ff3b5c' }}>
                          {winner === role ? 'Victory!' : 'Defeat'}
                        </p>
                        <p className="font-mono text-sm text-text-secondary mb-1">
                          P1: {scoreA % 1 === 0 ? scoreA : scoreA.toFixed(1)} — P2: {scoreB % 1 === 0 ? scoreB : scoreB.toFixed(1)}
                        </p>
                        <button onClick={handlePlayAgain} className="font-mono text-xs uppercase tracking-widest px-5 py-2 rounded-sm bg-brand-400/90 text-black font-semibold hover:bg-brand-400 transition-colors">
                          Play Again
                        </button>
                      </div>
                    </div>
                  </div>
                )
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
            onBetCreated={handleBetCreated} onBetAccepted={handleBetAccepted}
            onBetSettled={handleBetSettled}
            onError={(err) => log(`Widget error: ${err.message}`, 'error')}
          />
          <EventLog entries={entries} />
        </div>
      </div>
    </div>
  );
}
