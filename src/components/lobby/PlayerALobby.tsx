'use client';

import { Users } from 'lucide-react';
import type { LobbyPlayer } from '@/hooks/useLobbyPolling';
import { LobbyPlayerRow } from './LobbyPlayerRow';
import { LobbyExpiryBar } from './LobbyExpiryBar';

interface PlayerALobbyProps {
  players: LobbyPlayer[];
  stakeCents: number;
  gameName: string;
  onInvite: (targetEntryId: string) => void;
  invitePending: boolean;
  expiresAt: string | null;
  onLeave: () => void;
  isLeaving?: boolean;
  error?: string | null;
}

function formatUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function PlayerALobby({
  players,
  stakeCents,
  gameName,
  onInvite,
  invitePending,
  expiresAt,
  onLeave,
  isLeaving,
  error,
}: PlayerALobbyProps) {
  const hasPlayers = players.length > 0;

  return (
    <div className="space-y-3">
      {/* Status strip */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            hasPlayers ? 'bg-brand-600 animate-pulse' : 'bg-amber-500'
          }`}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-fg">
            {hasPlayers ? 'Looking for opponents' : 'Waiting for opponents'}
          </p>
          <p className="text-[11px] text-fg-muted font-mono">
            Stake: ${formatUsd(stakeCents)} &middot; {gameName}
          </p>
        </div>
      </div>

      {/* Player list */}
      <div className="rounded-xl border border-themed bg-elevated overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-themed">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-fg-muted" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
              Available players
            </span>
          </div>
          {hasPlayers && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
              {players.length}
            </span>
          )}
        </div>

        {hasPlayers ? (
          <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
            {players.map((p) => (
              <LobbyPlayerRow
                key={p.lobbyEntryId}
                player={p}
                onInvite={onInvite}
                disabled={invitePending}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <div className="flex justify-center gap-1.5 mb-4" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-fg-muted animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-sm font-semibold text-fg">No players in the lobby yet</p>
            <p className="text-[11px] text-fg-muted mt-1">
              Players who join as Player B will appear here automatically.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-danger-400 font-mono" role="alert">
          {error}
        </p>
      )}

      <LobbyExpiryBar expiresAt={expiresAt} onLeave={onLeave} isLeaving={isLeaving} />
    </div>
  );
}
