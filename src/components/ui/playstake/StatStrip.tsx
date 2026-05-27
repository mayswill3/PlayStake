/**
 * StatStrip — horizontal layout of large numeric stats with lime values.
 * Desktop: horizontal row. Mobile: stacked grid.
 *
 * @example
 * ```tsx
 * <StatStrip
 *   stats={[
 *     { value: '$200K+', label: 'Total Paid Out', caption: 'Since launch' },
 *     { value: '5,000+', label: 'Active Players' },
 *     { value: '99.2%', label: 'Settlement Rate', caption: 'Verified' },
 *   ]}
 * />
 * ```
 */

interface StatItem {
  /** Formatted numeric value (e.g. "$200K+", "99.2%"). */
  value: string;
  /** Primary label text. */
  label: string;
  /** Optional secondary description. */
  caption?: string;
}

interface StatStripProps {
  /** Array of stat items (max 4 recommended). */
  stats: StatItem[];
  /** Additional Tailwind classes. */
  className?: string;
}

export function StatStrip({ stats, className = '' }: StatStripProps) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} ${className}`}
    >
      {stats.map((stat, i) => (
        <div
          key={i}
          className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-6 text-center dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
        >
          <div className="font-display text-3xl font-bold leading-none tracking-tight text-ps-lime tabular-nums lg:text-4xl">
            {stat.value}
          </div>
          {stat.label && (
            <div className="mt-2 text-base font-semibold text-ps-text dark:text-ps-text-on-dark">
              {stat.label}
            </div>
          )}
          {stat.caption && (
            <div className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
              {stat.caption}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
