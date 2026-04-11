'use client';

import { RadarAnimation } from './RadarAnimation';
import { LobbyExpiryBar } from './LobbyExpiryBar';

interface PlayerBWaitingProps {
  gameName: string;
  expiresAt: string | null;
  onLeave: () => void;
  isLeaving?: boolean;
}

export function PlayerBWaiting({
  gameName,
  expiresAt,
  onLeave,
  isLeaving,
}: PlayerBWaitingProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-fg">You&apos;re in the lobby</p>
          <p className="text-[11px] text-fg-muted font-mono">
            Waiting for Player A to invite you
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-themed bg-elevated px-4 py-6 text-center">
        <RadarAnimation />
        <p className="text-sm font-semibold text-fg mt-2">Scanning for opponents…</p>
        <p className="text-[11px] text-fg-muted mt-1">
          Player A will send you a match invite.
        </p>
        <p className="text-[10px] text-fg-muted mt-3 font-mono uppercase tracking-widest">
          {gameName}
        </p>
      </div>

      <LobbyExpiryBar expiresAt={expiresAt} onLeave={onLeave} isLeaving={isLeaving} />
    </div>
  );
}
