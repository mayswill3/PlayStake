'use client';

import { Check, User, Users } from 'lucide-react';
import type { GameConfig, RoleMeta } from './game-config';
import type { PlayerRole } from '@/app/play/_shared/types';
import { LobbyPanel } from '@/app/play/_shared/LobbyPanel';
import { PlayStakeWidget, type PlayStakeWidgetHandle } from '@/app/play/_shared/PlayStakeWidget';
import { Spinner } from '@/components/ui/Spinner';
import type { Ref } from 'react';

interface RoleSelectionPanelProps {
  config: GameConfig;
  phase: 'role-select' | 'setup' | 'lobby';
  role: PlayerRole | null;
  isSettingUp: boolean;
  onRoleSelect: (role: PlayerRole) => void;
  // Lobby
  gameCode?: string | null;
  onCreateGame?: () => Promise<void>;
  onJoinGame?: (code: string) => Promise<true | string>;
  isCreating?: boolean;
  isJoining?: boolean;
  // Widget
  widgetToken?: string | null;
  gameId?: string | null;
  widgetRef?: Ref<PlayStakeWidgetHandle>;
  onBetCreated?: (bet: { betId: string; amount: number }) => void;
  onBetAccepted?: (bet: { betId: string }) => void;
  onBetSettled?: (bet: { outcome: string }) => void;
  onWidgetError?: (err: { message: string }) => void;
}

export function RoleSelectionPanel({
  config,
  phase,
  role,
  isSettingUp,
  onRoleSelect,
  gameCode,
  onCreateGame,
  onJoinGame,
  isCreating,
  isJoining,
  widgetToken,
  gameId,
  widgetRef,
  onBetCreated,
  onBetAccepted,
  onBetSettled,
  onWidgetError,
}: RoleSelectionPanelProps) {
  return (
    <div className="rounded-2xl border border-themed bg-card p-5 lg:p-6 lg:sticky lg:top-20 space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-bold text-fg">Choose your role</h2>
        <p className="text-sm text-fg-secondary mt-1">
          Select how you want to enter this match
        </p>
      </div>

      {/* Role cards — disabled during setup but still visible */}
      <div className="grid grid-cols-2 gap-3">
        <RoleCard
          role="A"
          meta={config.roleA}
          selected={role === 'A'}
          disabled={isSettingUp || phase === 'lobby'}
          onSelect={() => onRoleSelect('A')}
        />
        <RoleCard
          role="B"
          meta={config.roleB}
          selected={role === 'B'}
          disabled={isSettingUp || phase === 'lobby'}
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

      {/* Lobby panel — create game / join game */}
      {phase === 'lobby' && role && onCreateGame && onJoinGame && (
        <LobbyPanel
          role={role}
          gameCode={gameCode ?? null}
          onCreateGame={onCreateGame}
          onJoinGame={onJoinGame}
          isCreating={isCreating}
          isJoining={isJoining}
        />
      )}

      {/* Widget — renders once authenticated */}
      {widgetToken && gameId && (
        <div>
          <h3 className="text-[11px] font-semibold text-fg-muted uppercase tracking-widest mb-2">
            Place your wager
          </h3>
          <PlayStakeWidget
            ref={widgetRef}
            widgetToken={widgetToken}
            gameId={gameId}
            onBetCreated={onBetCreated}
            onBetAccepted={onBetAccepted}
            onBetSettled={onBetSettled}
            onError={onWidgetError}
          />
        </div>
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
