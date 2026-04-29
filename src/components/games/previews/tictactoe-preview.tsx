'use client';

import { useRef, useEffect } from 'react';

const W = 800;
const H = 450;

// Pre-scripted game sequences: each entry is [cellIndex, mark]
// Three complete games that demonstrate wins and a draw
const GAMES: [number, 'X' | 'O'][][] = [
  // Game 1: X wins diagonally
  [
    [4, 'X'], [0, 'O'], [8, 'X'], [2, 'O'], [6, 'X'],
  ],
  // Game 2: O wins top row
  [
    [4, 'X'], [0, 'O'], [3, 'X'], [1, 'O'], [8, 'X'], [2, 'O'],
  ],
  // Game 3: X wins middle column
  [
    [1, 'X'], [0, 'O'], [4, 'X'], [6, 'O'], [7, 'X'],
  ],
];

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function getWinLine(board: (string | null)[]): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function cellCenter(i: number, ox: number, oy: number, cellW: number, cellH: number) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return [ox + col * cellW + cellW / 2, oy + row * cellH + cellH / 2] as const;
}

export function TicTacToePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    // Board layout
    const gridW  = 220;
    const gridH  = 220;
    const cellW  = gridW / 3;
    const cellH  = gridH / 3;
    const gridOX = (W - gridW) / 2;
    const gridOY = (H - gridH) / 2;

    let gameIdx = 0;
    let moveIdx = 0;
    let board: (string | null)[] = Array(9).fill(null);
    let winLine: number[] | null = null;
    // Animate mark drawing: 0 = idle, >0 = progress (0→1)
    let drawProgress: { cell: number; mark: 'X' | 'O'; p: number } | null = null;
    let winProgress = 0;      // win line draw progress
    let phase: 'placing' | 'win' | 'pause' = 'placing';
    let elapsed = 0;

    function drawBackground() {
      // Dark gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0d1420');
      bg.addColorStop(1, '#0a1018');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Subtle dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let x = 20; x < W; x += 32) {
        for (let y = 20; y < H; y += 32) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Title label
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Tic-Tac-Toe', W / 2, H - 10);
    }

    function drawGrid() {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      // Vertical lines
      for (let c = 1; c < 3; c++) {
        ctx.beginPath();
        ctx.moveTo(gridOX + c * cellW, gridOY + 6);
        ctx.lineTo(gridOX + c * cellW, gridOY + gridH - 6);
        ctx.stroke();
      }
      // Horizontal lines
      for (let r = 1; r < 3; r++) {
        ctx.beginPath();
        ctx.moveTo(gridOX + 6,      gridOY + r * cellH);
        ctx.lineTo(gridOX + gridW - 6, gridOY + r * cellH);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawX(cx: number, cy: number, size: number, alpha = 1) {
      const h = size * 0.38;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth   = 5;
      ctx.lineCap     = 'round';
      ctx.shadowColor = 'rgba(59,130,246,0.5)';
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.moveTo(cx - h, cy - h);
      ctx.lineTo(cx + h, cy + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + h, cy - h);
      ctx.lineTo(cx - h, cy + h);
      ctx.stroke();
      ctx.restore();
    }

    function drawO(cx: number, cy: number, size: number, alpha = 1) {
      const r = size * 0.32;
      ctx.save();
      ctx.globalAlpha   = alpha;
      ctx.strokeStyle   = '#ec4899';
      ctx.lineWidth     = 5;
      ctx.shadowColor   = 'rgba(236,72,153,0.5)';
      ctx.shadowBlur    = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawAnimatedMark(dp: { cell: number; mark: 'X' | 'O'; p: number }) {
      const [cx, cy] = cellCenter(dp.cell, gridOX, gridOY, cellW, cellH);
      if (dp.mark === 'X') {
        // Draw X progressively: first stroke from 0→0.5p, second from 0.5→1p
        const p1 = Math.min(dp.p * 2, 1);
        const p2 = Math.max(dp.p * 2 - 1, 0);
        const h  = cellW * 0.38;
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth   = 5;
        ctx.lineCap     = 'round';
        ctx.shadowColor = 'rgba(59,130,246,0.5)';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.moveTo(cx - h, cy - h);
        ctx.lineTo(cx - h + p1 * h * 2, cy - h + p1 * h * 2);
        ctx.stroke();
        if (p2 > 0) {
          ctx.beginPath();
          ctx.moveTo(cx + h, cy - h);
          ctx.lineTo(cx + h - p2 * h * 2, cy - h + p2 * h * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Draw O as growing arc
        const r = cellW * 0.32;
        ctx.save();
        ctx.strokeStyle   = '#ec4899';
        ctx.lineWidth     = 5;
        ctx.shadowColor   = 'rgba(236,72,153,0.5)';
        ctx.shadowBlur    = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + dp.p * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawWinLine(line: number[], p: number) {
      const [cx1, cy1] = cellCenter(line[0], gridOX, gridOY, cellW, cellH);
      const [cx2, cy2] = cellCenter(line[2], gridOX, gridOY, cellW, cellH);
      ctx.save();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 4;
      ctx.lineCap     = 'round';
      ctx.shadowColor = 'rgba(34,197,94,0.7)';
      ctx.shadowBlur  = 14;
      ctx.globalAlpha = Math.min(p * 2, 1);
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx1 + (cx2 - cx1) * p, cy1 + (cy2 - cy1) * p);
      ctx.stroke();
      ctx.restore();
    }

    function drawScorePanels() {
      // Mini turn indicator
      const game = GAMES[gameIdx % GAMES.length];
      const xCount = board.filter(v => v === 'X').length;
      const oCount = board.filter(v => v === 'O').length;

      const panelW = 90, panelH = 55;
      const panels = [
        { label: 'X', color: '#3b82f6', shadow: 'rgba(59,130,246,0.25)', count: xCount, px: W / 2 - 145 - panelW / 2 },
        { label: 'O', color: '#ec4899', shadow: 'rgba(236,72,153,0.25)',  count: oCount, px: W / 2 + 145 - panelW / 2 },
      ];

      for (const p of panels) {
        ctx.save();
        ctx.shadowColor = p.shadow;
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = 'rgba(255,255,255,0.05)';
        ctx.strokeStyle = `${p.color}44`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(p.px, (H - panelH) / 2, panelW, panelH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.font      = 'bold 22px monospace';
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, p.px + panelW / 2, (H - panelH) / 2 + panelH / 2 - 6);
        ctx.font      = '11px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(`${p.count} placed`, p.px + panelW / 2, (H - panelH) / 2 + panelH / 2 + 14);
      }
    }

    let lastTs = 0;
    let rafId  = 0;

    function render(ts: number) {
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      elapsed += dt;

      ctx.clearRect(0, 0, W, H);
      drawBackground();

      // Advance mark animation
      if (drawProgress) {
        drawProgress.p = Math.min(drawProgress.p + dt * 4, 1);
        if (drawProgress.p >= 1) {
          // Commit mark to board
          board[drawProgress.cell] = drawProgress.mark;
          drawProgress = null;
          winLine = getWinLine(board);
          if (winLine) {
            phase = 'win';
            winProgress = 0;
          }
        }
      }

      // Advance win line animation
      if (phase === 'win') {
        winProgress = Math.min(winProgress + dt * 2.5, 1);
        if (winProgress >= 1) {
          phase = 'pause';
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(nextMove, 1800);
        }
      }

      drawGrid();

      // Draw committed marks
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) continue;
        const [cx, cy] = cellCenter(i, gridOX, gridOY, cellW, cellH);
        if (board[i] === 'X') drawX(cx, cy, cellW);
        else drawO(cx, cy, cellW);
      }

      // Draw animating mark
      if (drawProgress) drawAnimatedMark(drawProgress);

      // Draw win line
      if (winLine && (phase === 'win' || phase === 'pause')) {
        drawWinLine(winLine, winProgress);
      }

      drawScorePanels();

      rafId = requestAnimationFrame(render);
    }

    function nextMove() {
      if (timerRef.current) clearTimeout(timerRef.current);
      const game = GAMES[gameIdx % GAMES.length];

      if (moveIdx >= game.length || winLine) {
        // Start next game
        gameIdx++;
        moveIdx = 0;
        board   = Array(9).fill(null);
        winLine = null;
        phase   = 'placing';
        timerRef.current = setTimeout(nextMove, 600);
        return;
      }

      const [cell, mark] = game[moveIdx];
      moveIdx++;
      drawProgress = { cell, mark, p: 0 };
      timerRef.current = setTimeout(nextMove, 900);
    }

    rafId = requestAnimationFrame((ts) => { lastTs = ts; render(ts); });
    timerRef.current = setTimeout(nextMove, 800);

    return () => {
      cancelAnimationFrame(rafId);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="w-full h-full"
      aria-hidden="true"
    />
  );
}
