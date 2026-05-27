/**
 * StatusPill — compact status indicator with pulsing dot and uppercase label.
 * Used in match headers, lobby cards, and transaction rows.
 *
 * @example
 * ```tsx
 * <StatusPill status="live" />
 * <StatusPill status="waiting" />
 * <StatusPill status="completed" />
 * <StatusPill status="disputed" />
 * <StatusPill status="settled" label="PAID" />
 * <StatusPill status="expired" />
 * ```
 */

type Status = 'live' | 'waiting' | 'completed' | 'disputed' | 'settled' | 'expired';

interface StatusPillProps {
  /** Determines dot color, animation, and default label text. */
  status: Status;
  /** Override the displayed text. */
  label?: string;
  /** Additional Tailwind classes. */
  className?: string;
}

const STATUS_CONFIG: Record<Status, { dotColor: string; defaultLabel: string; pulse: boolean }> = {
  live: { dotColor: 'var(--ps-lime)', defaultLabel: 'LIVE', pulse: true },
  waiting: { dotColor: 'var(--ps-warning)', defaultLabel: 'WAITING', pulse: true },
  completed: { dotColor: 'var(--ps-success)', defaultLabel: 'COMPLETED', pulse: false },
  disputed: { dotColor: 'var(--ps-error)', defaultLabel: 'DISPUTED', pulse: false },
  settled: { dotColor: 'var(--ps-cyan)', defaultLabel: 'SETTLED', pulse: false },
  expired: { dotColor: 'var(--ps-muted-on-dark)', defaultLabel: 'EXPIRED', pulse: false },
};

export function StatusPill({ status, label, className = '' }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-ps-ink ${className}`}
      style={{ padding: '4px 12px 4px 8px' }}
    >
      {/* Status dot */}
      <span
        className={`shrink-0 rounded-full ${config.pulse ? 'ps-pulse-dot' : ''}`}
        style={{
          width: 6,
          height: 6,
          marginRight: 8,
          backgroundColor: config.dotColor,
        }}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold uppercase tracking-[0.08em] leading-none text-white">
        {displayLabel}
      </span>
    </span>
  );
}
