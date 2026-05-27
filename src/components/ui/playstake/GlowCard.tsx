/**
 * GlowCard — white surface card with gradient lime-to-cyan border and soft glow.
 * Use on light (paper) backgrounds.
 *
 * @example
 * ```tsx
 * <GlowCard>Feature content here</GlowCard>
 * <GlowCard glow="medium" padding="lg" as="article">Rich content</GlowCard>
 * <GlowCard glow="none" padding="sm">Subtle card</GlowCard>
 * ```
 */

import { type ReactNode } from 'react';

interface GlowCardProps {
  /** Glow intensity. */
  glow?: 'subtle' | 'medium' | 'none';
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
  subtle: 'shadow-ps-glow-sm hover:shadow-ps-glow',
  medium: 'shadow-ps-glow hover:shadow-ps-glow-lg',
  none: 'shadow-ps-shadow-md',
} as const;

export function GlowCard({
  glow = 'subtle',
  padding = 'md',
  as: Tag = 'div',
  children,
  className = '',
}: GlowCardProps) {
  const canHover = glow !== 'none';

  return (
    <Tag
      className={[
        'ps-gradient-border-mask-light rounded-[var(--ps-radius-lg)]',
        PADDING_MAP[padding],
        SHADOW_MAP[glow],
        canHover
          ? 'transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}
