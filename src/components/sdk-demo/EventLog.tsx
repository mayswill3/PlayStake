'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Trash2, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

const TYPE_STYLES: Record<
  LogEntry['type'],
  { color: string; bgColor: string; icon: typeof Info }
> = {
  info: { color: 'text-blue-400', bgColor: 'bg-blue-400/10', icon: Info },
  success: { color: 'text-success-400', bgColor: 'bg-success-400/10', icon: CheckCircle2 },
  warning: { color: 'text-warning-400', bgColor: 'bg-warning-400/10', icon: AlertTriangle },
  error: { color: 'text-danger-400', bgColor: 'bg-danger-400/10', icon: XCircle },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface EventLogProps {
  entries: LogEntry[];
  onClear: () => void;
  className?: string;
}

export function EventLog({ entries, onClear, className = '' }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
            Event Log
          </span>
          {entries.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-sm bg-surface-800 text-text-muted">
              {entries.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="px-2 py-1">
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Clear log</span>
        </Button>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Info className="h-8 w-8 text-text-muted mb-3" />
            <p className="text-sm font-mono text-text-muted">No events yet</p>
            <p className="text-xs text-text-muted mt-1">
              Interact with the preview to generate events.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            {entries.map((entry) => {
              const style = TYPE_STYLES[entry.type];
              const Icon = style.icon;
              return (
                <div
                  key={entry.id}
                  className="px-3 py-2.5 hover:bg-surface-850/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 p-1 rounded-sm ${style.bgColor}`}>
                      <Icon className={`h-3 w-3 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-text-primary truncate">
                          {entry.message}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted whitespace-nowrap shrink-0">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      {entry.data && (
                        <pre className="mt-1 text-[10px] font-mono text-text-muted leading-relaxed overflow-x-auto">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
