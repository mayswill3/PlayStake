'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Ref } from 'react';
import { GAME_CONFIG } from './game-config';
import { GameInfoPanel } from './game-info-panel';
import { RoleSelectionPanel } from './role-selection-panel';
import { CollapsibleEventLog } from './collapsible-event-log';
import type { PlayerRole, LogEntry } from '@/app/play/_shared/types';
import type { PlayStakeWidgetHandle } from '@/app/play/_shared/PlayStakeWidget';

interface GameLobbyLayoutProps {
  gameKey: keyof typeof GAME_CONFIG;
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
  // Events
  events: LogEntry[];
}

export function GameLobbyLayout(props: GameLobbyLayoutProps) {
  const config = GAME_CONFIG[props.gameKey];
  if (!config) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-5" aria-label="Breadcrumb">
        <Link href="/play" className="text-fg-muted hover:text-fg transition-colors">
          Games
        </Link>
        <ChevronRight size={14} className="text-fg-muted" />
        <span className="text-fg font-semibold">{config.name}</span>
      </nav>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: game info — appears AFTER role panel on mobile */}
        <div className="order-last lg:order-first">
          <GameInfoPanel config={config} />
        </div>

        {/* Right: role selection / lobby / widget */}
        <div className="order-first lg:order-last">
          <RoleSelectionPanel
            config={config}
            phase={props.phase}
            role={props.role}
            isSettingUp={props.isSettingUp}
            onRoleSelect={props.onRoleSelect}
            gameCode={props.gameCode}
            onCreateGame={props.onCreateGame}
            onJoinGame={props.onJoinGame}
            isCreating={props.isCreating}
            isJoining={props.isJoining}
            widgetToken={props.widgetToken}
            gameId={props.gameId}
            widgetRef={props.widgetRef}
            onBetCreated={props.onBetCreated}
            onBetAccepted={props.onBetAccepted}
            onBetSettled={props.onBetSettled}
            onWidgetError={props.onWidgetError}
          />
        </div>
      </div>

      {/* Event log — full width below */}
      <div className="mt-6">
        <CollapsibleEventLog events={props.events} />
      </div>
    </div>
  );
}
