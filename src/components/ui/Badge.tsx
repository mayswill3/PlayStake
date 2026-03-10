import { type ComponentProps } from 'react';

const variantStyles = {
  success: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/25',
  warning: 'bg-warning-400/15 text-warning-400 border-warning-400/25',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  neutral: 'bg-surface-500/15 text-surface-400 border-surface-500/25',
} as const;

interface BadgeProps extends ComponentProps<'span'> {
  variant?: keyof typeof variantStyles;
}

export function Badge({ variant = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full border px-2.5 py-0.5
        text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Map common bet/transaction statuses to badge variants.
 */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    SETTLED: { variant: 'success', label: 'Settled' },
    COMPLETED: { variant: 'success', label: 'Completed' },
    WON: { variant: 'success', label: 'Won' },
    LOST: { variant: 'danger', label: 'Lost' },
    CANCELLED: { variant: 'neutral', label: 'Cancelled' },
    PENDING: { variant: 'warning', label: 'Pending' },
    PENDING_CONSENT: { variant: 'warning', label: 'Pending Consent' },
    OPEN: { variant: 'info', label: 'Open' },
    MATCHED: { variant: 'info', label: 'Matched' },
    RESULT_REPORTED: { variant: 'warning', label: 'Result Reported' },
    DISPUTED: { variant: 'danger', label: 'Disputed' },
    FAILED: { variant: 'danger', label: 'Failed' },
    DRAW: { variant: 'neutral', label: 'Draw' },
    ACTIVE: { variant: 'success', label: 'Active' },
    REVOKED: { variant: 'danger', label: 'Revoked' },
  };

  const entry = map[status] || { variant: 'neutral' as const, label: status };

  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
