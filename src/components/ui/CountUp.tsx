'use client';

import { useState, useEffect, useRef } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatFn?: (n: number) => string;
  className?: string;
}

export function CountUp({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  formatFn,
  className = '',
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;

    if (from === to) {
      setDisplay(to);
      return;
    }

    startRef.current = null;

    function animate(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setDisplay(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(to);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = formatFn ? formatFn(display) : String(display);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
