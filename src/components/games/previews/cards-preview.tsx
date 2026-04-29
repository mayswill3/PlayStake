'use client';

import { useRef, useEffect } from 'react';

const W = 800;
const H = 450;

const SUITS  = ['♠', '♥', '♦', '♣'] as const;
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const;
type Suit  = typeof SUITS[number];
type Value = typeof VALUES[number];

interface CardData { value: Value; suit: Suit; rank: number }

// Pre-scripted rounds: [current, next] — next is always "correct" guess for drama
const SCRIPT: [CardData, CardData, 'higher' | 'lower'][] = [
  [{ value:'7',  suit:'♥', rank:5  }, { value:'Q',  suit:'♠', rank:10 }, 'higher'],
  [{ value:'K',  suit:'♦', rank:11 }, { value:'4',  suit:'♣', rank:2  }, 'lower' ],
  [{ value:'5',  suit:'♣', rank:3  }, { value:'A',  suit:'♥', rank:12 }, 'higher'],
  [{ value:'J',  suit:'♠', rank:9  }, { value:'3',  suit:'♦', rank:1  }, 'lower' ],
  [{ value:'6',  suit:'♥', rank:4  }, { value:'10', suit:'♠', rank:8  }, 'higher'],
  [{ value:'9',  suit:'♦', rank:7  }, { value:'2',  suit:'♣', rank:0  }, 'lower' ],
];

function isRed(suit: Suit) { return suit === '♥' || suit === '♦'; }

export function CardsPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CW = 110, CH = 155; // card width/height
    const CR = 10;             // corner radius

    let roundIdx  = 0;
    // phase: 'show' | 'guess' | 'reveal' | 'result' | 'next'
    let phase: 'show' | 'guess' | 'reveal' | 'result' | 'next' = 'show';
    let flipP = 0;      // card flip progress 0→1
    let resultAlpha = 0;
    let elapsed = 0;

    function schedule(fn: () => void, ms: number) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fn, ms);
    }

    function drawBackground() {
      const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 420);
      bg.addColorStop(0,   '#1a3a2a');
      bg.addColorStop(0.6, '#0f2218');
      bg.addColorStop(1,   '#081510');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Felt texture — subtle dots
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let x = 0; x < W; x += 18) {
        for (let y = 0; y < H; y += 18) {
          ctx.beginPath();
          ctx.arc(x + (y % 36 === 0 ? 9 : 0), y, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Title
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Higher / Lower', W / 2, H - 10);
    }

    function drawCard(x: number, y: number, card: CardData, faceUp: boolean, alpha = 1, scaleX = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + CW / 2, y + CH / 2);
      ctx.scale(scaleX, 1);
      ctx.translate(-CW / 2, -CH / 2);

      // Drop shadow
      ctx.shadowColor  = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur   = 18;
      ctx.shadowOffsetY = 5;

      if (faceUp) {
        // Card face
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(0, 0, CW, CH, CR);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(3, 3, CW - 6, CH - 6, CR - 2);
        ctx.stroke();

        const color = isRed(card.suit) ? '#dc2626' : '#1e293b';
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        ctx.textAlign    = 'left';

        // Top-left rank + suit
        ctx.font = `bold 18px serif`;
        ctx.fillText(card.value, 9, 10);
        ctx.font = '15px serif';
        ctx.fillText(card.suit, 9, 30);

        // Center suit
        ctx.font = '62px serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.suit, CW / 2, CH / 2);

        // Bottom-right (rotated)
        ctx.save();
        ctx.translate(CW, CH);
        ctx.rotate(Math.PI);
        ctx.font = `bold 18px serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = color;
        ctx.fillText(card.value, 9, 10);
        ctx.font = '15px serif';
        ctx.fillText(card.suit, 9, 30);
        ctx.restore();
      } else {
        // Card back — dark patterned
        const backGrad = ctx.createLinearGradient(0, 0, CW, CH);
        backGrad.addColorStop(0,   '#1e3a5f');
        backGrad.addColorStop(0.5, '#1a3050');
        backGrad.addColorStop(1,   '#162840');
        ctx.fillStyle = backGrad;
        ctx.beginPath();
        ctx.roundRect(0, 0, CW, CH, CR);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 1;
        for (let i = -CH; i < CW + CH; i += 14) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + CH, CH);
          ctx.stroke();
        }
        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(4, 4, CW - 8, CH - 8, CR - 3);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawGuessButtons(highlight: 'higher' | 'lower' | null) {
      const btnW = 110, btnH = 40;
      const gap  = 18;
      const bx   = W / 2 + CW / 2 + 30;
      const higherY = H / 2 - btnH - gap / 2;
      const lowerY  = H / 2 + gap / 2;

      const buttons: { label: string; icon: string; key: 'higher' | 'lower'; y: number; color: string }[] = [
        { label: 'Higher', icon: '▲', key: 'higher', y: higherY, color: '#22c55e' },
        { label: 'Lower',  icon: '▼', key: 'lower',  y: lowerY,  color: '#f59e0b' },
      ];

      for (const btn of buttons) {
        const isHighlighted = highlight === btn.key;
        ctx.save();
        ctx.shadowColor = isHighlighted ? `${btn.color}80` : 'transparent';
        ctx.shadowBlur  = isHighlighted ? 20 : 0;
        ctx.fillStyle   = isHighlighted ? btn.color : 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = isHighlighted ? btn.color : 'rgba(255,255,255,0.2)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, btn.y, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.font      = `bold 14px sans-serif`;
        ctx.fillStyle = isHighlighted ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${btn.icon}  ${btn.label}`, bx + btnW / 2, btn.y + btnH / 2);
      }
    }

    function drawResult(correct: boolean, alpha: number) {
      if (alpha <= 0) return;
      const text  = correct ? '✓  CORRECT!' : '✗  WRONG';
      const color = correct ? '#22c55e' : '#ef4444';
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font      = 'bold 20px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur  = 20;
      ctx.fillText(text, W / 2, H / 2 + CH / 2 + 30);
      ctx.restore();
    }

    function drawScorePanel() {
      const correct = Math.min(roundIdx, SCRIPT.length);
      ctx.save();
      ctx.fillStyle   = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(18, H / 2 - 35, 100, 70, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('ROUND', 68, H / 2 - 22);
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#22c55e';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(roundIdx % SCRIPT.length) + 1}`, 68, H / 2 + 8);
    }

    let lastTs = 0;
    let rafId  = 0;

    const [current, next, guess] = SCRIPT[roundIdx % SCRIPT.length];
    let curCard  = current;
    let nxtCard  = next;
    let curGuess = guess;

    function render(ts: number) {
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      elapsed += dt;

      ctx.clearRect(0, 0, W, H);
      drawBackground();
      drawScorePanel();

      const cx = W / 2 - CW / 2;  // center card X
      const cy = H / 2 - CH / 2;  // center card Y
      const nextX = cx + CW + 30;

      if (phase === 'show') {
        drawCard(cx, cy, curCard, true);
        drawGuessButtons(null);
      } else if (phase === 'guess') {
        drawCard(cx, cy, curCard, true);
        drawGuessButtons(curGuess);
      } else if (phase === 'reveal') {
        // Flip animation: scale card from 1→0→1, switching face at midpoint
        flipP = Math.min(flipP + dt * 3, 1);
        drawCard(cx, cy, curCard, true);
        const scaleX = flipP < 0.5 ? 1 - flipP * 2 : (flipP - 0.5) * 2;
        const faceUp  = flipP >= 0.5;
        drawCard(nextX, cy, nxtCard, faceUp, 1, scaleX < 0.01 ? 0.01 : scaleX);
        drawGuessButtons(curGuess);
        if (flipP >= 1) {
          resultAlpha = 0;
          phase = 'result';
          schedule(advance, 1400);
        }
      } else if (phase === 'result') {
        resultAlpha = Math.min(resultAlpha + dt * 3, 1);
        drawCard(cx,    cy, curCard, true);
        drawCard(nextX, cy, nxtCard, true);
        drawGuessButtons(curGuess);
        drawResult(true, resultAlpha); // always correct in the script
      } else if (phase === 'next') {
        drawCard(cx,    cy, curCard, true);
        drawCard(nextX, cy, nxtCard, true);
        drawGuessButtons(curGuess);
        drawResult(true, resultAlpha);
      }

      rafId = requestAnimationFrame(render);
    }

    function advance() {
      roundIdx++;
      const entry = SCRIPT[roundIdx % SCRIPT.length];
      curCard  = entry[0];
      nxtCard  = entry[1];
      curGuess = entry[2];
      flipP        = 0;
      resultAlpha  = 0;
      phase = 'show';
      schedule(startGuess, 700);
    }

    function startGuess() {
      phase = 'guess';
      schedule(startReveal, 900);
    }

    function startReveal() {
      flipP = 0;
      phase = 'reveal';
    }

    rafId = requestAnimationFrame((ts) => { lastTs = ts; render(ts); });
    schedule(startGuess, 900);

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
