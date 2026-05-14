import { type ComponentProps, type CSSProperties } from 'react';

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

interface CardProps extends ComponentProps<'div'> {
  padding?: keyof typeof paddingStyles;
  /**
   * glass: glassmorphism variant for always-dark esports surfaces.
   * Uses --glass-* tokens. Optional `neon` prop activates the neon border.
   */
  variant?: 'default' | 'glass';
  neon?: 'green' | 'cyan' | false;
}

export function Card({
  padding = 'md',
  variant = 'default',
  neon = false,
  className = '',
  children,
  style,
  ...props
}: CardProps) {
  const glassStyle: CSSProperties =
    variant === 'glass'
      ? {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${
            neon === 'green'
              ? 'var(--glass-border-neon)'
              : neon === 'cyan'
              ? 'var(--glass-border-cyan)'
              : 'var(--glass-border)'
          }`,
          boxShadow: 'var(--glass-shadow)',
        }
      : {};

  return (
    <div
      className={`
        rounded-xl
        ${variant === 'default' ? 'border border-themed bg-card' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
      style={{ ...glassStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }: ComponentProps<'h3'>) {
  return (
    <h3 className={`text-lg font-display font-semibold text-fg ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }: ComponentProps<'p'>) {
  return (
    <p className={`text-sm text-fg-secondary ${className}`} {...props}>
      {children}
    </p>
  );
}
