export function PoolPreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Background */}
      <rect width="400" height="220" fill="#0d1b2a" rx="8" />

      {/* Table shadow */}
      <rect x="42" y="32" width="316" height="160" rx="10" fill="rgba(0,0,0,0.4)" />
      {/* Wood rail */}
      <rect x="36" y="26" width="328" height="168" rx="12" fill="#3d2412" />
      {/* Cushion */}
      <rect x="48" y="38" width="304" height="144" rx="6" fill="#14471f" />
      {/* Felt */}
      <rect x="56" y="46" width="288" height="128" rx="4" fill="#1a5c2a" />

      {/* Kitchen line */}
      <line x1="128" y1="46" x2="128" y2="174" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />

      {/* Bullseye rings */}
      <circle cx="200" cy="110" r="48" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <circle cx="200" cy="110" r="28" fill="none" stroke="rgba(200,200,200,0.22)" strokeWidth="1.5" />
      <circle cx="200" cy="110" r="12" fill="rgba(255,200,50,0.18)" stroke="rgba(255,215,0,0.45)" strokeWidth="1.5" />
      <circle cx="200" cy="110" r="2" fill="#f59e0b" />

      {/* Pockets */}
      <circle cx="58" cy="48" r="7" fill="#111" stroke="#8b6914" strokeWidth="1.5" />
      <circle cx="200" cy="44" r="6" fill="#111" stroke="#8b6914" strokeWidth="1.5" />
      <circle cx="342" cy="48" r="7" fill="#111" stroke="#8b6914" strokeWidth="1.5" />
      <circle cx="58" cy="172" r="7" fill="#111" stroke="#8b6914" strokeWidth="1.5" />
      <circle cx="200" cy="176" r="6" fill="#111" stroke="#8b6914" strokeWidth="1.5" />
      <circle cx="342" cy="172" r="7" fill="#111" stroke="#8b6914" strokeWidth="1.5" />

      {/* Object ball (yellow stripe #9) — ghost marker at preset position */}
      <circle cx="270" cy="85" r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 2" />
      {/* Object ball placed */}
      <circle cx="270" cy="85" r="7" fill="#fafafa" />
      <rect x="263" y="82" width="14" height="6" rx="3" fill="#f5c518" clipPath="url(#ballClip)" />
      <circle cx="270" cy="85" r="7" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

      {/* Cue ball in kitchen */}
      <circle cx="105" cy="110" r="7.5" fill="#fafafa" />
      <circle cx="103" cy="108" r="2.5" fill="rgba(255,255,255,0.6)" />

      {/* Cue stick */}
      <line x1="40" y1="130" x2="97" y2="112" stroke="#3d1f0a" strokeWidth="3" strokeLinecap="round" />
      <line x1="94" y1="113" x2="100" y2="111" stroke="#f5f5f5" strokeWidth="2" />

      {/* Score labels */}
      <text x="72" y="22" fill="#f5c842" fontSize="11" fontWeight="bold" fontFamily="monospace">P1: 12</text>
      <text x="288" y="22" fill="#22d3ee" fontSize="11" fontWeight="bold" fontFamily="monospace">P2: 9</text>

      {/* Score popup hint */}
      <text x="200" y="98" fill="rgba(255,215,0,0.6)" fontSize="14" fontWeight="bold" textAnchor="middle">+5</text>
    </svg>
  );
}
