export function FpsPreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Background — dark map */}
      <rect width="400" height="220" fill="#0d1b2a" rx="8" />

      {/* Grid lines — radar feel */}
      {[...Array(10)].map((_, i) => (
        <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="220" stroke="rgba(34,197,94,0.08)" strokeWidth="1" />
      ))}
      {[...Array(6)].map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 44} x2="400" y2={i * 44} stroke="rgba(34,197,94,0.08)" strokeWidth="1" />
      ))}

      {/* Radar circles (center) */}
      <circle cx="200" cy="110" r="90" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="1" />
      <circle cx="200" cy="110" r="60" fill="none" stroke="rgba(34,197,94,0.2)" strokeWidth="1" />
      <circle cx="200" cy="110" r="30" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />

      {/* Crosshair */}
      <g transform="translate(200, 110)">
        <line x1="-20" y1="0" x2="-8" y2="0" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8" y1="0" x2="20" y2="0" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="-20" x2="0" y2="-8" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="8" x2="0" y2="20" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="2" fill="#22c55e" />
      </g>

      {/* Team Alpha dots (blue) */}
      <circle cx="80" cy="60" r="5" fill="#3b82f6" />
      <circle cx="60" cy="140" r="5" fill="#3b82f6" />
      <circle cx="130" cy="180" r="5" fill="#3b82f6" />

      {/* Team Bravo dots (pink) */}
      <circle cx="320" cy="70" r="5" fill="#ec4899" />
      <circle cx="340" cy="150" r="5" fill="#ec4899" />
      <circle cx="270" cy="40" r="5" fill="#ec4899" />

      {/* Sweep line — tactical radar */}
      <line x1="200" y1="110" x2="290" y2="110" stroke="#22c55e" strokeWidth="1.5" opacity="0.6" />

      {/* Corner labels */}
      <text x="15" y="22" fill="rgba(59,130,246,0.8)" fontSize="10" fontWeight="bold" fontFamily="monospace">ALPHA</text>
      <text x="385" y="22" fill="rgba(236,72,153,0.8)" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="end">BRAVO</text>
    </svg>
  );
}
