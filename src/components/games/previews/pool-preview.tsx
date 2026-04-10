export function PoolPreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Table felt */}
      <rect width="400" height="220" fill="#0a6e3a" rx="8" />

      {/* Felt texture */}
      {[...Array(18)].map((_, i) => (
        <line key={i} x1="0" y1={i * 12 + 6} x2="400" y2={i * 12 + 6} stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      ))}

      {/* Head string */}
      <line x1="100" y1="20" x2="100" y2="200" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

      {/* Pockets */}
      <circle cx="12" cy="12" r="10" fill="#050505" />
      <circle cx="200" cy="8" r="9" fill="#050505" />
      <circle cx="388" cy="12" r="10" fill="#050505" />
      <circle cx="12" cy="208" r="10" fill="#050505" />
      <circle cx="200" cy="212" r="9" fill="#050505" />
      <circle cx="388" cy="208" r="10" fill="#050505" />

      {/* Cue ball */}
      <circle cx="100" cy="110" r="9" fill="#ffffff" />
      <circle cx="97" cy="107" r="3" fill="rgba(255,255,255,0.5)" />

      {/* Ball rack (triangle) — 15 balls */}
      {[
        { x: 270, y: 110, color: '#f5d800', n: 1 },
        { x: 289, y: 99, color: '#0055cc', n: 2 },
        { x: 289, y: 121, color: '#cc0000', n: 3 },
        { x: 308, y: 88, color: '#6b1f8a', n: 4 },
        { x: 308, y: 110, color: '#111111', n: 8 },
        { x: 308, y: 132, color: '#e86100', n: 5 },
        { x: 327, y: 77, color: '#007a3d', n: 6 },
        { x: 327, y: 99, color: '#8b1a1a', n: 7 },
        { x: 327, y: 121, color: '#f5d800', n: 9 },
        { x: 327, y: 143, color: '#0055cc', n: 10 },
      ].map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r="9" fill={b.color} />
          <circle cx={b.x} cy={b.y} r="4" fill="#ffffff" />
        </g>
      ))}

      {/* Aim line */}
      <line x1="100" y1="110" x2="260" y2="110" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}
