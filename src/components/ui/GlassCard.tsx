import { type ComponentProps } from 'react';

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

interface GlassCardProps extends ComponentProps<'div'> {
  /** Optional neon border accent colour. False = subtle border. */
  neon?: 'green' | 'cyan' | false;
  padding?: keyof typeof paddingStyles;
}

export function GlassCard({
  neon = false,
  padding = 'md',
  className = '',
  children,
  style,
  ...props
}: GlassCardProps) {
  const borderColor =
    neon === 'green'
      ? 'var(--glass-border-neon)'
      : neon === 'cyan'
      ? 'var(--glass-border-cyan)'
      : 'var(--glass-border)';

  return (
    <div
      className={`rounded-2xl ${paddingStyles[padding]} ${className}`}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur, 0px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 0px))',
        border: `1px solid ${borderColor}`,
        boxShadow: 'var(--glass-shadow)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
