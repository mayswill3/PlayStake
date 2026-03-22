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
} as const;

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
} as const;

interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }, ref) => {
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
  }
);

Button.displayName = 'Button';
