export function DartsPreview() {
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

      {/* Dartboard centred */}
      <g transform="translate(200, 110)">
        {/* Double ring */}
        <circle cx="0" cy="0" r="80" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
        {/* Outer single */}
        <circle cx="0" cy="0" r="68" fill="#2d1b1b" />
        {/* Treble ring */}
        <circle cx="0" cy="0" r="46" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
        {/* Inner single */}
        <circle cx="0" cy="0" r="40" fill="#2d1b1b" />
        {/* Outer bull */}
        <circle cx="0" cy="0" r="13" fill="#16a34a" />
        {/* Inner bull */}
        <circle cx="0" cy="0" r="5" fill="#dc2626" />

        {/* Coloured segments hint — top double (red) */}
        <path d="M -13 -80 A 80 80 0 0 1 13 -80 L 10 -68 A 68 68 0 0 0 -10 -68 Z" fill="#dc2626" opacity="0.8" />
        {/* Right double (green) */}
        <path d="M 80 -13 A 80 80 0 0 1 80 13 L 68 10 A 68 68 0 0 0 68 -10 Z" fill="#16a34a" opacity="0.8" />

        {/* Wire lines — 4 cross-hairs */}
        <line x1="0" y1="-80" x2="0" y2="80" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <line x1="-80" y1="0" x2="80" y2="0" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />

        {/* 20 at top */}
        <text x="0" y="-85" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="bold" textAnchor="middle">20</text>
      </g>

      {/* Dart 1 — gold, embedded */}
      <g transform="translate(188, 90) rotate(-8)">
        <line x1="0" y1="0" x2="0" y2="22" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="2.5" fill="#f5c842" />
        {/* Flight */}
        <polygon points="-5,22 0,18 5,22" fill="#f5c842" opacity="0.7" />
      </g>

      {/* Dart 2 — gold */}
      <g transform="translate(210, 100) rotate(5)">
        <line x1="0" y1="0" x2="0" y2="22" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="2.5" fill="#f5c842" />
        <polygon points="-5,22 0,18 5,22" fill="#f5c842" opacity="0.7" />
      </g>

      {/* Dart 3 — cyan, opponent */}
      <g transform="translate(203, 118) rotate(2)">
        <line x1="0" y1="0" x2="0" y2="22" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="2.5" fill="#22d3ee" />
        <polygon points="-5,22 0,18 5,22" fill="#22d3ee" opacity="0.7" />
      </g>

      {/* Score labels */}
      <text x="50" y="40" fill="#f5c842" fontSize="14" fontWeight="bold" fontFamily="monospace">501</text>
      <text x="320" y="40" fill="#22d3ee" fontSize="14" fontWeight="bold" fontFamily="monospace">501</text>
    </svg>
  );
}
