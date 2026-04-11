'use client';

import { Spinner } from '@/components/ui/Spinner';

const STAKE_OPTIONS_CENTS = [100, 500, 1000, 2500];

interface StakePickerProps {
  value: number;
  onChange: (cents: number) => void;
  onJoin: () => void;
  isJoining?: boolean;
  role: 'PLAYER_A' | 'PLAYER_B';
}

function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars.toFixed(dollars % 1 === 0 ? 0 : 2);
}

export function StakePicker({ value, onChange, onJoin, isJoining, role }: StakePickerProps) {
  return (
    <div className="rounded-xl border border-themed bg-elevated p-4">
      <h3 className="text-[11px] font-semibold text-fg-muted uppercase tracking-widest mb-2">
        {role === 'PLAYER_A' ? 'Your wager' : 'Match any wager'}
      </h3>

      {role === 'PLAYER_A' ? (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {STAKE_OPTIONS_CENTS.map((cents) => {
              const selected = value === cents;
              return (
                <button
                  key={cents}
                  type="button"
                  onClick={() => onChange(cents)}
                  aria-pressed={selected}
                  className={`
                    rounded-lg border py-2 text-sm font-semibold tabular-nums transition-colors
                    ${selected
                      ? 'border-brand-600 bg-brand-600/10 text-brand-600 dark:text-brand-400'
                      : 'border-themed bg-card text-fg-secondary hover:border-brand-600/40 hover:text-fg'
                    }
                  `}
                >
                  ${formatUsd(cents)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-fg-muted mb-3">
            Both players lock the same amount. Winner takes the pot.
          </p>
        </>
      ) : (
        <p className="text-xs text-fg-secondary mb-3">
          You&apos;ll see the exact stake on the invite card before accepting.
        </p>
      )}

      <button
        type="button"
        onClick={onJoin}
        disabled={isJoining}
        className="
          w-full inline-flex items-center justify-center gap-2
          rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
          hover:bg-brand-700 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {isJoining ? (
          <>
            <Spinner size="sm" />
            <span>Joining lobby…</span>
          </>
        ) : (
          <span>Join Lobby</span>
        )}
      </button>
    </div>
  );
}
