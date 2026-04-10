'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

interface StatProps {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  format?: (n: number) => string;
}

const STATS: StatProps[] = [
  {
    value: 200000,
    prefix: '$',
    suffix: '+',
    label: 'Total paid out',
    format: (n) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n),
  },
  {
    value: 12000,
    suffix: '+',
    label: 'Bets settled',
    format: (n) => n.toLocaleString('en-US'),
  },
  {
    value: 99.2,
    suffix: '%',
    label: 'Settlement rate',
    format: (n) => n.toFixed(1),
  },
];

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 max-w-5xl mx-auto">
          {STATS.map((stat, i) => (
            <StatCard key={i} {...stat} trigger={visible} className={i === 2 ? 'col-span-2 lg:col-span-1' : ''} />
          ))}
        </div>

        {/* Trust statement */}
        <p className="mt-12 lg:mt-16 text-center text-lg text-fg-secondary max-w-3xl mx-auto">
          Every bet is backed by secure escrow, dual-source result verification, and a double-entry financial ledger. No ifs.
        </p>

        {/* Trust badges */}
        <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <ShieldCheck size={18} className="text-brand-600" />
            <span className="font-medium">SSL secured</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Lock size={18} className="text-brand-600" />
            <span className="font-medium">Funds in escrow</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StatCardProps extends StatProps {
  trigger: boolean;
  className?: string;
}

function StatCard({ value, prefix, suffix, label, format, trigger, className = '' }: StatCardProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCurrent(value);
      return;
    }
    const duration = 1500;
    const start = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(value * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [trigger, value]);

  const display = format ? format(current) : String(Math.round(current));

  return (
    <div className={`rounded-2xl border border-themed bg-elevated p-6 lg:p-8 text-center ${className}`}>
      <div className="font-display text-4xl lg:text-5xl font-bold text-fg tabular-nums">
        {prefix}
        {display}
        {suffix}
      </div>
      <div className="mt-2 text-sm text-fg-secondary font-medium">{label}</div>
    </div>
  );
}
