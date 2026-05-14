import Image from 'next/image';

interface PhoneMockupProps {
  /**
   * TODO: Replace placeholder with a real screenshot once available.
   * Expected dimensions: 374 × 756 px (@1x), or 748 × 1512 px (@2x source).
   * Export as PNG with transparent background if possible.
   * Suggested path: /public/previews/lobby-preview.png
   */
  src?: string;
  alt?: string;
  className?: string;
}

export function PhoneMockup({
  src,
  alt = 'PlayStake 1v1 challenge lobby',
  className = '',
}: PhoneMockupProps) {
  return (
    <div
      className={`relative mx-auto select-none ${className}`}
      style={{ width: 280, height: 572 }}
      aria-hidden="true"
    >
      {/* Ambient glow ring */}
      <div
        className="pointer-events-none absolute -inset-2 rounded-[48px] opacity-50"
        style={{ boxShadow: 'var(--glow-brand-sm)' }}
      />

      {/* Phone body */}
      <div
        className="absolute inset-0 rounded-[44px] overflow-hidden"
        style={{
          background: '#1a1a2e',
          border: '8px solid #2a2a3e',
          boxShadow:
            '0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Dynamic Island */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full"
          style={{ width: 88, height: 24, background: '#0a0a0f' }}
        />

        {/* Screen area */}
        <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center overflow-hidden">
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="280px"
              className="object-cover object-top"
            />
          ) : (
            <PlaceholderScreen />
          )}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 h-1 w-24 rounded-full bg-white/20" />
      </div>

      {/* Reflection glow beneath */}
      <div
        className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 h-12 w-4/5 rounded-full blur-2xl"
        style={{ background: 'rgba(34,197,94,0.20)' }}
      />
    </div>
  );
}

/**
 * Placeholder UI visible until a real screenshot is supplied.
 * TODO: Replace this entire component with:
 * <Image src="/public/previews/lobby-preview.png" alt="..." fill sizes="280px" className="object-cover object-top" />
 * Expected PNG dimensions: 374 × 756 px @1x
 */
function PlaceholderScreen() {
  return (
    <div className="w-full h-full flex flex-col" style={{ paddingTop: 52 }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-[10px] text-white/35 font-mono tabular-nums">9:41</span>
        <span className="text-[10px] text-white/35 font-mono">●●●</span>
      </div>

      {/* Match card */}
      <div
        className="mx-3 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
      >
        <div className="px-4 pt-4 pb-3">
          <div className="text-[10px] text-brand-400 font-bold uppercase tracking-widest mb-3">
            Live Match · Pool 8-Ball
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div
                className="h-9 w-9 rounded-full mx-auto mb-1.5 flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.20)' }}
              >
                <span className="text-[9px] font-extrabold text-brand-400">YOU</span>
              </div>
              <div className="text-sm font-bold text-white tabular-nums">3</div>
            </div>
            <div className="text-center px-2">
              <div className="text-[10px] font-semibold text-white/35 mb-1">VS</div>
              <div
                className="h-1 w-8 rounded-full"
                style={{ background: 'linear-gradient(90deg, #22c55e, #06b6d4)' }}
              />
            </div>
            <div className="text-center">
              <div
                className="h-9 w-9 rounded-full mx-auto mb-1.5 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              >
                <span className="text-[9px] font-extrabold text-white/40">OPP</span>
              </div>
              <div className="text-sm font-bold text-white tabular-nums">2</div>
            </div>
          </div>
        </div>
        {/* Progress fill */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full rounded-full animate-stake-fill"
            style={{
              width: '60%',
              background: 'linear-gradient(90deg, #22c55e, #06b6d4)',
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
          <div className="text-[9px] uppercase tracking-widest text-white/35 mb-1">
            Your Stake
          </div>
          <div className="text-base font-bold text-white tabular-nums">£5.00</div>
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(34,197,94,0.07)',
            border: '1px solid rgba(34,197,94,0.22)',
          }}
        >
          <div className="text-[9px] uppercase tracking-widest text-brand-400/70 mb-1">
            Total Pot
          </div>
          <div className="text-base font-bold text-brand-400 tabular-nums">£10.00</div>
        </div>
      </div>

      {/* Timer */}
      <div className="mx-3 mt-3 flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <span className="text-[11px] text-white/35 uppercase tracking-wider">Verified in</span>
        <span className="text-[13px] font-bold text-brand-400 tabular-nums">00:45</span>
      </div>
    </div>
  );
}
