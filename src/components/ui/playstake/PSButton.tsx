/**
 * PSButton — unified primary/secondary/danger/ghost button with loading state.
 * WCAG 2.5.5 AA: minimum 44px touch target on md size.
 *
 * @example
 * ```tsx
 * <PSButton>Join the Beta</PSButton>
 * <PSButton variant="secondary">Learn More</PSButton>
 * <PSButton variant="danger" size="sm">Delete</PSButton>
 * <PSButton variant="ghost" icon={<Settings size={16} />}>Settings</PSButton>
 * <PSButton loading>Processing...</PSButton>
 * <PSButton fullWidth>Full Width CTA</PSButton>
 * ```
 */

'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface PSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant. */
  variant?: Variant;
  /** Button height: sm=36px, md=44px, lg=48px. */
  size?: Size;
  /** Shows spinner and disables the button. */
  loading?: boolean;
  /** Leading icon (ReactNode). */
  icon?: ReactNode;
  /** Stretch to full container width. */
  fullWidth?: boolean;
  /** Button content. */
  children: ReactNode;
  /** Additional Tailwind classes. */
  className?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-[44px] px-6 text-sm',
  lg: 'min-h-12 px-8 text-base',
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: [
    'bg-ps-lime text-ps-text font-bold',
    'hover:bg-ps-lime-strong hover:shadow-ps-glow-lime hover:-translate-y-px',
    'active:scale-[0.98] active:shadow-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-lime)]',
  ].join(' '),
  secondary: [
    'bg-transparent text-ps-lime font-semibold',
    'border border-[var(--ps-lime-35)]',
    'hover:border-[var(--ps-lime)] hover:shadow-ps-glow-sm',
    'active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-lime)]',
  ].join(' '),
  danger: [
    'bg-ps-error text-white font-bold',
    'hover:brightness-110 hover:-translate-y-px',
    'active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-error)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-ps-muted dark:text-ps-muted-on-dark font-medium',
    'hover:bg-[var(--ps-border-light)] dark:hover:bg-[var(--ps-border-dark)]',
    'active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-blue)]',
  ].join(' '),
};

export function PSButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...rest
}: PSButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[var(--ps-radius-md)] font-display',
        'transition-[box-shadow,background-color,transform,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? 'w-full' : '',
        isDisabled ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        className,
      ].join(' ')}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner />
      ) : icon ? (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/** Simple rotating ring spinner. */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
