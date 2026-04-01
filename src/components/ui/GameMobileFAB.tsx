'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, X, LogOut, ChevronUp, Wallet, CircleDot } from 'lucide-react';

interface GameMobileFABProps {
  children?: React.ReactNode;
  onExit: () => void;
  onClose?: () => void;
  balance?: { available: number; escrowed: number } | null;
  betAmount?: number;
  betStatus?: string;
  /** @deprecated Game info now shown in MobileGameChrome zones */
  turnInfo?: string;
  /** @deprecated Game info now shown in MobileGameChrome zones */
  playerInfo?: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function GameMobileFAB({ children, onExit, onClose, balance: balanceProp, betAmount, betStatus }: GameMobileFABProps) {
  const [showWidget, setShowWidget] = useState(false);
  const [fetchedBalance, setFetchedBalance] = useState<{ available: number; escrowed: number } | null>(null);

  // Fetch balance from API (uses session cookie)
  useEffect(() => {
    let mounted = true;
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/wallet/balance');
        if (res.ok) {
          const data = await res.json();
          if (mounted) setFetchedBalance({ available: data.available, escrowed: data.escrowed });
        }
      } catch { /* ignore */ }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const balance = balanceProp ?? fetchedBalance;

  const availableDisplay = balance ? formatCents(balance.available) : '--';
  const escrowedDisplay = balance ? formatCents(balance.escrowed) : '--';
  const betDisplay = betAmount ? formatCents(betAmount) : null;

  const handleClose = useCallback(() => {
    setShowWidget(false);
    onClose?.();
  }, [onClose]);

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[201] bg-surface-900 border-t border-white/10 rounded-t-2xl max-h-[85dvh] overflow-y-auto"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-400/15">
              <Zap className="h-3.5 w-3.5 text-brand-400" />
            </div>
            <span className="font-display text-sm font-semibold text-text-primary">PlayStake</span>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-800 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Balance card */}
        <div className="mx-4 mt-2 p-3 rounded-lg bg-surface-800/80 border border-white/5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Available</p>
              <p className="font-mono text-lg font-bold text-brand-400">{availableDisplay}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-0.5">In Bets</p>
              <p className="font-mono text-lg font-bold text-warning-400">{escrowedDisplay}</p>
            </div>
          </div>
        </div>

        {/* Active bet card */}
        {betDisplay && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-surface-800/80 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Active Bet</p>
                <p className="font-mono text-lg font-bold text-text-primary">{betDisplay} <span className="text-xs text-text-muted">per player</span></p>
              </div>
              {betStatus && (
                <span className="font-mono text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full uppercase font-semibold">
                  {betStatus}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Widget (collapsible) */}
        <div className="mx-4 mt-3">
          <button
            onClick={() => setShowWidget(!showWidget)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-800/60 border border-white/5 font-mono text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>Bet Management</span>
            <ChevronUp className={`h-3.5 w-3.5 transition-transform ${showWidget ? '' : 'rotate-180'}`} />
          </button>
          {showWidget && children && (
            <div className="mt-2 rounded-lg overflow-hidden border border-white/5">
              {children}
            </div>
          )}
        </div>

        {/* Exit button */}
        <div className="mx-4 mt-4 mb-4">
          <button
            onClick={() => { handleClose(); onExit(); }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 font-mono text-sm font-semibold text-danger-400 hover:bg-danger-500/20 transition-colors active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
}
