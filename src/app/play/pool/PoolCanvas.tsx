'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Ball, BullRing, PoolGameState } from './pool-physics';
import {
  CANVAS_W, CANVAS_H, BORDER, TABLE_W, TABLE_H,
  BALL_R, KITCHEN_X, OBJ_POSITIONS, SHOTS_PER_TURN,
  stepPhysics, isMoving, scoreBullseye,
} from './pool-physics';
import {
  drawTable, drawBullseye, drawCueBall, drawObjectBall,
  drawBallWithBlur, drawCue, drawAimLine, drawPowerBar,
  drawScorePopup, drawHUD, drawGhostMarker, drawKitchenHighlight,
} from './pool-renderer';

const MAX_POWER = 22;
const MIN_SHOT_POWER = 4;
const HUD_H = 48;

type ShotPhase = 'place' | 'aim' | 'moving' | 'scored';

interface Props {
  role: 'A' | 'B';
  isMyTurn: boolean;
  scoreA: number;
  scoreB: number;
  turn: 'A' | 'B';
  shotIndex: number;
  globalShotIndex: number;
  finished: boolean;
  p1Name: string;
  p2Name: string;
  opponentState: PoolGameState | null;
  onShotResult: (result: {
    objPocketed: boolean;
    cuePocketed: boolean;
    bullRing: BullRing;
    bullPoints: number;
    cueFinalX: number;
    cueFinalY: number;
  }) => void;
}

export function PoolCanvas({
  role, isMyTurn, scoreA, scoreB, turn, shotIndex, globalShotIndex,
  finished, p1Name, p2Name, opponentState, onShotResult,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  // All mutable game state in refs to avoid stale closures
  const cueRef = useRef<Ball>({ x: KITCHEN_X / 2, y: TABLE_H / 2, vx: 0, vy: 0, pocketed: false });
  const objRef = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0, pocketed: false });
  const phaseRef = useRef<ShotPhase>('place');
  const aimAngleRef = useRef(0);
  const powerRef = useRef(0);
  const shotFiredRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Score popup / flash
  const popupRef = useRef<{ text: string; x: number; y: number; start: number } | null>(null);
  const flashRef = useRef<{ ring: BullRing; start: number } | null>(null);

  // Force re-render trigger (only for phase changes that affect drawing)
  const renderTickRef = useRef(0);
  const forceRender = useCallback(() => { renderTickRef.current++; }, []);

  // Place object ball at preset position for current shot
  useEffect(() => {
    const posIdx = globalShotIndex % OBJ_POSITIONS.length;
    const pos = OBJ_POSITIONS[posIdx];
    objRef.current = { x: pos.x, y: pos.y, vx: 0, vy: 0, pocketed: false };
    cueRef.current = { x: KITCHEN_X / 2, y: TABLE_H / 2, vx: 0, vy: 0, pocketed: false };
    shotFiredRef.current = false;
    powerRef.current = 0;
    isDraggingRef.current = false;
    dragStartRef.current = null;
    phaseRef.current = isMyTurn ? 'place' : 'aim';
  }, [globalShotIndex, isMyTurn]);

  // Sync opponent state
  useEffect(() => {
    if (!opponentState || isMyTurn) return;
    if (opponentState.cueBall) {
      cueRef.current = { ...cueRef.current, x: opponentState.cueBall.x, y: opponentState.cueBall.y, pocketed: opponentState.cueBall.pocketed };
    }
    if (opponentState.objBall) {
      objRef.current = { ...objRef.current, x: opponentState.objBall.x, y: opponentState.objBall.y, pocketed: opponentState.objBall.pocketed };
    }
    if (opponentState.lastRing && opponentState.lastRing !== 'none' && opponentState.lastPoints > 0) {
      const now = performance.now();
      popupRef.current = { text: `+${opponentState.lastPoints}`, x: opponentState.cueBall.x, y: opponentState.cueBall.y, start: now };
      flashRef.current = { ring: opponentState.lastRing, start: now };
    }
  }, [opponentState, isMyTurn]);

  // ── Get table-relative mouse position ──────────────────────────
  const getTablePos = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = (CANVAS_H + HUD_H) / rect.height;
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }
    return { x: (clientX - rect.left) * sx - BORDER, y: (clientY - rect.top) * sy - BORDER - HUD_H };
  }, []);

  // ── Fire the shot ──────────────────────────────────────────────
  const fireShot = useCallback(() => {
    if (shotFiredRef.current || phaseRef.current !== 'aim') return;
    const p = Math.max(MIN_SHOT_POWER, powerRef.current);
    const cue = cueRef.current;
    cue.vx = Math.cos(aimAngleRef.current) * p;
    cue.vy = Math.sin(aimAngleRef.current) * p;
    shotFiredRef.current = true;
    phaseRef.current = 'moving';
    powerRef.current = 0;
    isDraggingRef.current = false;
    dragStartRef.current = null;
  }, []);

  // ── Mouse / pointer events ─────────────────────────────────────
  const handlePointerDown = useCallback((e: React.MouseEvent) => {
    if (!isMyTurn || finished) return;
    const pos = getTablePos(e);

    if (phaseRef.current === 'place') {
      // Place cue ball in kitchen
      const clampedX = Math.max(BALL_R, Math.min(KITCHEN_X - BALL_R, pos.x));
      const clampedY = Math.max(BALL_R, Math.min(TABLE_H - BALL_R, pos.y));
      const obj = objRef.current;
      const dx = obj.x - clampedX, dy = obj.y - clampedY;
      if (Math.sqrt(dx * dx + dy * dy) < BALL_R * 2 + 4) return;
      cueRef.current = { x: clampedX, y: clampedY, vx: 0, vy: 0, pocketed: false };
      phaseRef.current = 'aim';
      return;
    }

    if (phaseRef.current === 'aim') {
      // Start drag-to-power
      isDraggingRef.current = true;
      dragStartRef.current = pos;
      // Update aim angle
      const cue = cueRef.current;
      aimAngleRef.current = Math.atan2(pos.y - cue.y, pos.x - cue.x);
    }
  }, [isMyTurn, finished, getTablePos]);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (!isMyTurn || finished) return;
    const pos = getTablePos(e);

    if (phaseRef.current === 'aim') {
      const cue = cueRef.current;
      aimAngleRef.current = Math.atan2(pos.y - cue.y, pos.x - cue.x);

      // Drag power: distance from drag start → power
      if (isDraggingRef.current && dragStartRef.current) {
        const dx = pos.x - dragStartRef.current.x;
        const dy = pos.y - dragStartRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        powerRef.current = Math.min(MAX_POWER, dist / 6);
      }
    }
  }, [isMyTurn, finished, getTablePos]);

  const handlePointerUp = useCallback(() => {
    if (!isMyTurn || finished) return;
    if (phaseRef.current === 'aim' && isDraggingRef.current) {
      fireShot();
    }
  }, [isMyTurn, finished, fireShot]);

  // ── Touch events ───────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMyTurn || finished) return;
    const pos = getTablePos(e);

    if (phaseRef.current === 'place') {
      const clampedX = Math.max(BALL_R, Math.min(KITCHEN_X - BALL_R, pos.x));
      const clampedY = Math.max(BALL_R, Math.min(TABLE_H - BALL_R, pos.y));
      const obj = objRef.current;
      const dx = obj.x - clampedX, dy = obj.y - clampedY;
      if (Math.sqrt(dx * dx + dy * dy) < BALL_R * 2 + 4) return;
      cueRef.current = { x: clampedX, y: clampedY, vx: 0, vy: 0, pocketed: false };
      phaseRef.current = 'aim';
      return;
    }

    if (phaseRef.current === 'aim') {
      isDraggingRef.current = true;
      dragStartRef.current = pos;
      const cue = cueRef.current;
      aimAngleRef.current = Math.atan2(pos.y - cue.y, pos.x - cue.x);
    }
  }, [isMyTurn, finished, getTablePos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMyTurn || finished || phaseRef.current !== 'aim') return;
    const pos = getTablePos(e);
    const cue = cueRef.current;
    aimAngleRef.current = Math.atan2(pos.y - cue.y, pos.x - cue.x);
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;
      powerRef.current = Math.min(MAX_POWER, Math.sqrt(dx * dx + dy * dy) / 6);
    }
  }, [isMyTurn, finished, getTablePos]);

  const handleTouchEnd = useCallback(() => {
    if (!isMyTurn || finished) return;
    if (phaseRef.current === 'aim' && isDraggingRef.current) {
      fireShot();
    }
  }, [isMyTurn, finished, fireShot]);

  // ── Keyboard power (W/S still works too) ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMyTurn || phaseRef.current !== 'aim' || finished) return;
      if (e.key === 'w' || e.key === 'W') powerRef.current = Math.min(MAX_POWER, powerRef.current + 0.8);
      if (e.key === 's' || e.key === 'S') powerRef.current = Math.max(0, powerRef.current - 0.8);
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fireShot(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMyTurn, finished, fireShot]);

  // ── Render + physics loop ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      const cue = cueRef.current;
      const obj = objRef.current;
      const phase = phaseRef.current;

      // Physics
      if (phase === 'moving' && shotFiredRef.current) {
        stepPhysics(cue, obj);

        if (!isMoving(cue, obj)) {
          const objPocketed = obj.pocketed;
          const cuePocketed = cue.pocketed;
          let bullRing: BullRing = 'none';
          let bullPoints = 0;

          if (objPocketed && !cuePocketed) {
            const bs = scoreBullseye(cue);
            bullRing = bs.ring;
            bullPoints = bs.points;
            if (bullPoints > 0) {
              popupRef.current = { text: `+${bullPoints}`, x: cue.x, y: cue.y, start: now };
              flashRef.current = { ring: bullRing, start: now };
            }
          }

          if (cuePocketed) {
            cue.pocketed = false;
            cue.x = KITCHEN_X / 2;
            cue.y = TABLE_H / 2;
          }

          shotFiredRef.current = false;
          phaseRef.current = 'scored';

          onShotResult({ objPocketed, cuePocketed, bullRing, bullPoints, cueFinalX: cue.x, cueFinalY: cue.y });
        }
      }

      // ── Draw ─────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H + HUD_H);

      drawHUD(ctx, p1Name, p2Name, scoreA, scoreB, turn, role,
        shotIndex, SHOTS_PER_TURN, phase === 'moving', finished);

      ctx.save();
      ctx.translate(0, HUD_H);
      drawTable(ctx);

      // Bullseye flash
      let flashAlpha = 0;
      const flash = flashRef.current;
      if (flash) {
        const elapsed = now - flash.start;
        if (elapsed < 650) {
          flashAlpha = elapsed < 150 ? elapsed / 150 : 1 - (elapsed - 150) / 500;
        } else { flashRef.current = null; }
      }
      drawBullseye(ctx, flash?.ring ?? null, flashAlpha);

      // Ghost marker + kitchen highlight in place phase
      if (phase === 'place' && isMyTurn) {
        drawGhostMarker(ctx, obj.x, obj.y);
        drawKitchenHighlight(ctx);
      }

      // Balls
      drawBallWithBlur(ctx, obj, drawObjectBall);
      drawBallWithBlur(ctx, cue, drawCueBall);

      // Cue stick + aim line (aim phase, my turn)
      if (isMyTurn && phase === 'aim' && !finished) {
        const angle = aimAngleRef.current;
        const pwr = powerRef.current;
        drawAimLine(ctx, cue, angle);
        drawCue(ctx, cue, angle, pwr * 4);
        drawPowerBar(ctx, pwr, MAX_POWER);

        // Hint text
        if (!isDraggingRef.current && pwr < 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Click & drag to set power, release to shoot', CANVAS_W / 2, CANVAS_H - 8);
        }
      }

      // Ghost cue for opponent
      if (!isMyTurn && phase === 'moving') {
        drawCue(ctx, cue, 0, 0, 0.35);
      }

      // Score popup
      const popup = popupRef.current;
      if (popup) {
        const elapsed = now - popup.start;
        if (elapsed < 900) {
          drawScorePopup(ctx, popup.text, popup.x, popup.y, 1 - elapsed / 900, elapsed * 0.06);
        } else { popupRef.current = null; }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isMyTurn, finished, scoreA, scoreB, turn, role, shotIndex, p1Name, p2Name, onShotResult]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H + HUD_H}
        className="rounded-xl cursor-crosshair max-w-full"
        style={{ width: '100%', maxWidth: CANVAS_W, height: 'auto' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { isDraggingRef.current = false; dragStartRef.current = null; }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
