'use client';

import { Check, User, Users } from 'lucide-react';
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
  return (
    <div className="rounded-2xl border border-themed bg-card p-5 lg:p-6 lg:sticky lg:top-20 space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-bold text-fg">Choose your role</h2>
        <p className="text-sm text-fg-secondary mt-1">
          Select how you want to enter this match
        </p>
      </div>

      {/* Role cards — the currently-selected card is disabled (no-op click);
          the other card remains clickable so the user can switch. Switching
          unmounts the LobbyContainer (keyed on role) which fires a DELETE
          /api/lobby/leave against the old entry, then a fresh container
          mounts for the new role. */}
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

      {/* Matchmaking lobby — keyed on role so switching roles unmounts the
          current container, firing its beacon-based leave cleanup. */}
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
