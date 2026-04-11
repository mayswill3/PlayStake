'use client';

/**
 * RadarAnimation — CSS-only pulsing rings. Used in the Player B waiting
 * state and other "scanning" surfaces.
 */
export function RadarAnimation({ size = 96 }: { size?: number }) {
  return (
    <div
      className="relative mx-auto my-4"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Static outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-brand-600/30" />

      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border border-brand-600/40 animate-ping"
          style={{
            animationDelay: `${i * 0.5}s`,
            animationDuration: '1.8s',
          }}
        />
      ))}

      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-brand-600 shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
      </div>
    </div>
  );
}
