'use client';

import { useEffect, useRef } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import type { LogEntry } from '@/app/play/_shared/types';

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-brand-600 dark:text-brand-400',
  error: 'text-danger-500',
  bet: 'text-purple-600 dark:text-purple-400',
};

interface CollapsibleEventLogProps {
  events: LogEntry[];
}

export function CollapsibleEventLog({ events }: CollapsibleEventLogProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const prevCount = useRef(events.length);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-open on first event
  useEffect(() => {
    if (events.length > 0 && prevCount.current === 0 && ref.current) {
      ref.current.open = true;
    }
    prevCount.current = events.length;
  }, [events.length]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <details
      ref={ref}
      className="group rounded-xl border border-themed bg-card overflow-hidden"
    >
      <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-elevated transition-colors list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-fg-muted" />
          <span className="text-sm font-semibold text-fg">Event Log</span>
          {events.length > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
              {events.length}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className="text-fg-muted transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-themed px-5 py-4">
        {events.length === 0 ? (
          <p className="text-sm text-fg-muted text-center py-4">
            No events yet — select a role to get started
          </p>
        ) : (
          <div
            ref={listRef}
            className="font-mono text-xs max-h-48 overflow-y-auto space-y-1"
          >
            {events.map((entry, i) => (
              <p key={i} className={LEVEL_COLORS[entry.level]}>
                <span className="text-fg-muted">[{entry.timestamp}]</span>{' '}
                {entry.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
