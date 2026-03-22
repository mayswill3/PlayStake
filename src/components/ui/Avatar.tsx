import { getInitials } from '@/lib/utils/format';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const;

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizeStyles[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        inline-flex items-center justify-center rounded-full
        bg-brand-400/20 text-brand-400 font-mono font-semibold
        ${sizeStyles[size]} ${className}
      `}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
