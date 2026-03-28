'use client';

import { useState } from 'react';
import { Zap, X, LogOut } from 'lucide-react';

interface GameMobileFABProps {
  children?: React.ReactNode;
  onExit: () => void;
}

export function GameMobileFAB({ children, onExit }: GameMobileFABProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* FAB button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[200] flex h-12 w-12 items-center justify-center rounded-full bg-brand-400 text-surface-950 shadow-lg shadow-brand-400/25 active:scale-95 transition-transform"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="Open game menu"
        >
          <Zap className="h-5 w-5" />
        </button>
      )}

      {/* Slide-up panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[201] bg-surface-900 border-t border-white/10 rounded-t-xl max-h-[85dvh] overflow-y-auto"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              animation: 'slideUp 0.2s ease-out',
            }}
          >
            {/* Handle + close */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-400" />
                <span className="font-display text-sm font-semibold text-text-primary">PlayStake</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-800 text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Widget content */}
            {children && (
              <div className="px-4 py-3">
                {children}
              </div>
            )}

            {/* Exit button */}
            <div className="px-4 py-3 border-t border-white/8">
              <button
                onClick={() => {
                  setOpen(false);
                  onExit();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-sm border border-danger-500/30 bg-danger-500/10 px-4 py-3 font-mono text-sm text-danger-400 hover:bg-danger-500/20 transition-colors"
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
