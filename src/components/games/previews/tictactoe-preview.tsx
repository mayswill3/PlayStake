export function TicTacToePreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Background */}
      <rect width="400" height="220" fill="#0d1b2a" rx="8" />

      {/* Subtle grid dots */}
      {[...Array(8)].map((_, row) =>
        [...Array(15)].map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={col * 27 + 13}
            cy={row * 27 + 13}
            r="0.8"
            fill="rgba(255,255,255,0.05)"
          />
        ))
      )}

      {/* Board — 3x3 grid centered */}
      <g transform="translate(140, 30)">
        {/* Grid lines */}
        <line x1="40" y1="0" x2="40" y2="160" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
        <line x1="80" y1="0" x2="80" y2="160" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="55" x2="120" y2="55" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="108" x2="120" y2="108" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />

        {/* X top-left */}
        <g transform="translate(8, 8)">
          <line x1="4" y1="4" x2="28" y2="36" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <line x1="28" y1="4" x2="4" y2="36" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* O center */}
        <circle cx="60" cy="82" r="17" fill="none" stroke="#ec4899" strokeWidth="4" />

        {/* X bottom-right */}
        <g transform="translate(88, 118)">
          <line x1="4" y1="4" x2="28" y2="34" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <line x1="28" y1="4" x2="4" y2="34" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Diagonal winning line */}
        <line x1="10" y1="10" x2="115" y2="150" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </g>
    </svg>
  );
}
