/**
 * EyebrowPill — section label pill with lime dot and uppercase text.
 *
 * @example
 * ```tsx
 * <EyebrowPill label="THE OPPORTUNITY" />
 * <EyebrowPill label="HOW IT WORKS" className="mb-3" />
 * ```
 */

interface EyebrowPillProps {
  /** Section label text (rendered uppercase via CSS). */
  label: string;
  /** Additional Tailwind classes. */
  className?: string;
}

export function EyebrowPill({ label, className = '' }: EyebrowPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ps-ink ${className}`}
      style={{ padding: '6px 14px 6px 10px' }}
    >
      {/* Lime dot */}
      <span
        className="shrink-0 rounded-full bg-ps-lime"
        style={{ width: 6, height: 6, marginRight: 8 }}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold uppercase tracking-[0.08em] leading-none text-white">
        {label}
      </span>
    </span>
  );
}
