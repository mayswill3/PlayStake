'use client';

import { Trophy, X, Minus, RotateCcw, LogOut } from 'lucide-react';

export interface SettlementResult {
  outcome: 'PLAYER_A_WIN' | 'PLAYER_B_WIN' | 'DRAW';
  winnerPayout: number; // dollars
}

export function deriveOutcome(
  settlement: SettlementResult,
  role: 'A' | 'B'
): 'win' | 'loss' | 'draw' {
  if (settlement.outcome === 'DRAW') return 'draw';
  if (settlement.outcome === 'PLAYER_A_WIN') return role === 'A' ? 'win' : 'loss';
  return role === 'B' ? 'win' : 'loss';
}

export function formatResultAmount(
  outcome: 'win' | 'loss' | 'draw',
  winnerPayout: number,
  betAmountCents: number
): string {
  if (outcome === 'win') return `+$${winnerPayout.toFixed(2)}`;
  if (outcome === 'draw') return `$${(betAmountCents / 100).toFixed(2)} Returned`;
  return `-$${(betAmountCents / 100).toFixed(2)}`;
}

interface GameResultOverlayProps {
  outcome: 'win' | 'loss' | 'draw';
  amount: string;
  visible: boolean;
  onPlayAgain?: () => void;
  /** Mobile full-viewport overlay variant */
  mobile?: boolean;
  onLobby?: () => void;
  scoreText?: string;
}

const CONFETTI_COLORS = [
  'bg-brand-400', 'bg-yellow-400', 'bg-pink-400', 'bg-blue-400',
  'bg-purple-400', 'bg-orange-400', 'bg-teal-400', 'bg-red-400',
];

export function GameResultOverlay({ outcome, amount, visible, onPlayAgain, mobile, onLobby, scoreText }: GameResultOverlayProps) {
  if (!visible) return null;

  if (mobile) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
        <div className="relative mx-4 max-w-xs w-full overflow-hidden rounded-lg border border-white/10 p-6 text-center" style={{ background: 'rgba(15,15,26,0.95)' }}>
          {/* Glow */}
          {outcome === 'win' && (
            <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,135,0.15) 0%, transparent 70%)', animation: 'pulseGlow 2s ease-in-out infinite' }} />
          )}
          {outcome === 'loss' && (
            <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(255,59,92,0.1) 0%, transparent 70%)', animation: 'pulseGlow 2.5s ease-in-out infinite' }} />
          )}

          {/* Confetti */}
          {outcome === 'win' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className={`absolute w-2 h-2 rounded-full ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`} style={{ left: `${10 + (i * 8.5)}%`, top: '-8px', animation: `confettiFall ${1.2 + Math.random() * 0.8}s ease-out ${i * 0.1}s forwards` }} />
              ))}
            </div>
          )}

          {/* Icon */}
          <div className="relative mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ animation: outcome === 'loss' ? 'shake 0.5s ease-in-out, scaleIn 0.4s ease-out forwards' : 'scaleIn 0.4s ease-out forwards', background: outcome === 'win' ? 'rgba(0,255,135,0.15)' : outcome === 'loss' ? 'rgba(255,59,92,0.15)' : 'rgba(255,184,0,0.15)' }}>
            {outcome === 'win' && <Trophy className="h-6 w-6 text-brand-400" />}
            {outcome === 'loss' && <X className="h-6 w-6 text-danger-400" />}
            {outcome === 'draw' && <Minus className="h-6 w-6 text-warning-400" />}
          </div>

          {/* Title */}
          <h3 className="relative font-display text-xl font-bold uppercase tracking-widest mb-1" style={{ animation: 'scaleIn 0.4s ease-out forwards', color: outcome === 'win' ? 'var(--color-brand-400)' : outcome === 'loss' ? 'var(--color-danger-400)' : 'var(--color-warning-400)' }}>
            {outcome === 'win' ? 'Victory!' : outcome === 'loss' ? 'Defeat' : 'Draw'}
          </h3>

          {/* Score */}
          {scoreText && (
            <p className="relative font-mono text-sm text-text-secondary mb-1" style={{ animation: 'slideUpFadeIn 0.3s ease-out 0.2s both' }}>
              {scoreText}
            </p>
          )}

          {/* Amount */}
          <p className="relative font-mono text-lg font-semibold" style={{ animation: 'slideUpFadeIn 0.3s ease-out 0.3s both', color: outcome === 'win' ? 'var(--color-brand-400)' : outcome === 'loss' ? 'var(--color-danger-400)' : 'var(--color-warning-400)' }}>
            {amount}
          </p>

          {/* Subtitle */}
          <p className="relative mt-1 font-mono text-xs text-text-muted" style={{ animation: 'slideUpFadeIn 0.3s ease-out 0.4s both' }}>
            {outcome === 'win' ? 'Winnings added to your balance' : outcome === 'loss' ? 'Better luck next time' : 'Stakes returned to both players'}
          </p>

          {/* Buttons */}
          <div className="relative mt-4 flex gap-3" style={{ animation: 'slideUpFadeIn 0.3s ease-out 0.6s both' }}>
            {onPlayAgain && (
              <button onClick={onPlayAgain} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg bg-brand-400/90 font-mono text-sm font-semibold text-black active:scale-[0.97] transition-transform">
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
            )}
            {onLobby && (
              <button onClick={onLobby} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg border border-white/10 bg-surface-800 font-mono text-sm text-text-primary active:scale-[0.97] transition-transform">
                <LogOut className="h-4 w-4" />
                Lobby
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-sm border p-8 text-center"
      style={{
        borderColor: outcome === 'win' ? 'rgba(0,255,135,0.3)'
          : outcome === 'loss' ? 'rgba(255,59,92,0.3)'
          : 'rgba(255,184,0,0.3)',
        background: outcome === 'win' ? 'rgba(0,255,135,0.05)'
          : outcome === 'loss' ? 'rgba(255,59,92,0.05)'
          : 'rgba(255,184,0,0.05)',
      }}
    >
      {/* Glow pulse for wins */}
      {outcome === 'win' && (
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,255,135,0.15) 0%, transparent 70%)',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Red glow pulse for losses */}
      {outcome === 'loss' && (
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,59,92,0.1) 0%, transparent 70%)',
            animation: 'pulseGlow 2.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Confetti for wins */}
      {outcome === 'win' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`absolute w-2 h-2 rounded-full ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
              style={{
                left: `${10 + (i * 8.5)}%`,
                top: '-8px',
                animation: `confettiFall ${1.2 + Math.random() * 0.8}s ease-out ${i * 0.1}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      {/* Icon */}
      <div
        className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          animation: outcome === 'loss'
            ? 'shake 0.5s ease-in-out, scaleIn 0.4s ease-out forwards'
            : 'scaleIn 0.4s ease-out forwards',
          background: outcome === 'win' ? 'rgba(0,255,135,0.15)'
            : outcome === 'loss' ? 'rgba(255,59,92,0.15)'
            : 'rgba(255,184,0,0.15)',
        }}
      >
        {outcome === 'win' && <Trophy className="h-8 w-8 text-brand-400" />}
        {outcome === 'loss' && <X className="h-8 w-8 text-danger-400" />}
        {outcome === 'draw' && <Minus className="h-8 w-8 text-warning-400" />}
      </div>

      {/* Title */}
      <h3
        className="relative font-display text-2xl font-bold uppercase tracking-widest mb-2"
        style={{
          animation: outcome === 'loss'
            ? 'shake 0.5s ease-in-out, scaleIn 0.4s ease-out forwards'
            : 'scaleIn 0.4s ease-out forwards',
          color: outcome === 'win' ? 'var(--color-brand-400)'
            : outcome === 'loss' ? 'var(--color-danger-400)'
            : 'var(--color-warning-400)',
        }}
      >
        {outcome === 'win' ? 'Victory!' : outcome === 'loss' ? 'Defeat' : 'Draw'}
      </h3>

      {/* Amount */}
      <p
        className="relative font-mono text-xl font-semibold"
        style={{
          animation: 'slideUpFadeIn 0.3s ease-out 0.3s both',
          color: outcome === 'win' ? 'var(--color-brand-400)'
            : outcome === 'loss' ? 'var(--color-danger-400)'
            : 'var(--color-warning-400)',
        }}
      >
        {amount}
      </p>

      {/* Subtitle */}
      <p
        className="relative mt-1 font-mono text-xs text-text-secondary"
        style={{ animation: 'slideUpFadeIn 0.3s ease-out 0.5s both' }}
      >
        {outcome === 'win' ? 'Winnings added to your balance'
          : outcome === 'loss' ? 'Better luck next time'
          : 'Stakes returned to both players'}
      </p>

      {/* Play Again button */}
      {onPlayAgain && (
        <button
          onClick={onPlayAgain}
          className="relative mt-5 inline-flex items-center gap-2 rounded-sm border border-white/10 bg-surface-800 px-5 py-2.5 font-mono text-sm text-text-primary transition-colors hover:border-brand-400/30 hover:bg-surface-850"
          style={{ animation: 'slideUpFadeIn 0.3s ease-out 0.7s both' }}
        >
          <RotateCcw className="h-4 w-4" />
          Play Again
        </button>
      )}
    </div>
  );
}
