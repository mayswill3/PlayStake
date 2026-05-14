import { type ReactNode } from 'react';

interface StepCardProps {
  /** Two-digit step number string, e.g. "01" */
  number: string;
  /** Lucide icon element — render at size 20 */
  icon: ReactNode;
  title: string;
  description: string;
  /** Controls the neon top-bar and icon tint */
  accent?: 'green' | 'cyan';
  className?: string;
}

const ACCENT_STYLES = {
  green: {
    topBar: 'linear-gradient(90deg, #22c55e, #4ade80)',
    numBg: 'rgba(34,197,94,0.12)',
    /** text-brand-700 in light (4.7:1 on white), text-brand-400 in dark */
    numTextClass: 'text-brand-700 dark:text-brand-400',
    iconBg: 'rgba(34,197,94,0.10)',
    iconTextClass: 'text-brand-700 dark:text-brand-400',
  },
  cyan: {
    topBar: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
    numBg: 'rgba(6,182,212,0.12)',
    /** text-accent-700 in light (4.5:1 on white), text-accent-300 in dark */
    numTextClass: 'text-accent-700 dark:text-accent-300',
    iconBg: 'rgba(6,182,212,0.10)',
    iconTextClass: 'text-accent-700 dark:text-accent-300',
  },
} as const;

export function StepCard({
  number,
  icon,
  title,
  description,
  accent = 'green',
  className = '',
}: StepCardProps) {
  const s = ACCENT_STYLES[accent];

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden ${className}`}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur, 0px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 0px))',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      {/* Neon top bar */}
      <div className="h-0.5" style={{ background: s.topBar }} />

      <div className="flex flex-col flex-1 p-5">
        {/* Step number badge */}
        <div
          className={`inline-flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold tabular-nums ${s.numTextClass}`}
          style={{ background: s.numBg }}
        >
          {number}
        </div>

        {/* Icon */}
        <div
          className={`mt-4 flex h-10 w-10 items-center justify-center rounded-xl ${s.iconTextClass}`}
          style={{ background: s.iconBg }}
        >
          {icon}
        </div>

        {/* Title */}
        <h3 className="mt-4 font-display text-sm font-bold text-fg leading-snug">
          {title}
        </h3>

        {/* Description */}
        <p className="mt-1.5 text-xs text-fg-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
