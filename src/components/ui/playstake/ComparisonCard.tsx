/**
 * ComparisonCard — multi-column comparison table highlighting PlayStake advantages.
 * Three columns side by side on desktop, stacked on mobile.
 *
 * @example
 * ```tsx
 * <ComparisonCard
 *   columns={[
 *     {
 *       heading: 'Informal Wagers',
 *       items: [
 *         { label: 'Verified Results', included: false },
 *         { label: 'Escrow Protection', included: false },
 *         { label: 'Dispute Resolution', included: false },
 *       ],
 *     },
 *     {
 *       heading: 'Existing Platforms',
 *       items: [
 *         { label: 'Verified Results', included: false },
 *         { label: 'Escrow Protection', included: true },
 *         { label: 'Dispute Resolution', included: false },
 *       ],
 *     },
 *     {
 *       heading: 'PlayStake',
 *       highlighted: true,
 *       items: [
 *         { label: 'Verified Results', included: true },
 *         { label: 'Escrow Protection', included: true },
 *         { label: 'Dispute Resolution', included: true },
 *       ],
 *     },
 *   ]}
 * />
 * ```
 */

import { Check, X } from 'lucide-react';

interface ComparisonItem {
  /** Feature label. */
  label: string;
  /** Whether this feature is included. */
  included: boolean;
}

interface ComparisonColumn {
  /** Column heading (e.g. "PlayStake"). */
  heading: string;
  /** Feature rows. */
  items: ComparisonItem[];
  /** Whether this column gets visual emphasis (gradient border, lime checks). */
  highlighted?: boolean;
}

interface ComparisonCardProps {
  /** Column definitions. */
  columns: ComparisonColumn[];
  /** Additional Tailwind classes on the outer container. */
  className?: string;
}

export function ComparisonCard({ columns, className = '' }: ComparisonCardProps) {
  // Derive feature labels from the first column
  const featureLabels = columns[0]?.items.map((item) => item.label) ?? [];

  return (
    <div
      className={`overflow-hidden rounded-[var(--ps-radius-xl)] bg-ps-paper-elevated shadow-ps-shadow-md dark:bg-ps-ink-2 ${className}`}
    >
      {/* Desktop: table layout */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {/* Empty corner cell */}
              <th className="px-4 py-3" />
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] ${
                    col.highlighted
                      ? 'bg-[var(--ps-lime-10)] text-ps-lime'
                      : 'text-ps-muted dark:text-ps-muted-on-dark'
                  }`}
                >
                  {col.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureLabels.map((label, ri) => (
              <tr key={ri} className="border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                <td className="px-4 py-3 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
                  {label}
                </td>
                {columns.map((col, ci) => {
                  const item = col.items[ri];
                  return (
                    <td
                      key={ci}
                      className={`px-4 py-3 ${col.highlighted ? 'bg-[var(--ps-lime-10)]' : ''}`}
                    >
                      {item?.included ? (
                        <Check
                          size={18}
                          className={col.highlighted ? 'text-ps-lime' : 'text-ps-success'}
                          aria-label={`${label}: included`}
                        />
                      ) : (
                        <X
                          size={18}
                          className="text-ps-muted dark:text-ps-muted-on-dark"
                          aria-label={`${label}: not included`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards per feature row */}
      <div className="block sm:hidden">
        {featureLabels.map((label, ri) => (
          <div
            key={ri}
            className="border-b border-[var(--ps-border-light)] px-4 py-3 dark:border-[var(--ps-border-dark)]"
          >
            <div className="mb-2 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
              {label}
            </div>
            <div className="flex items-center gap-4">
              {columns.map((col, ci) => {
                const item = col.items[ri];
                return (
                  <div key={ci} className="flex items-center gap-1.5">
                    {item?.included ? (
                      <Check
                        size={14}
                        className={col.highlighted ? 'text-ps-lime' : 'text-ps-success'}
                      />
                    ) : (
                      <X size={14} className="text-ps-muted dark:text-ps-muted-on-dark" />
                    )}
                    <span
                      className={`text-xs ${
                        col.highlighted
                          ? 'font-semibold text-ps-lime'
                          : 'text-ps-muted dark:text-ps-muted-on-dark'
                      }`}
                    >
                      {col.heading}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
