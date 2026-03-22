'use client';

import { Button } from '@/components/ui/Button';
import {
  ChevronDown,
  Shield,
  Swords,
  Trophy,
  Clock,
  CheckCircle2,
  CircleDollarSign,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export type WidgetState =
  | 'PENDING_CONSENT'
  | 'OPEN'
  | 'MATCHED'
  | 'RESULT_REPORTED'
  | 'SETTLED';

const STATES: WidgetState[] = [
  'PENDING_CONSENT',
  'OPEN',
  'MATCHED',
  'RESULT_REPORTED',
  'SETTLED',
];

const STATE_META: Record<
  WidgetState,
  { label: string; color: string; bgColor: string; icon: typeof Shield; description: string }
> = {
  PENDING_CONSENT: {
    label: 'Pending Consent',
    color: 'text-warning-400',
    bgColor: 'bg-warning-400/10',
    icon: Shield,
    description: 'Waiting for the player to accept the wager terms.',
  },
  OPEN: {
    label: 'Open',
    color: 'text-brand-400',
    bgColor: 'bg-brand-400/10',
    icon: Clock,
    description: 'Wager is open and waiting for a match.',
  },
  MATCHED: {
    label: 'Matched',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    icon: Swords,
    description: 'Wager has been matched. Game is in progress.',
  },
  RESULT_REPORTED: {
    label: 'Result Reported',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    icon: Trophy,
    description: 'Game result has been submitted. Awaiting settlement.',
  },
  SETTLED: {
    label: 'Settled',
    color: 'text-success-400',
    bgColor: 'bg-success-400/10',
    icon: CheckCircle2,
    description: 'Wager has been settled. Payout complete.',
  },
};

const NEXT_STATE: Record<WidgetState, WidgetState | null> = {
  PENDING_CONSENT: 'OPEN',
  OPEN: 'MATCHED',
  MATCHED: 'RESULT_REPORTED',
  RESULT_REPORTED: 'SETTLED',
  SETTLED: null,
};

const ACTION_LABEL: Record<WidgetState, string> = {
  PENDING_CONSENT: 'Accept Wager',
  OPEN: 'Find Match',
  MATCHED: 'Report Result',
  RESULT_REPORTED: 'Settle',
  SETTLED: 'Reset Demo',
};

interface PreviewPanelProps {
  widgetState: WidgetState;
  onStateChange: (state: WidgetState) => void;
  className?: string;
}

export function PreviewPanel({ widgetState, onStateChange, className = '' }: PreviewPanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const meta = STATE_META[widgetState];
  const StateIcon = meta.icon;
  const stateIndex = STATES.indexOf(widgetState);

  function handleAction() {
    const next = NEXT_STATE[widgetState];
    if (next) {
      onStateChange(next);
    } else {
      onStateChange('PENDING_CONSENT');
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with state selector */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
          Live Preview
        </span>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-white/8 bg-surface-850 text-xs font-mono text-text-secondary hover:text-text-primary hover:border-white/16 transition-colors"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.color.replace('text-', 'bg-')}`} />
            {meta.label}
            <ChevronDown className="h-3 w-3 text-text-muted" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-sm border border-white/8 bg-surface-900 shadow-xl z-20">
              {STATES.map((state) => {
                const s = STATE_META[state];
                return (
                  <button
                    key={state}
                    onClick={() => {
                      onStateChange(state);
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-left
                      transition-colors hover:bg-surface-800
                      ${widgetState === state ? 'text-text-primary bg-surface-850' : 'text-text-secondary'}
                    `}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.color.replace('text-', 'bg-')}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mock game frame */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface-950/50">
        {/* Fake game area */}
        <div className="w-full max-w-sm">
          <div className="rounded-sm border border-white/8 bg-surface-900 overflow-hidden">
            {/* Game header */}
            <div className="border-b border-white/8 bg-surface-850 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-brand-400" />
                <span className="text-sm font-display font-semibold text-text-primary">
                  PlayStake Widget
                </span>
              </div>
              <span className="text-xs font-mono text-text-muted">$5.00 wager</span>
            </div>

            {/* State progress bar */}
            <div className="px-4 pt-4">
              <div className="flex items-center gap-1">
                {STATES.map((state, i) => (
                  <div key={state} className="flex-1 flex items-center">
                    <div
                      className={`
                        h-1 w-full rounded-full transition-colors duration-300
                        ${i <= stateIndex ? meta.color.replace('text-', 'bg-') : 'bg-surface-800'}
                      `}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-mono text-text-muted">Start</span>
                <span className="text-[10px] font-mono text-text-muted">Settled</span>
              </div>
            </div>

            {/* State content */}
            <div className="p-4">
              <div className={`rounded-sm ${meta.bgColor} p-4 flex flex-col items-center gap-3`}>
                <StateIcon className={`h-8 w-8 ${meta.color}`} />
                <div className="text-center">
                  <p className={`text-sm font-display font-semibold ${meta.color}`}>{meta.label}</p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{meta.description}</p>
                </div>
              </div>
            </div>

            {/* Widget details */}
            <div className="px-4 pb-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex justify-between px-2 py-1.5 rounded-sm bg-surface-850">
                  <span className="text-text-muted">Bet ID</span>
                  <span className="text-text-secondary">#a7f3d</span>
                </div>
                <div className="flex justify-between px-2 py-1.5 rounded-sm bg-surface-850">
                  <span className="text-text-muted">Player</span>
                  <span className="text-text-secondary">p-123</span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="p-4 pt-2">
              <Button
                variant={widgetState === 'SETTLED' ? 'secondary' : 'primary'}
                size="sm"
                className="w-full"
                onClick={handleAction}
              >
                {ACTION_LABEL[widgetState]}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
