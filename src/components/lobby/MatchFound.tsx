'use client';

import { CheckCircle2, Swords } from 'lucide-react';

interface MatchFoundProps {
  playerAName: string;
  playerBName: string;
  stakeCents: number;
  gameName: string;
}

function formatUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function MatchFound({ playerAName, playerBName, stakeCents, gameName }: MatchFoundProps) {
  const total = stakeCents * 2;

  return (
    <div className="rounded-xl border-2 border-brand-600/40 bg-brand-600/5 p-5 text-center animate-[fadeIn_0.25s_ease-out]">
      <div className="flex items-center justify-center gap-2 mb-3">
        <CheckCircle2 size={18} className="text-brand-600 dark:text-brand-400" />
        <p className="text-sm font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Match found!
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 my-4 text-sm">
        <span className="font-semibold text-fg truncate max-w-[120px]">{playerAName}</span>
        <Swords size={16} className="text-fg-muted shrink-0" />
        <span className="font-semibold text-fg truncate max-w-[120px]">{playerBName}</span>
      </div>

      <p className="text-[11px] text-fg-muted font-mono mb-4 tabular-nums">
        ${formatUsd(stakeCents)} each &middot; ${formatUsd(total)} pot &middot; {gameName}
      </p>

      {/* Indeterminate loading bar */}
      <div
        className="h-1.5 rounded-full bg-card overflow-hidden border border-themed"
        aria-label="Loading game"
      >
        <div className="h-full w-1/3 bg-brand-600 animate-[matchLoad_1.2s_ease-in-out_infinite]" />
      </div>

      <p className="text-[11px] text-fg-muted mt-2">Loading game…</p>

      <style jsx>{`
        @keyframes matchLoad {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
