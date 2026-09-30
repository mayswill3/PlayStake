'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getSessionStart } from './SessionReminder';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * The time now and how long this session has run, always on screen while
 * games are played (RTS 13A). Session time counts from when this browser tab
 * session began, the same start the session reminder uses.
 */
export function SessionClock() {
  const [now, setNow] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);

  useEffect(() => {
    setStart(getSessionStart());
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Rendered after mount only, so server and client markup agree.
  if (now === null || start === null) return null;

  const time = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ps-border-light)] px-2.5 py-1 font-mono text-xs tabular-nums text-ps-muted dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark"
      aria-label={`Time ${time}. Session length ${formatDuration(now - start)}`}
      title="Current time · how long you've been playing this session"
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{time}</span>
      <span aria-hidden="true">·</span>
      <span>{formatDuration(now - start)}</span>
    </div>
  );
}
