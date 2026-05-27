/**
 * PhoneMockup — rebrand version with lime/cyan gradient glow and updated token colors.
 * Device frame showcasing the PlayStake mobile experience.
 *
 * @example
 * ```tsx
 * <PhoneMockup />
 * <PhoneMockup className="scale-90" />
 * ```
 *
 * Changes from original (`src/components/ui/PhoneMockup.tsx`):
 * - Outer glow: lime/cyan gradient via `--ps-glow-lg`
 * - Frame border: `--ps-ink-2` (was `#2a2a3e`)
 * - Reflection glow: `--ps-lime-20` (was hardcoded green)
 * - Placeholder gradients: `--ps-lime` -> `--ps-cyan` (was `#22c55e` -> `#06b6d4`)
 */

import { type ReactNode } from 'react';
import Image from 'next/image';

interface PhoneMockupProps {
  /** Screenshot src — renders placeholder UI when omitted. */
  src?: string;
  /** Alt text for screenshot. */
  alt?: string;
  /** Slot for custom screen content instead of src or placeholder. */
  children?: ReactNode;
  /** Additional Tailwind classes. */
  className?: string;
}

export function PhoneMockup({
  src,
  alt = 'PlayStake 1v1 challenge lobby',
  children,
  className = '',
}: PhoneMockupProps) {
  return (
    <div
      className={`relative mx-auto select-none ${className}`}
      style={{ width: 280, height: 572 }}
      aria-hidden="true"
    >
      {/* Ambient glow ring — lime/cyan gradient glow */}
      <div
        className="pointer-events-none absolute -inset-2 rounded-[48px] opacity-60"
        style={{ boxShadow: 'var(--ps-glow-lg)' }}
      />

      {/* Phone body */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[44px]"
        style={{
          background: 'var(--ps-ink-3)',
          border: '8px solid var(--ps-ink-2)',
          boxShadow:
            '0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Dynamic Island */}
        <div
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full"
          style={{ width: 88, height: 24, background: 'var(--ps-ink)' }}
        />

        {/* Screen area */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-ps-ink">
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="280px"
              className="object-cover object-top"
            />
          ) : children ? (
            children
          ) : (
            <PlaceholderScreen />
          )}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/20" />
      </div>

      {/* Reflection glow beneath */}
      <div
        className="pointer-events-none absolute -bottom-8 left-1/2 h-12 w-4/5 -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: 'var(--ps-lime-20)' }}
      />
    </div>
  );
}

/** Placeholder UI visible until a real screenshot is supplied. */
function PlaceholderScreen() {
  return (
    <div className="flex h-full w-full flex-col" style={{ paddingTop: 52 }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pb-2">
        <span className="font-mono text-[10px] tabular-nums text-white/35">9:41</span>
        <span className="font-mono text-[10px] text-white/35">●●●</span>
      </div>

      {/* Match card */}
      <div
        className="mx-3 overflow-hidden rounded-2xl"
        style={{
          background: 'var(--ps-lime-10)',
          border: '1px solid var(--ps-lime-35)',
        }}
      >
        <div className="px-4 pb-3 pt-4">
          <div
            className="mb-3 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--ps-lime)' }}
          >
            Live Match · Pool 8-Ball
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div
                className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: 'var(--ps-lime-20)' }}
              >
                <span className="text-[9px] font-extrabold" style={{ color: 'var(--ps-lime)' }}>
                  YOU
                </span>
              </div>
              <div className="text-sm font-bold tabular-nums text-white">3</div>
            </div>
            <div className="px-2 text-center">
              <div className="mb-1 text-[10px] font-semibold text-white/35">VS</div>
              <div
                className="h-1 w-8 rounded-full"
                style={{ background: 'var(--ps-gradient-brand-h)' }}
              />
            </div>
            <div className="text-center">
              <div
                className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              >
                <span className="text-[9px] font-extrabold text-white/40">OPP</span>
              </div>
              <div className="text-sm font-bold tabular-nums text-white">2</div>
            </div>
          </div>
        </div>
        {/* Progress fill */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full rounded-full animate-stake-fill"
            style={{
              width: '60%',
              background: 'var(--ps-gradient-brand-h)',
            }}
          />
        </div>
      </div>

      {/* Stake / Pot */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="mb-1 text-[9px] uppercase tracking-widest text-white/35">Your Stake</div>
          <div className="text-base font-bold tabular-nums text-white">$5.00</div>
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            background: 'var(--ps-lime-10)',
            border: '1px solid var(--ps-lime-35)',
          }}
        >
          <div
            className="mb-1 text-[9px] uppercase tracking-widest"
            style={{ color: 'var(--ps-lime)', opacity: 0.7 }}
          >
            Total Pot
          </div>
          <div className="text-base font-bold tabular-nums" style={{ color: 'var(--ps-lime)' }}>
            $10.00
          </div>
        </div>
      </div>

      {/* Timer */}
      <div
        className="mx-3 mt-3 flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <span className="text-[11px] uppercase tracking-wider text-white/35">Verified in</span>
        <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--ps-lime)' }}>
          00:45
        </span>
      </div>
    </div>
  );
}
