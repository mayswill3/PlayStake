import { type ComponentProps } from 'react';

const variantStyles = {
  success: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/25',
  warning: 'bg-warning-400/15 text-warning-400 border-warning-400/25',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  neutral: 'bg-surface-500/15 text-surface-400 border-surface-500/25',
} as const;

type AnimationType = 'pulse' | 'breathe' | 'shake' | 'none';

interface BadgeProps extends ComponentProps<'span'> {
  variant?: keyof typeof variantStyles;
  animation?: AnimationType;
}

export function Badge({ variant = 'neutral', animation = 'none', className = '', children, ...props }: BadgeProps) {
  const animationClass =
    animation === 'pulse' ? 'motion-safe:animate-[pulse-dot_2s_ease-in-out_infinite]' :
    animation === 'breathe' ? 'motion-safe:animate-[breathe-border_3s_ease-in-out_infinite]' :
    animation === 'shake' ? 'motion-safe:animate-[shake_0.5s_ease-in-out_3]' :
    '';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-0.5
        font-mono text-[11px] uppercase tracking-widest
        ${variantStyles[variant]}
        ${animationClass}
        ${className}
      `}
      {...props}
    >
      {animation === 'pulse' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

/**
 * Map common bet/transaction statuses to badge variants with animations.
 */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string; animation: AnimationType }> = {
    SETTLED: { variant: 'success', label: 'Settled', animation: 'none' },
    COMPLETED: { variant: 'success', label: 'Completed', animation: 'none' },
    WON: { variant: 'success', label: 'Won', animation: 'none' },
    LOST: { variant: 'danger', label: 'Lost', animation: 'none' },
    CANCELLED: { variant: 'neutral', label: 'Cancelled', animation: 'none' },
    PENDING: { variant: 'warning', label: 'Pending', animation: 'pulse' },
    PENDING_CONSENT: { variant: 'warning', label: 'Pending Consent', animation: 'pulse' },
    OPEN: { variant: 'info', label: 'Open', animation: 'breathe' },
    MATCHED: { variant: 'info', label: 'Matched', animation: 'none' },
    RESULT_REPORTED: { variant: 'warning', label: 'Result Reported', animation: 'none' },
    DISPUTED: { variant: 'danger', label: 'Disputed', animation: 'shake' },
    FAILED: { variant: 'danger', label: 'Failed', animation: 'none' },
    DRAW: { variant: 'neutral', label: 'Draw', animation: 'none' },
    ACTIVE: { variant: 'success', label: 'Active', animation: 'none' },
    REVOKED: { variant: 'danger', label: 'Revoked', animation: 'none' },
  };

  const entry = map[status] || { variant: 'neutral' as const, label: status, animation: 'none' as const };

  return <Badge variant={entry.variant} animation={entry.animation}>{entry.label}</Badge>;
}
