'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { GAME_CONFIG } from './game-config';
import { GameInfoPanel } from './game-info-panel';
import { RoleSelectionPanel } from './role-selection-panel';
import { CollapsibleEventLog } from './collapsible-event-log';
import type { PlayerRole, LogEntry } from '@/app/play/_shared/types';
import type { LobbyMatchResult } from '@/components/lobby/LobbyContainer';

interface GameLobbyLayoutProps {
  gameKey: keyof typeof GAME_CONFIG;
  phase: 'role-select' | 'setup' | 'lobby';
  role: PlayerRole | null;
  isSettingUp: boolean;
  onRoleSelect: (role: PlayerRole) => void;
  // Matchmaking
  myUserId: string;
  myDisplayName: string;
  onMatched: (result: LobbyMatchResult) => void;
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

        {/* Right: role selection + matchmaking lobby */}
        <div className="order-first lg:order-last">
          <RoleSelectionPanel
            config={config}
            phase={props.phase}
            role={props.role}
            isSettingUp={props.isSettingUp}
            onRoleSelect={props.onRoleSelect}
            gameType={props.gameKey as string}
            myUserId={props.myUserId}
            myDisplayName={props.myDisplayName}
            onMatched={props.onMatched}
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
