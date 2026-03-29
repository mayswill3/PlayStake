'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, X, LogOut, ChevronUp, Wallet, CircleDot, Info } from 'lucide-react';

interface GameMobileFABProps {
  children?: React.ReactNode;
  onExit: () => void;
  balance?: { available: number; escrowed: number } | null;
  betAmount?: number;
  betStatus?: string;
  turnInfo?: string;
  playerInfo?: string;
}

type ViewState = 'closed' | 'quick' | 'full';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function GameMobileFAB({ children, onExit, balance: balanceProp, betAmount, betStatus, turnInfo, playerInfo }: GameMobileFABProps) {
  const [view, setView] = useState<ViewState>('closed');
  const [showWidget, setShowWidget] = useState(false);
  const [showInfoBar, setShowInfoBar] = useState(false);
  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fetchedBalance, setFetchedBalance] = useState<{ available: number; escrowed: number } | null>(null);
  const quickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Auto-dismiss quick popup after 5 seconds
  useEffect(() => {
    if (view === 'quick') {
      quickTimerRef.current = setTimeout(() => setView('closed'), 5000);
      return () => { if (quickTimerRef.current) clearTimeout(quickTimerRef.current); };
    }
  }, [view]);

  const handleFABTap = useCallback(() => {
    if (view === 'closed') {
      setView('quick');
    } else if (view === 'quick') {
      setView('full');
    } else {
      setView('closed');
    }
  }, [view]);

  const handleClose = useCallback(() => {
    setView('closed');
    setShowWidget(false);
  }, []);

  const availableDisplay = balance ? formatCents(balance.available) : '--';
  const escrowedDisplay = balance ? formatCents(balance.escrowed) : '--';
  const betDisplay = betAmount ? formatCents(betAmount) : null;

  const handleInfoToggle = useCallback(() => {
    setShowInfoBar(prev => {
      if (!prev) {
        // Auto-hide after 4 seconds
        if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
        infoTimerRef.current = setTimeout(() => setShowInfoBar(false), 4000);
      }
      return !prev;
    });
  }, []);

  return (
    <div className="lg:hidden">
      {/* ---- Info toggle button (top-left) ---- */}
      <button
        onClick={handleInfoToggle}
        className="fixed top-2 left-2 z-[200] flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-text-secondary backdrop-blur-sm active:scale-90 transition-all"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        aria-label="Toggle game info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {/* ---- Info bar (shown on toggle) ---- */}
      {showInfoBar && (
        <div
          className="fixed top-0 left-0 right-0 z-[190] bg-surface-950/90 backdrop-blur-md py-2 pr-4 pl-12 flex items-center justify-between"
          style={{
            paddingTop: 'max(8px, env(safe-area-inset-top))',
            animation: 'slideUp 0.15s ease-out',
          }}
        >
          <div className="flex items-center gap-3">
            {playerInfo && (
              <span className="font-mono text-[11px] text-text-secondary">{playerInfo}</span>
            )}
          </div>
          <div>
            {turnInfo && (
              <span className="font-mono text-[11px] font-semibold text-brand-400">{turnInfo}</span>
            )}
          </div>
        </div>
      )}

      {/* ---- FAB Button (subtler) ---- */}
      {view === 'closed' && (
        <button
          onClick={handleFABTap}
          className="fixed bottom-4 right-4 z-[200] flex h-10 w-10 items-center justify-center rounded-full bg-brand-400/70 text-surface-950 shadow-md backdrop-blur-sm active:scale-90 transition-all"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="Open game menu"
        >
          <Zap className="h-4 w-4" />
        </button>
      )}

      {/* ---- Quick Glance Popup ---- */}
      {view === 'quick' && (
        <>
          {/* Tap outside to dismiss */}
          <div className="fixed inset-0 z-[199]" onClick={handleClose} />

          <div
            className="fixed bottom-16 right-4 z-[200] w-56 rounded-lg bg-surface-900/95 border border-white/10 backdrop-blur-md shadow-xl"
            style={{
              marginBottom: 'env(safe-area-inset-bottom, 0px)',
              animation: 'slideUp 0.15s ease-out',
            }}
          >
            {/* Balance */}
            <div className="px-3 py-2.5 border-b border-white/8">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="h-3 w-3 text-brand-400" />
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Available</span>
              </div>
              <span className="font-mono text-sm font-semibold text-brand-400">{availableDisplay}</span>
              {balance && balance.escrowed > 0 && (
                <span className="font-mono text-[10px] text-warning-400 ml-2">{escrowedDisplay} in bets</span>
              )}
            </div>

            {/* Bet status */}
            {betDisplay && (
              <div className="px-3 py-2 border-b border-white/8">
                <div className="flex items-center gap-1.5">
                  <CircleDot className="h-3 w-3 text-yellow-400" />
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Active Bet</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-sm font-semibold text-text-primary">{betDisplay}</span>
                  {betStatus && (
                    <span className="font-mono text-[9px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded uppercase">
                      {betStatus}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex divide-x divide-white/8">
              <button
                onClick={() => setView('full')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-mono text-[11px] text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
                Expand
              </button>
              <button
                onClick={() => { handleClose(); onExit(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-mono text-[11px] text-danger-400 hover:text-danger-300 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Exit
              </button>
            </div>
          </div>

          {/* Mini FAB (active state) */}
          <button
            onClick={handleFABTap}
            className="fixed bottom-4 right-4 z-[200] flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-surface-950 shadow-md active:scale-90 transition-all"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="Expand game menu"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </>
      )}

      {/* ---- Full Slide-Up Panel ---- */}
      {view === 'full' && (
        <>
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
        </>
      )}
    </div>
  );
}
