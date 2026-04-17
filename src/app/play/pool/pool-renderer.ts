// ═══════════════════════════════════════════════════════════════════════
// Bullseye Pool — Canvas 2D Renderer
// Felt texture, 3D balls, tapered cue, bullseye rings, HUD, popups
// ═══════════════════════════════════════════════════════════════════════

import type { Ball, BullRing } from './pool-physics';
import {
  TABLE_W, TABLE_H, BORDER, CUSHION, RAIL, CANVAS_W, CANVAS_H,
  BALL_R, BULL_INNER, BULL_MID, BULL_OUTER, POCKETS, KITCHEN_X,
} from './pool-physics';

// ── Offscreen felt texture ─────────────────────────────────────────
let feltCache: HTMLCanvasElement | null = null;
function getFelt(): HTMLCanvasElement {
  if (feltCache) return feltCache;
  feltCache = document.createElement('canvas');
  feltCache.width = TABLE_W;
  feltCache.height = TABLE_H;
  const c = feltCache.getContext('2d')!;
  c.fillStyle = '#1a5c2a';
  c.fillRect(0, 0, TABLE_W, TABLE_H);
  // Grain
  c.strokeStyle = 'rgba(255,255,255,0.03)';
  c.lineWidth = 1;
  for (let y = 0; y < TABLE_H; y += 6) { c.beginPath(); c.moveTo(0, y); c.lineTo(TABLE_W, y); c.stroke(); }
  // Dots
  c.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 4000; i++) {
    c.beginPath(); c.arc(Math.random() * TABLE_W, Math.random() * TABLE_H, 0.4, 0, Math.PI * 2); c.fill();
  }
  return feltCache;
}

// ── Rounded rect helper ────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Table ──────────────────────────────────────────────────────────
export function drawTable(ctx: CanvasRenderingContext2D) {
  // Background + vignette
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const vig = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.25, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.55);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Overhead light
  const lg = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2 - 40, 0, CANVAS_W / 2, CANVAS_H / 2 - 40, CANVAS_W * 0.6);
  lg.addColorStop(0, 'rgba(255,248,200,0.06)'); lg.addColorStop(1, 'transparent');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Table shadow
  ctx.save(); ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.fillStyle = '#000'; ctx.fillRect(BORDER - 8, BORDER - 8, TABLE_W + 16, TABLE_H + 16); ctx.restore();

  // Wood rail
  ctx.fillStyle = '#2c1a0e'; ctx.fillRect(BORDER - CUSHION - RAIL, BORDER - CUSHION - RAIL, TABLE_W + (CUSHION + RAIL) * 2, TABLE_H + (CUSHION + RAIL) * 2);
  const wg = ctx.createLinearGradient(0, BORDER - CUSHION - RAIL, 0, BORDER - CUSHION);
  wg.addColorStop(0, '#3d2412'); wg.addColorStop(1, '#2c1a0e');
  ctx.fillStyle = wg; ctx.fillRect(BORDER - CUSHION - RAIL, BORDER - CUSHION - RAIL, TABLE_W + (CUSHION + RAIL) * 2, RAIL);

  // Cushion
  ctx.fillStyle = '#14471f'; ctx.fillRect(BORDER - CUSHION, BORDER - CUSHION, TABLE_W + CUSHION * 2, TABLE_H + CUSHION * 2);
  ctx.strokeStyle = 'rgba(29,92,40,0.4)'; ctx.lineWidth = 2;
  ctx.strokeRect(BORDER + 1, BORDER + 1, TABLE_W - 2, TABLE_H - 2);

  // Felt
  ctx.drawImage(getFelt(), BORDER, BORDER);

  // Kitchen line
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(KITCHEN_X + BORDER, BORDER); ctx.lineTo(KITCHEN_X + BORDER, BORDER + TABLE_H); ctx.stroke();
  ctx.setLineDash([]);

  // Brass corner plates
  const corners = [
    [BORDER - CUSHION - RAIL, BORDER - CUSHION - RAIL],
    [BORDER + TABLE_W + CUSHION + RAIL - 24, BORDER - CUSHION - RAIL],
    [BORDER - CUSHION - RAIL, BORDER + TABLE_H + CUSHION + RAIL - 24],
    [BORDER + TABLE_W + CUSHION + RAIL - 24, BORDER + TABLE_H + CUSHION + RAIL - 24],
  ];
  for (const [bx, by] of corners) {
    ctx.fillStyle = '#c8a84b'; rrect(ctx, bx, by, 24, 24, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    rrect(ctx, bx + 3, by + 3, 18, 18, 2); ctx.stroke();
    rrect(ctx, bx + 6, by + 6, 12, 12, 1); ctx.stroke();
  }

  // Pockets
  for (const p of POCKETS) {
    const px = p.x + BORDER, py = p.y + BORDER;
    ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.beginPath(); ctx.arc(px, py, p.radius - 2, 0, Math.PI * 2);
    const pg = ctx.createRadialGradient(px, py, 0, px, py, p.radius);
    pg.addColorStop(0, '#000'); pg.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = pg; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(px, py, p.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 3; ctx.stroke();
  }
}

// ── Bullseye target ────────────────────────────────────────────────
export function drawBullseye(ctx: CanvasRenderingContext2D, flashRing: BullRing | null, flashAlpha: number) {
  const cx = TABLE_W / 2 + BORDER, cy = TABLE_H / 2 + BORDER;

  // Outer
  ctx.beginPath(); ctx.arc(cx, cy, BULL_OUTER, 0, Math.PI * 2);
  ctx.fillStyle = flashRing === 'outer' ? `rgba(255,255,255,${0.10 + flashAlpha * 0.35})` : 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.strokeStyle = flashRing === 'outer' ? `rgba(255,255,255,${0.20 + flashAlpha * 0.6})` : 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.5; ctx.stroke();

  // Mid
  ctx.beginPath(); ctx.arc(cx, cy, BULL_MID, 0, Math.PI * 2);
  ctx.fillStyle = flashRing === 'mid' ? `rgba(180,180,180,${0.15 + flashAlpha * 0.45})` : 'rgba(180,180,180,0.15)';
  ctx.fill();
  ctx.strokeStyle = flashRing === 'mid' ? `rgba(220,220,220,${0.30 + flashAlpha * 0.5})` : 'rgba(220,220,220,0.30)';
  ctx.lineWidth = 2; ctx.stroke();

  // Inner bull
  ctx.beginPath(); ctx.arc(cx, cy, BULL_INNER, 0, Math.PI * 2);
  ctx.fillStyle = flashRing === 'inner' ? `rgba(255,200,50,${0.22 + flashAlpha * 0.6})` : 'rgba(255,200,50,0.22)';
  ctx.fill();
  ctx.strokeStyle = flashRing === 'inner' ? `rgba(255,215,0,${0.55 + flashAlpha * 0.45})` : 'rgba(255,215,0,0.55)';
  ctx.lineWidth = 2; ctx.stroke();

  // Centre dot
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = flashRing === 'inner' ? `rgba(245,158,11,${0.8 + flashAlpha * 0.2})` : '#f59e0b';
  ctx.fill();

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('+5', cx, cy - BULL_INNER + 13);
  ctx.fillText('+3', cx, cy - BULL_MID + 13);
  ctx.fillText('+1', cx, cy - BULL_OUTER + 13);
}

// ── Object ball position ghost marker ──────────────────────────────
export function drawGhostMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const px = x + BORDER, py = y + BORDER;
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, py, BALL_R + 4, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Small arrow below
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(px, py + BALL_R + 8);
  ctx.lineTo(px - 4, py + BALL_R + 14);
  ctx.lineTo(px + 4, py + BALL_R + 14);
  ctx.closePath(); ctx.fill();
}

// ── Kitchen zone highlight ─────────────────────────────────────────
export function drawKitchenHighlight(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(BORDER, BORDER, KITCHEN_X, TABLE_H);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Click to place cue ball', KITCHEN_X / 2 + BORDER, BORDER + TABLE_H / 2);
}

// ── Ball drawing ───────────────────────────────────────────────────
export function drawCueBall(ctx: CanvasRenderingContext2D, b: Ball, alpha = 1) {
  if (b.pocketed) return;
  const x = b.x + BORDER, y = b.y + BORDER, r = BALL_R;
  ctx.save(); ctx.globalAlpha = alpha;
  // Shadow
  ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
  // Body
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#fafafa'; ctx.fill();
  // Specular
  const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x - r * 0.3, y - r * 0.35, r * 0.5);
  sg.addColorStop(0, 'rgba(255,255,255,0.7)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
  // Edge
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();
}

export function drawObjectBall(ctx: CanvasRenderingContext2D, b: Ball, alpha = 1) {
  if (b.pocketed) return;
  const x = b.x + BORDER, y = b.y + BORDER, r = BALL_R;
  ctx.save(); ctx.globalAlpha = alpha;
  // Shadow
  ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
  // White base
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#fafafa'; ctx.fill();
  // Yellow stripe
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#f5c518'; ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.7); ctx.restore();
  // Number circle
  ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = `bold ${Math.round(r * 0.55)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('9', x, y + 0.5);
  // Specular
  const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x - r * 0.3, y - r * 0.35, r * 0.5);
  sg.addColorStop(0, 'rgba(255,255,255,0.7)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
  ctx.restore();
}

export function drawBallWithBlur(
  ctx: CanvasRenderingContext2D, b: Ball,
  drawFn: (ctx: CanvasRenderingContext2D, b: Ball, a?: number) => void
) {
  if (b.pocketed) return;
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (speed > 1) {
    for (let i = 3; i >= 1; i--) {
      drawFn(ctx, { ...b, x: b.x - b.vx * i * 0.8, y: b.y - b.vy * i * 0.8 } as Ball,
        i === 3 ? 0.05 : i === 2 ? 0.10 : 0.20);
    }
  }
  drawFn(ctx, b);
}

// ── Cue stick ──────────────────────────────────────────────────────
export function drawCue(ctx: CanvasRenderingContext2D, cueBall: Ball, angle: number, pullBack: number, alpha = 1) {
  if (cueBall.pocketed) return;
  const cx = cueBall.x + BORDER, cy = cueBall.y + BORDER;
  const length = 220;
  const gap = BALL_R + 6 + pullBack;

  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI);

  const tipW = 1.5, buttW = 5;
  const ferruleS = gap, ferruleE = gap + 8;
  const wrapS = gap + length - 60, wrapE = gap + length - 20;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(ferruleE, -tipW * 1.2); ctx.lineTo(gap + length, -buttW);
  ctx.lineTo(gap + length, buttW); ctx.lineTo(ferruleE, tipW * 1.2); ctx.closePath();
  const sg = ctx.createLinearGradient(ferruleE, 0, gap + length, 0);
  sg.addColorStop(0, '#f0e6c8'); sg.addColorStop(0.6, '#d4c5a0'); sg.addColorStop(1, '#3d1f0a');
  ctx.fillStyle = sg; ctx.fill();

  // Wood grain
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const yo = -3 + i * 2;
    ctx.beginPath(); ctx.moveTo(ferruleE + 20, yo); ctx.lineTo(gap + length - 10, yo + (i % 2 === 0 ? 1 : -1)); ctx.stroke();
  }

  // Grip wrap
  for (let wx = wrapS; wx < wrapE; wx += 4) {
    const w = tipW + (buttW - tipW) * ((wx - gap) / length);
    ctx.fillStyle = (Math.floor((wx - wrapS) / 4) % 2 === 0) ? 'rgba(20,10,5,0.4)' : 'rgba(60,35,15,0.3)';
    ctx.fillRect(wx, -w, 4, w * 2);
  }

  // Ferrule
  ctx.fillStyle = '#f5f5f5'; ctx.fillRect(ferruleS, -tipW * 1.3, ferruleE - ferruleS, tipW * 2.6);

  // Leather tip
  ctx.beginPath(); ctx.ellipse(ferruleS, 0, 2, tipW * 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8b5e3c'; ctx.fill();

  ctx.restore();
}

// ── Aim line ───────────────────────────────────────────────────────
export function drawAimLine(ctx: CanvasRenderingContext2D, cueBall: Ball, angle: number) {
  if (cueBall.pocketed) return;
  const cx = cueBall.x + BORDER, cy = cueBall.y + BORDER;
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * 500, cy + Math.sin(angle) * 500); ctx.stroke();
  ctx.setLineDash([]);
}

// ── Power bar ──────────────────────────────────────────────────────
export function drawPowerBar(ctx: CanvasRenderingContext2D, power: number, maxPower: number) {
  const barH = 160, barW = 10;
  const x = BORDER - CUSHION - RAIL + 6, y = BORDER + (TABLE_H - barH) / 2;
  const pct = power / maxPower;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; rrect(ctx, x, y, barW, barH, 5); ctx.fill();
  const fillH = barH * pct;
  const fg = ctx.createLinearGradient(0, y + barH, 0, y);
  fg.addColorStop(0, '#22c55e'); fg.addColorStop(0.5, '#f59e0b'); fg.addColorStop(1, '#ef4444');
  ctx.save(); ctx.beginPath(); rrect(ctx, x, y + barH - fillH, barW, fillH, 5); ctx.clip();
  ctx.fillStyle = fg; ctx.fillRect(x, y, barW, barH); ctx.restore();
  ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(pct * 100)}%`, x + barW / 2, y - 6);
}

// ── Score popup ────────────────────────────────────────────────────
export function drawScorePopup(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number, offsetY: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(255,200,50,0.8)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text, x + BORDER, y + BORDER - offsetY);
  ctx.restore();
}

// ── HUD ────────────────────────────────────────────────────────────
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  p1Name: string, p2Name: string,
  score1: number, score2: number,
  turn: 'A' | 'B', role: 'A' | 'B',
  shotIndex: number, shotsPerTurn: number,
  moving: boolean, finished: boolean
) {
  const hh = 48;
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, CANVAS_W, hh);
  ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, hh); ctx.lineTo(CANVAS_W, hh); ctx.stroke();

  // P1 left
  drawPlayerHUD(ctx, 20, hh, p1Name, score1, 'A', turn, role, '#f5c842');
  // P2 right
  drawPlayerHUD(ctx, CANVAS_W - 20, hh, p2Name, score2, 'B', turn, role, '#22d3ee');

  // Centre: turn + shot counter
  const cx = CANVAS_W / 2, cy = hh / 2;
  if (finished) {
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', cx, cy - 2);
  } else if (moving) {
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('...', cx, cy - 2);
  } else {
    const isMe = turn === role;
    ctx.beginPath(); ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? '#22c55e' : '#4b5563'; ctx.fill();
    ctx.fillStyle = isMe ? '#22c55e' : '#9ca3af'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(isMe ? 'YOUR SHOT' : 'WATCHING...', cx, cy + 2);
    ctx.textBaseline = 'alphabetic';
  }
  // Shot dots
  if (!finished) {
    const dotY = cy + 16;
    for (let i = 0; i < shotsPerTurn; i++) {
      ctx.beginPath(); ctx.arc(cx - (shotsPerTurn - 1) * 6 + i * 12, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = i < shotIndex ? '#22c55e' : 'rgba(255,255,255,0.15)'; ctx.fill();
    }
  }
}

function drawPlayerHUD(
  ctx: CanvasRenderingContext2D, x: number, barH: number,
  name: string, score: number, player: 'A' | 'B', turn: 'A' | 'B', role: 'A' | 'B', color: string
) {
  const isRight = player === 'B';
  const align: CanvasTextAlign = isRight ? 'right' : 'left';
  const isActive = turn === player;
  const display = name + (player === role ? ' (You)' : '');
  const ax = x, ay = barH / 2;
  ctx.beginPath(); ctx.arc(ax, ay, 14, 0, Math.PI * 2);
  ctx.fillStyle = isActive ? color : '#333'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(player === 'A' ? 'P1' : 'P2', ax, ay);
  const nx = isRight ? ax - 24 : ax + 24;
  ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillStyle = '#9ca3af'; ctx.font = '11px sans-serif'; ctx.fillText(display, nx, 8);
  ctx.textBaseline = 'bottom'; ctx.fillStyle = '#fff'; ctx.font = '600 28px sans-serif';
  if (isActive) { ctx.shadowColor = 'rgba(255,200,50,0.4)'; ctx.shadowBlur = 8; }
  ctx.fillText(String(score), nx, barH - 4);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}
