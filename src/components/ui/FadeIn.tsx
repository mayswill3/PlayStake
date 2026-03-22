'use client';

import { type ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <div
      className={`motion-safe:animate-[slide-up-fade_300ms_ease-out_both] ${className}`}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
