'use client';

import { Clock } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';

interface LobbyExpiryBarProps {
  expiresAt: string | null;
  onLeave: () => void;
  isLeaving?: boolean;
}

export function LobbyExpiryBar({ expiresAt, onLeave, isLeaving }: LobbyExpiryBarProps) {
  const { label, secondsLeft } = useCountdown(expiresAt);
  const isUrgent = secondsLeft > 0 && secondsLeft <= 120;

  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs">
      <div className="flex items-center gap-1.5 text-fg-muted font-mono">
        <Clock size={12} />
        <span>Lobby expires in</span>
        <span
          className={`tabular-nums font-semibold ${
            isUrgent ? 'text-danger-400' : 'text-fg-secondary'
          }`}
          aria-live="polite"
        >
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={onLeave}
        disabled={isLeaving}
        className="font-mono text-xs text-fg-muted hover:text-danger-400 transition-colors disabled:opacity-50"
      >
        {isLeaving ? 'Leaving…' : 'Cancel & Leave'}
      </button>
    </div>
  );
}
