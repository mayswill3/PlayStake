import { type ComponentProps } from 'react';

interface CardProps extends ComponentProps<'div'> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

export function Card({ padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        rounded-sm border border-white/8 bg-surface-900
        ${paddingStyles[padding]}
        ${className}
      `}
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
    <h3 className={`text-lg font-display font-semibold text-text-primary ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }: ComponentProps<'p'>) {
  return (
    <p className={`text-sm text-text-secondary ${className}`} {...props}>
      {children}
    </p>
  );
}
