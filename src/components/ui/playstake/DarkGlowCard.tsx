/**
 * DarkGlowCard — ink-surface card with gradient border and pronounced glow.
 * Use on dark (ink) backgrounds or force-dark sections.
 *
 * @example
 * ```tsx
 * <DarkGlowCard>Hero content</DarkGlowCard>
 * <DarkGlowCard glow="strong" padding="lg" as="section">Featured</DarkGlowCard>
 * ```
 */

import { type ReactNode } from 'react';

interface DarkGlowCardProps {
  /** Glow intensity. */
  glow?: 'standard' | 'strong';
  /** Inner padding: sm=16px, md=24px, lg=32px. */
  padding?: 'sm' | 'md' | 'lg';
  /** Semantic HTML element. */
  as?: 'div' | 'article' | 'section';
  /** Card content. */
  children: ReactNode;
  /** Additional Tailwind classes. */
  className?: string;
}

const PADDING_MAP = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

const SHADOW_MAP = {
  standard: 'shadow-ps-glow hover:shadow-ps-glow-lg',
  strong: 'shadow-ps-glow-lg',
} as const;

export function DarkGlowCard({
  glow = 'standard',
  padding = 'md',
  as: Tag = 'div',
  children,
  className = '',
}: DarkGlowCardProps) {
  return (
    <Tag
      className={[
        'ps-gradient-border-mask rounded-[var(--ps-radius-lg)]',
        PADDING_MAP[padding],
        SHADOW_MAP[glow],
        'transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  );
}
