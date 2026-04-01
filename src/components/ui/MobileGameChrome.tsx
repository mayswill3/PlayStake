'use client';

import { ArrowLeft, Volume2, VolumeX, Zap } from 'lucide-react';

interface MobileGameChromeProps {
  /** Zone A */
  onExit: () => void;
  statusText: string;
  statusColor?: string;
  isMuted: boolean;
  onSoundToggle: () => void;
  onFABTap: () => void;
  /** Zone B — the canvas and its relative container */
  children: React.ReactNode;
  /** Zone C — game-specific scoreboard content */
  scoreboard: React.ReactNode;
}

export function MobileGameChrome({
  onExit,
  statusText,
  statusColor = 'text-text-muted',
  isMuted,
  onSoundToggle,
  onFABTap,
  children,
  scoreboard,
}: MobileGameChromeProps) {
  return (
    <>
      {/* Zone A: Top bar */}
      <div className="mobile-zone-a lg:hidden">
        {/* Left: Exit */}
        <button
          onClick={onExit}
          className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90 transition-transform"
          aria-label="Exit game"
        >
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </button>

        {/* Center: Status */}
        <p
          className={`font-mono text-[11px] uppercase tracking-widest ${statusColor}`}
        >
          {statusText}
        </p>

        {/* Right: Sound + FAB */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSoundToggle}
            className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90 transition-transform"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="h-[18px] w-[18px] text-text-secondary" />
            ) : (
              <Volume2 className="h-[18px] w-[18px] text-text-secondary" />
            )}
          </button>
          <button
            onClick={onFABTap}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-400/15 active:scale-90 transition-transform"
            aria-label="PlayStake menu"
          >
            <Zap className="h-[18px] w-[18px] text-brand-400" />
          </button>
        </div>
      </div>

      {/* Zone B: Canvas (rendered by parent) */}
      {children}

      {/* Zone C: Scoreboard */}
      <div className="mobile-zone-c lg:hidden">{scoreboard}</div>
    </>
  );
}
