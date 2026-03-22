'use client';

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import type { LogEntry } from './types';

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-blue-400',
  success: 'text-brand-400',
  error: 'text-danger-400',
  bet: 'text-purple-400',
};

interface EventLogProps {
  entries: LogEntry[];
}

export function EventLog({ entries }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <Card padding="sm">
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-2">
        Event Log
      </p>
      <div
        ref={scrollRef}
        className="font-mono text-xs max-h-[200px] overflow-y-auto space-y-0.5"
      >
        {entries.length === 0 && (
          <p className="text-text-muted">No events yet</p>
        )}
        {entries.map((entry, i) => (
          <p key={i} className={LEVEL_COLORS[entry.level]}>
            <span className="text-text-muted">[{entry.timestamp}]</span>{' '}
            {entry.message}
          </p>
        ))}
      </div>
    </Card>
  );
}
