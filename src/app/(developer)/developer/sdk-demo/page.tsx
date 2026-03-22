'use client';

import { useState, useCallback } from 'react';
import { CodePanel } from '@/components/sdk-demo/CodePanel';
import { PreviewPanel, type WidgetState } from '@/components/sdk-demo/PreviewPanel';
import { EventLog, type LogEntry } from '@/components/sdk-demo/EventLog';
import { FadeIn } from '@/components/ui/FadeIn';
import { Card } from '@/components/ui/Card';
import { Code2, Eye, ScrollText } from 'lucide-react';

type MobileTab = 'code' | 'preview' | 'events';

const MOBILE_TABS: { id: MobileTab; label: string; icon: typeof Code2 }[] = [
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'events', label: 'Events', icon: ScrollText },
];

const STATE_EVENT_MAP: Record<WidgetState, { type: LogEntry['type']; message: string; data: Record<string, unknown> }> = {
  PENDING_CONSENT: {
    type: 'info',
    message: 'widget.init',
    data: { gameId: 'demo-game', userId: 'player-123', wagerAmountCents: 500 },
  },
  OPEN: {
    type: 'success',
    message: 'widget.consent',
    data: { accepted: true, timestamp: new Date().toISOString() },
  },
  MATCHED: {
    type: 'success',
    message: 'widget.matched',
    data: { betId: 'bet_a7f3d', opponentId: 'player-456', poolSizeCents: 1000 },
  },
  RESULT_REPORTED: {
    type: 'info',
    message: 'widget.resultReported',
    data: { outcome: 'WIN', score: 1200, betId: 'bet_a7f3d' },
  },
  SETTLED: {
    type: 'success',
    message: 'widget.settled',
    data: { payoutCents: 950, outcome: 'WIN', betId: 'bet_a7f3d' },
  },
};

export default function SDKDemoPage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview');
  const [widgetState, setWidgetState] = useState<WidgetState>('PENDING_CONSENT');
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => [
    {
      id: crypto.randomUUID(),
      type: 'info',
      message: 'widget.init',
      data: { gameId: 'demo-game', userId: 'player-123', wagerAmountCents: 500 },
      timestamp: new Date(),
    },
  ]);

  const addLogEntry = useCallback((type: LogEntry['type'], message: string, data?: Record<string, unknown>) => {
    setLogEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        message,
        data,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleStateChange = useCallback(
    (newState: WidgetState) => {
      const isReset = newState === 'PENDING_CONSENT' && widgetState === 'SETTLED';

      if (isReset) {
        addLogEntry('warning', 'widget.reset', { previousState: widgetState });
      }

      const event = STATE_EVENT_MAP[newState];
      addLogEntry(event.type, event.message, {
        ...event.data,
        timestamp: new Date().toISOString(),
      });

      setWidgetState(newState);
    },
    [widgetState, addLogEntry]
  );

  const handleClearLog = useCallback(() => {
    setLogEntries([]);
    addLogEntry('info', 'log.cleared', undefined);
  }, [addLogEntry]);

  return (
    <FadeIn>
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">SDK Demo</h1>
          <p className="text-sm font-mono text-text-muted mt-1">
            Interactive playground for the PlayStake widget integration
          </p>
        </div>

        {/* Mobile tab bar */}
        <div className="flex lg:hidden border-b border-white/8">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-mono
                  border-b-2 transition-colors duration-150
                  ${
                    mobileTab === tab.id
                      ? 'border-brand-400 text-brand-400'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }
                `}
                role="tab"
                aria-selected={mobileTab === tab.id}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.id === 'events' && logEntries.length > 0 && (
                  <span className="px-1 py-0.5 text-[9px] font-mono rounded-sm bg-surface-800 text-text-muted">
                    {logEntries.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop: 3-panel layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_380px_320px] gap-4" style={{ height: 'calc(100vh - 200px)' }}>
          <Card padding="none" className="overflow-hidden">
            <CodePanel />
          </Card>
          <Card padding="none" className="overflow-hidden">
            <PreviewPanel widgetState={widgetState} onStateChange={handleStateChange} />
          </Card>
          <Card padding="none" className="overflow-hidden">
            <EventLog entries={logEntries} onClear={handleClearLog} />
          </Card>
        </div>

        {/* Mobile: single panel based on active tab */}
        <div className="lg:hidden" style={{ height: 'calc(100vh - 240px)' }}>
          <Card padding="none" className="overflow-hidden h-full">
            {mobileTab === 'code' && <CodePanel />}
            {mobileTab === 'preview' && (
              <PreviewPanel widgetState={widgetState} onStateChange={handleStateChange} />
            )}
            {mobileTab === 'events' && (
              <EventLog entries={logEntries} onClear={handleClearLog} />
            )}
          </Card>
        </div>
      </div>
    </FadeIn>
  );
}
