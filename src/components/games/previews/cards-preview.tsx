export function CardsPreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Background */}
      <rect width="400" height="220" fill="#0d1b2a" rx="8" />

      {/* Subtle pattern */}
      {[...Array(10)].map((_, i) => (
        <circle key={i} cx={40 + i * 40} cy={20 + (i % 2) * 180} r="1" fill="rgba(255,255,255,0.08)" />
      ))}

      {/* Left card — current */}
      <g transform="translate(110, 40) rotate(-6 60 70)">
        <rect width="120" height="140" rx="10" fill="#ffffff" />
        <rect x="2" y="2" width="116" height="136" rx="8" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        <text x="14" y="30" fill="#dc2626" fontSize="24" fontWeight="bold" fontFamily="serif">K</text>
        <text x="14" y="50" fill="#dc2626" fontSize="20" fontFamily="serif">♥</text>
        <text x="60" y="85" fill="#dc2626" fontSize="60" fontFamily="serif" textAnchor="middle" dominantBaseline="central">♥</text>
        <g transform="rotate(180 60 70)">
          <text x="14" y="30" fill="#dc2626" fontSize="24" fontWeight="bold" fontFamily="serif">K</text>
          <text x="14" y="50" fill="#dc2626" fontSize="20" fontFamily="serif">♥</text>
        </g>
      </g>

      {/* Right card — next/higher indicator */}
      <g transform="translate(200, 40) rotate(6 60 70)">
        <rect width="120" height="140" rx="10" fill="#ffffff" />
        <rect x="2" y="2" width="116" height="136" rx="8" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        <text x="14" y="30" fill="#0f172a" fontSize="24" fontWeight="bold" fontFamily="serif">A</text>
        <text x="14" y="50" fill="#0f172a" fontSize="20" fontFamily="serif">♠</text>
        <text x="60" y="85" fill="#0f172a" fontSize="60" fontFamily="serif" textAnchor="middle" dominantBaseline="central">♠</text>
        <g transform="rotate(180 60 70)">
          <text x="14" y="30" fill="#0f172a" fontSize="24" fontWeight="bold" fontFamily="serif">A</text>
          <text x="14" y="50" fill="#0f172a" fontSize="20" fontFamily="serif">♠</text>
        </g>
      </g>

      {/* Higher arrow */}
      <g transform="translate(195, 25)">
        <circle cx="10" cy="10" r="10" fill="#22c55e" />
        <path d="M 5 12 L 10 7 L 15 12" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
