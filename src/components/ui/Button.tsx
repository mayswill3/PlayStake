'use client';

import { type ComponentProps, forwardRef } from 'react';
import { Spinner } from './Spinner';

const variantStyles = {
  primary:
    'bg-brand-400 text-surface-950 hover:bg-brand-500 focus-visible:ring-brand-400',
  secondary:
    'bg-surface-700 text-surface-100 hover:bg-surface-600 focus-visible:ring-surface-500',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 focus-visible:ring-danger-500',
  ghost:
    'bg-transparent text-surface-300 hover:text-surface-100 hover:bg-surface-800 focus-visible:ring-surface-500',
  /**
   * landing-primary: for use on the always-dark landing surface.
   * Bright neon green fill with glow on hover; meets 4.5:1 contrast
   * against surface-950 (#0a0a0f) background.
   */
  'landing-primary':
    'bg-brand-500 text-surface-950 hover:bg-brand-400 btn-glow-hover focus-visible:ring-brand-400',
  /**
   * landing-ghost: neon green outline button for secondary landing CTAs.
   */
  'landing-ghost':
    'border border-brand-500/30 text-brand-400 hover:border-brand-500/60 hover:text-brand-300 focus-visible:ring-brand-400',
} as const;

/** Minimum 44px touch target on all sizes (WCAG 2.5.5 AA). */
const sizeStyles = {
  sm: 'px-3 min-h-[36px] text-sm',
  md: 'px-4 min-h-[44px] text-sm',
  lg: 'px-6 min-h-[44px] text-base',
} as const;

interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 rounded-sm
          font-display uppercase tracking-wider font-semibold
          transition-all duration-150
          active:scale-[0.97]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
