'use client';

import { ArrowRight } from 'lucide-react';
import type { LobbyPlayer } from '@/hooks/useLobbyPolling';

interface LobbyPlayerRowProps {
  player: LobbyPlayer;
  onInvite: (targetEntryId: string) => void;
  disabled?: boolean;
}

function formatWaitTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'Just joined';
  if (seconds < 60) return `Waiting ${seconds}s`;
  const m = Math.floor(seconds / 60);
  return `Waiting ${m}m`;
}

export function LobbyPlayerRow({ player, onInvite, disabled }: LobbyPlayerRowProps) {
  return (
    <div
      className="
        flex items-center justify-between gap-3
        rounded-xl border border-themed bg-card
        p-3 hover:bg-elevated transition-colors
      "
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="
            flex h-9 w-9 shrink-0 items-center justify-center rounded-full
            bg-brand-600/10 text-brand-600 dark:text-brand-400
            text-xs font-bold
          "
          aria-hidden="true"
        >
          {player.avatarInitials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{player.displayName}</p>
          <p className="text-[11px] text-fg-muted">{formatWaitTime(player.waitingSince)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onInvite(player.lobbyEntryId)}
        disabled={disabled}
        className="
          inline-flex items-center gap-1.5 shrink-0
          rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white
          hover:bg-brand-700 transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        Invite
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
