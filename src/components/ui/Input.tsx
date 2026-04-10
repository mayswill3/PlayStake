'use client';

import { type ComponentProps, forwardRef, useId } from 'react';

interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, suffix, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-fg-secondary">
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: error ? '#ff3b5c' : 'var(--border)',
              color: 'var(--fg)',
            }}
            className={`
              block w-full rounded-lg border
              transition-colors duration-150
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${prefix ? 'pl-9' : 'pl-3'}
              ${suffix ? 'pr-9' : 'pr-3'}
              py-2.5 text-sm
              ${className}
            `}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {suffix && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-fg-secondary">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
