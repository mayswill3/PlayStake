/**
 * IconTile — circular icon container with lime radial-gradient background.
 * Decorative display element for feature icons and step indicators.
 *
 * @example
 * ```tsx
 * import { Shield } from 'lucide-react';
 * <IconTile icon={<Shield />} />
 * <IconTile icon={<Shield />} size="lg" />
 * <IconTile icon={<Shield />} size="sm" className="mr-3" />
 * ```
 */

import { type ReactNode } from 'react';

interface IconTileProps {
  /** Lucide or custom SVG icon. */
  icon: ReactNode;
  /** Tile size: sm=48px, md=56px, lg=72px. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional Tailwind classes. */
  className?: string;
}

const SIZE_MAP = {
  sm: { outer: 48, icon: 20 },
  md: { outer: 56, icon: 24 },
  lg: { outer: 72, icon: 32 },
} as const;

export function IconTile({ icon, size = 'md', className = '' }: IconTileProps) {
  const { outer, icon: iconSize } = SIZE_MAP[size];

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: outer,
        height: outer,
        background: 'var(--ps-gradient-icon-tile)',
        border: '1px solid var(--ps-lime-20)',
      }}
      aria-hidden="true"
    >
      <div
        className="text-ps-text dark:text-ps-text-on-dark"
        style={{ width: iconSize, height: iconSize }}
      >
        {icon}
      </div>
    </div>
  );
}
