'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { formatCents } from '@/lib/utils/format';

const SESSION_START_KEY = 'playstake:session-started-at';

interface Activity {
  betsPlaced: number;
  stakedCents: number;
  netCents: number;
}

/**
 * Start-of-session timestamp, held in sessionStorage so it resets per browser
 * tab session rather than persisting across days like localStorage would.
 */
function getSessionStart(): number {
  if (typeof window === 'undefined') return Date.now();

  const stored = window.sessionStorage.getItem(SESSION_START_KEY);
  const parsed = stored ? Number(stored) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const now = Date.now();
  window.sessionStorage.setItem(SESSION_START_KEY, String(now));
  return now;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours}h ${minutes}m`;
}

/**
 * Periodic play reminder.
 *
 * Shows elapsed session time alongside what the user has staked and won or
 * lost since they arrived — the money is the part that actually prompts a
 * decision. Interval comes from the user's own responsible-play settings;
 * rendering nothing when they have not enabled one.
 */
export function SessionReminder() {
  const router = useRouter();
  const [intervalMinutes, setIntervalMinutes] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activity, setActivity] = useState<Activity | null>(null);
  // Which reminder we are up to, so each threshold fires exactly once.
  const firedCount = useRef(0);

  useEffect(() => {
    fetch('/api/responsible-play', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setIntervalMinutes(data.sessionReminderMinutes ?? null);
      })
      .catch(() => {
        /* reminders are advisory; a failed fetch should not break the app */
      });
  }, []);

  const showReminder = useCallback(async (sessionStart: number) => {
    setElapsedMs(Date.now() - sessionStart);
    setOpen(true);

    try {
      const response = await fetch(
        `/api/responsible-play/session-activity?since=${new Date(sessionStart).toISOString()}`,
        { cache: 'no-store' },
      );
      if (response.ok) setActivity((await response.json()) as Activity);
    } catch {
      /* show the reminder without the money context rather than not at all */
    }
  }, []);

  useEffect(() => {
    if (!intervalMinutes) return;

    const sessionStart = getSessionStart();
    const intervalMs = intervalMinutes * 60_000;

    const tick = setInterval(() => {
      const elapsed = Date.now() - sessionStart;
      const due = Math.floor(elapsed / intervalMs);
      if (due > firedCount.current) {
        firedCount.current = due;
        void showReminder(sessionStart);
      }
    }, 15_000);

    return () => clearInterval(tick);
  }, [intervalMinutes, showReminder]);

  if (!intervalMinutes) return null;

  const net = activity?.netCents ?? 0;

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="You have been playing for a while"
      actions={
        <div className="flex flex-wrap gap-3">
          <PSButton onClick={() => setOpen(false)}>Keep playing</PSButton>
          <PSButton
            variant="secondary"
            onClick={() => {
              setOpen(false);
              router.push('/responsible-play');
            }}
          >
            Take a break
          </PSButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-ps-muted dark:text-ps-muted-on-dark">
          <Clock className="h-4 w-4" />
          <span>
            You have been in this session for{' '}
            <strong className="text-ps-text dark:text-ps-text-on-dark">
              {formatElapsed(elapsedMs)}
            </strong>
            .
          </span>
        </div>

        {activity && (
          <div className="rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] p-3">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                  Bets
                </dt>
                <dd className="font-mono tabular-nums">{activity.betsPlaced}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                  Staked
                </dt>
                <dd className="font-mono tabular-nums">
                  {formatCents(activity.stakedCents)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                  Net
                </dt>
                <dd
                  className={`font-mono tabular-nums ${
                    net > 0
                      ? 'text-ps-success'
                      : net < 0
                        ? 'text-ps-error'
                        : ''
                  }`}
                >
                  {net > 0 ? '+' : ''}
                  {formatCents(net)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-ps-muted dark:text-ps-muted-on-dark">
          Set your own deposit limits or take a break any time from{' '}
          <strong className="text-ps-text dark:text-ps-text-on-dark">
            Responsible Play
          </strong>
          .
        </p>
      </div>
    </Dialog>
  );
}
