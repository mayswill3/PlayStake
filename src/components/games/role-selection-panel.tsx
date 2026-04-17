'use client';

import { useEffect, useState } from 'react';
import { Check, User, Users, Wallet, Trophy, TrendingUp } from 'lucide-react';
import type { GameConfig, RoleMeta } from './game-config';
import type { PlayerRole } from '@/app/play/_shared/types';
import { Spinner } from '@/components/ui/Spinner';
import { LobbyContainer, type LobbyMatchResult } from '@/components/lobby/LobbyContainer';

interface RoleSelectionPanelProps {
  config: GameConfig;
  phase: 'role-select' | 'setup' | 'lobby';
  role: PlayerRole | null;
  isSettingUp: boolean;
  onRoleSelect: (role: PlayerRole) => void;
  // Lobby (matchmaking)
  gameType: string;
  myUserId: string;
  myDisplayName: string;
  onMatched?: (result: LobbyMatchResult) => void;
}

interface PlayerInfo {
  balance: number;
  escrowed: number;
  stats: { wins: number; losses: number; draws: number; winRate: number } | null;
}

export function RoleSelectionPanel({
  config,
  phase,
  role,
  isSettingUp,
  onRoleSelect,
  gameType,
  myUserId,
  myDisplayName,
  onMatched,
}: RoleSelectionPanelProps) {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Fetch balance and stats when the user is identified
  useEffect(() => {
    if (!myUserId) return;
    let cancelled = false;
    setLoadingInfo(true);

    Promise.all([
      fetch('/api/wallet/balance').then(r => r.ok ? r.json() : null),
      fetch('/api/dashboard/stats').then(r => r.ok ? r.json() : null),
    ]).then(([balanceData, statsData]) => {
      if (cancelled) return;
      setPlayerInfo({
        balance: balanceData?.available ?? 0,
        escrowed: balanceData?.escrowed ?? 0,
        stats: statsData ? {
          wins: statsData.wins ?? 0,
          losses: statsData.losses ?? 0,
          draws: statsData.draws ?? 0,
          winRate: statsData.winRate ?? 0,
        } : null,
      });
      setLoadingInfo(false);
    }).catch(() => {
      if (!cancelled) setLoadingInfo(false);
    });

    return () => { cancelled = true; };
  }, [myUserId]);

  return (
    <div className="rounded-2xl border border-themed bg-card p-5 lg:p-6 lg:sticky lg:top-20 space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-bold text-fg">Choose your role</h2>
        <p className="text-sm text-fg-secondary mt-1">
          Select how you want to enter this match
        </p>
      </div>

      {/* Player info card — balance, record, display name */}
      {myUserId && (
        <div className="rounded-xl border border-themed bg-elevated p-4 space-y-3">
          {/* Name row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600/15 text-brand-600 dark:text-brand-400">
                <User size={14} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">{myDisplayName || 'Player'}</p>
                <p className="text-[10px] text-fg-muted font-mono">{myUserId.slice(0, 8)}...</p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          {loadingInfo ? (
            <div className="flex items-center gap-2 py-2">
              <Spinner size="sm" />
              <span className="text-xs text-fg-muted">Loading account...</span>
            </div>
          ) : playerInfo ? (
            <div className="grid grid-cols-3 gap-3">
              {/* Balance */}
              <div className="rounded-lg bg-page p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wallet size={11} className="text-brand-600 dark:text-brand-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Balance</span>
                </div>
                <p className="text-base font-bold text-fg font-mono tabular-nums">
                  ${(playerInfo.balance / 100).toFixed(2)}
                </p>
                {playerInfo.escrowed > 0 && (
                  <p className="text-[9px] text-fg-muted mt-0.5">
                    ${(playerInfo.escrowed / 100).toFixed(2)} in play
                  </p>
                )}
              </div>

              {/* Win/Loss */}
              <div className="rounded-lg bg-page p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy size={11} className="text-brand-600 dark:text-brand-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Record</span>
                </div>
                {playerInfo.stats ? (
                  <>
                    <p className="text-base font-bold text-fg font-mono tabular-nums">
                      <span className="text-brand-600 dark:text-brand-400">{playerInfo.stats.wins}</span>
                      <span className="text-fg-muted mx-0.5">-</span>
                      <span className="text-danger-600 dark:text-danger-400">{playerInfo.stats.losses}</span>
                    </p>
                    {playerInfo.stats.draws > 0 && (
                      <p className="text-[9px] text-fg-muted mt-0.5">
                        {playerInfo.stats.draws} draw{playerInfo.stats.draws !== 1 ? 's' : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-fg-muted">—</p>
                )}
              </div>

              {/* Win rate */}
              <div className="rounded-lg bg-page p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp size={11} className="text-brand-600 dark:text-brand-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Win %</span>
                </div>
                {playerInfo.stats ? (
                  <p className="text-base font-bold text-fg font-mono tabular-nums">
                    {Math.round(playerInfo.stats.winRate * 100)}%
                  </p>
                ) : (
                  <p className="text-sm text-fg-muted">—</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Role cards */}
      <div className="grid grid-cols-2 gap-3">
        <RoleCard
          role="A"
          meta={config.roleA}
          selected={role === 'A'}
          disabled={isSettingUp || role === 'A'}
          onSelect={() => onRoleSelect('A')}
        />
        <RoleCard
          role="B"
          meta={config.roleB}
          selected={role === 'B'}
          disabled={isSettingUp || role === 'B'}
          onSelect={() => onRoleSelect('B')}
        />
      </div>

      {/* Setting up indicator */}
      {isSettingUp && (
        <div className="rounded-lg border border-themed bg-elevated p-4 flex items-center gap-3">
          <Spinner size="sm" />
          <p className="text-sm text-fg-secondary">Setting up authentication…</p>
        </div>
      )}

      {/* Matchmaking lobby */}
      {phase === 'lobby' && role && onMatched && (
        <LobbyContainer
          key={role}
          role={role}
          gameType={gameType}
          gameName={config.name}
          myUserId={myUserId}
          myDisplayName={myDisplayName}
          onMatched={onMatched}
        />
      )}
    </div>
  );
}

interface RoleCardProps {
  role: 'A' | 'B';
  meta: RoleMeta;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function RoleCard({ role, meta, selected, disabled, onSelect }: RoleCardProps) {
  const isA = role === 'A';
  const iconBg = isA
    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    : 'bg-pink-500/10 text-pink-600 dark:text-pink-400';
  const Icon = isA ? User : Users;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`
        relative rounded-xl border-2 p-4 text-left transition-all
        ${selected
          ? 'border-brand-600 bg-brand-600/5 dark:bg-brand-600/10'
          : 'border-themed bg-page hover:border-brand-600/40 hover:bg-elevated'
        }
        ${disabled && !selected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
      aria-pressed={selected}
    >
      {/* Selected check */}
      {selected && (
        <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
          <Check size={12} className="text-white" strokeWidth={3} />
        </div>
      )}

      {/* Icon */}
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg mb-3 ${iconBg}`}>
        <Icon size={20} strokeWidth={2} />
      </div>

      {/* Text */}
      <p className="font-semibold text-fg text-sm">{meta.title}</p>
      <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 mt-0.5">
        {meta.subtitle}
      </p>
      <p className="text-[11px] text-fg-muted mt-2 leading-relaxed">
        {meta.description}
      </p>
    </button>
  );
}
