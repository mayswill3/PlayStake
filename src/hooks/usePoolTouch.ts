'use client';

import { useCallback, useRef } from 'react';

const DEFAULT_TOUCH_OFFSET_Y = 60;
const DEFAULT_MIN_DRAG_DISTANCE = 15;
const DEFAULT_MAX_DRAG_DISTANCE = 150;
const DEFAULT_MAX_SHOT_POWER = 25;
const DEFAULT_TARGET_RADIUS = 80; // BALL_RADIUS * 8

export interface UsePoolTouchOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  getBallPosition: () => { x: number; y: number } | null;
  canShoot: () => boolean;
  onShot: (power: number, angle: number) => void;
  onAimChange?: (aiming: boolean, power: number, angle: number) => void;
  maxDragDistance?: number;
  maxShotPower?: number;
  touchOffsetY?: number;
  minDragDistance?: number;
  targetRadius?: number;
}

export interface PoolTouchState {
  isAiming: boolean;
  shotPower: number;
  aimAngle: number;
  dragStart: { x: number; y: number } | null;
  dragCurrent: { x: number; y: number } | null;
}

export function usePoolTouch({
  canvasRef,
  canvasWidth,
  canvasHeight,
  getBallPosition,
  canShoot,
  onShot,
  onAimChange,
  maxDragDistance = DEFAULT_MAX_DRAG_DISTANCE,
  maxShotPower = DEFAULT_MAX_SHOT_POWER,
  touchOffsetY = DEFAULT_TOUCH_OFFSET_Y,
  minDragDistance = DEFAULT_MIN_DRAG_DISTANCE,
  targetRadius = DEFAULT_TARGET_RADIUS,
}: UsePoolTouchOptions) {
  const aimingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const shotPowerRef = useRef(0);
  const aimAngleRef = useRef(0);
  const activeTouchIdRef = useRef<number | null>(null);

  const getCanvasPos = useCallback(
    (clientX: number, clientY: number, applyOffset: boolean = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const pos = {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
      if (applyOffset) {
        pos.y -= touchOffsetY;
      }
      return pos;
    },
    [canvasRef, canvasWidth, canvasHeight, touchOffsetY]
  );

  const dist = (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);

  const notifyAimChange = useCallback(() => {
    onAimChange?.(aimingRef.current, shotPowerRef.current, aimAngleRef.current);
  }, [onAimChange]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!canShoot()) return;
      const touch = e.touches[0];
      if (!touch) return;

      // Palm rejection: only accept first touch
      if (activeTouchIdRef.current !== null) return;

      const pos = getCanvasPos(touch.clientX, touch.clientY, true);
      if (!pos) return;

      const ball = getBallPosition();
      if (!ball) return;

      if (dist(pos.x, pos.y, ball.x, ball.y) < targetRadius) {
        activeTouchIdRef.current = touch.identifier;
        aimingRef.current = true;
        dragStartRef.current = pos;
        dragCurrentRef.current = pos;
        shotPowerRef.current = 0;
        aimAngleRef.current = 0;
        notifyAimChange();
      }
    },
    [canShoot, getCanvasPos, getBallPosition, targetRadius, notifyAimChange]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!aimingRef.current || !dragStartRef.current) return;

      // Palm rejection: track only the active touch
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === activeTouchIdRef.current
      );
      if (!touch) return;

      const pos = getCanvasPos(touch.clientX, touch.clientY, true);
      if (!pos) return;

      dragCurrentRef.current = pos;
      const dx = dragStartRef.current.x - pos.x;
      const dy = dragStartRef.current.y - pos.y;
      shotPowerRef.current = Math.min(
        Math.sqrt(dx * dx + dy * dy) / maxDragDistance,
        1.0
      );
      aimAngleRef.current = Math.atan2(dy, dx);
      notifyAimChange();
    },
    [getCanvasPos, maxDragDistance, notifyAimChange]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!aimingRef.current) return;

      // Palm rejection: only respond to the active touch ending
      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === activeTouchIdRef.current
      );
      if (!touch) return;

      aimingRef.current = false;
      activeTouchIdRef.current = null;

      const start = dragStartRef.current;
      const current = dragCurrentRef.current;
      dragStartRef.current = null;
      dragCurrentRef.current = null;

      if (!start || !current) {
        shotPowerRef.current = 0;
        notifyAimChange();
        return;
      }

      const dx = start.x - current.x;
      const dy = start.y - current.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);

      // Minimum drag distance prevents accidental shots
      if (dragDist < minDragDistance) {
        shotPowerRef.current = 0;
        notifyAimChange();
        return;
      }

      const power = shotPowerRef.current * maxShotPower;
      const angle = aimAngleRef.current;
      shotPowerRef.current = 0;
      notifyAimChange();

      onShot(power, angle);
    },
    [minDragDistance, maxShotPower, onShot, notifyAimChange]
  );

  // Mouse handlers (desktop fallback — no offset, no palm rejection needed)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canShoot()) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      if (!pos) return;

      const ball = getBallPosition();
      if (!ball) return;

      if (dist(pos.x, pos.y, ball.x, ball.y) < targetRadius) {
        aimingRef.current = true;
        dragStartRef.current = pos;
        dragCurrentRef.current = pos;
        shotPowerRef.current = 0;
        aimAngleRef.current = 0;
        notifyAimChange();
      }
    },
    [canShoot, getCanvasPos, getBallPosition, targetRadius, notifyAimChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!aimingRef.current || !dragStartRef.current) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      if (!pos) return;

      dragCurrentRef.current = pos;
      const dx = dragStartRef.current.x - pos.x;
      const dy = dragStartRef.current.y - pos.y;
      shotPowerRef.current = Math.min(
        Math.sqrt(dx * dx + dy * dy) / maxDragDistance,
        1.0
      );
      aimAngleRef.current = Math.atan2(dy, dx);
      notifyAimChange();
    },
    [getCanvasPos, maxDragDistance, notifyAimChange]
  );

  const handleMouseUp = useCallback(() => {
    if (!aimingRef.current) return;
    aimingRef.current = false;

    const start = dragStartRef.current;
    const current = dragCurrentRef.current;
    dragStartRef.current = null;
    dragCurrentRef.current = null;

    if (!start || !current) {
      shotPowerRef.current = 0;
      notifyAimChange();
      return;
    }

    const dx = start.x - current.x;
    const dy = start.y - current.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);

    if (dragDist < minDragDistance) {
      shotPowerRef.current = 0;
      notifyAimChange();
      return;
    }

    const power = shotPowerRef.current * maxShotPower;
    const angle = aimAngleRef.current;
    shotPowerRef.current = 0;
    notifyAimChange();

    onShot(power, angle);
  }, [minDragDistance, maxShotPower, onShot, notifyAimChange]);

  return {
    // Touch handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    // Mouse handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    // State refs (for canvas rendering loop to read)
    aimingRef,
    shotPowerRef,
    aimAngleRef,
    dragStartRef,
    dragCurrentRef,
  };
}
