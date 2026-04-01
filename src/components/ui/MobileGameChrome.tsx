'use client';

import { Volume2, VolumeX, Zap, X } from 'lucide-react';

interface MobileGameChromeProps {
  // Players
  player1Name: string;
  player2Name: string;
  isPlayer1Turn: boolean;
  player1Tracker: React.ReactNode;
  player2Tracker: React.ReactNode;
  // Wager
  wagerAmount?: string;
  gameType: string;
  // Actions
  onExit: () => void;
  isMuted: boolean;
  onSoundToggle: () => void;
  onFABTap: () => void;
  // Status pill
  statusMessage?: string;
  // Content
  children: React.ReactNode;
}

export function MobileGameChrome({
  player1Name,
  player2Name,
  isPlayer1Turn,
  player1Tracker,
  player2Tracker,
  wagerAmount,
  gameType,
  onExit,
  isMuted,
  onSoundToggle,
  onFABTap,
  statusMessage,
  children,
}: MobileGameChromeProps) {
  return (
    <>
      {/* HUD Bar */}
      <div className="mobile-zone-a lg:hidden">
        {/* Player 1 — left side */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Avatar ring */}
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              border: `2.5px solid ${isPlayer1Turn ? '#00ff87' : '#3a4a5a'}`,
              background: 'rgba(255,255,255,0.08)',
              boxShadow: isPlayer1Turn ? '0 0 8px rgba(0,255,135,0.3)' : 'none',
              transition: 'border-color 300ms, box-shadow 300ms',
            }}
          >
            <span className="font-mono text-[11px] font-bold text-text-primary/80">P1</span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[12px] font-semibold text-white truncate leading-tight">
              {player1Name}
            </p>
            <div className="mt-0.5">{player1Tracker}</div>
          </div>
        </div>

        {/* Center — wager + game type */}
        <div className="flex flex-col items-center flex-shrink-0 px-2">
          {wagerAmount && (
            <span className="font-mono text-[13px] font-bold" style={{ color: '#f4c542' }}>
              {wagerAmount}
            </span>
          )}
          <span className="font-mono text-[8px] uppercase tracking-widest text-white/40 leading-tight">
            {gameType}
          </span>
        </div>

        {/* Player 2 — right side */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <div className="min-w-0 text-right">
            <p className="font-mono text-[12px] font-semibold text-white truncate leading-tight">
              {player2Name}
            </p>
            <div className="mt-0.5 flex justify-end">{player2Tracker}</div>
          </div>
          {/* Avatar ring */}
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              border: `2.5px solid ${!isPlayer1Turn ? '#00ff87' : '#3a4a5a'}`,
              background: 'rgba(255,255,255,0.08)',
              boxShadow: !isPlayer1Turn ? '0 0 8px rgba(0,255,135,0.3)' : 'none',
              transition: 'border-color 300ms, box-shadow 300ms',
            }}
          >
            <span className="font-mono text-[11px] font-bold text-text-primary/80">P2</span>
          </div>
        </div>
      </div>

      {/* Floating action buttons — below HUD */}
      <div
        className="lg:hidden"
        style={{
          position: 'fixed',
          top: `calc(60px + env(safe-area-inset-top, 0px))`,
          left: `max(8px, env(safe-area-inset-left, 0px))`,
          zIndex: 110,
          display: 'flex',
          gap: 6,
        }}
      >
        <button onClick={onExit} className="mobile-game-btn" aria-label="Exit game">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="lg:hidden"
        style={{
          position: 'fixed',
          top: `calc(60px + env(safe-area-inset-top, 0px))`,
          right: `max(8px, env(safe-area-inset-right, 0px))`,
          zIndex: 110,
          display: 'flex',
          gap: 6,
        }}
      >
        <button onClick={onSoundToggle} className="mobile-game-btn" aria-label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button onClick={onFABTap} className="mobile-game-btn" style={{ background: 'rgba(0,255,135,0.15)', color: '#00ff87' }} aria-label="PlayStake menu">
          <Zap className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas */}
      {children}

      {/* Status pill — bottom center */}
      {statusMessage && (
        <div className="mobile-status-pill lg:hidden">
          <p className="font-mono text-[12px] text-white/90 whitespace-nowrap">{statusMessage}</p>
        </div>
      )}
    </>
  );
}
