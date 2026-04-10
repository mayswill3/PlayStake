export function ThreeShotPreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Table felt */}
      <rect width="400" height="220" fill="#0a6e3a" rx="8" />

      {/* Texture */}
      {[...Array(18)].map((_, i) => (
        <line key={i} x1="0" y1={i * 12 + 6} x2="400" y2={i * 12 + 6} stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      ))}

      {/* Pockets */}
      <circle cx="12" cy="12" r="10" fill="#050505" />
      <circle cx="200" cy="8" r="9" fill="#050505" />
      <circle cx="388" cy="12" r="10" fill="#050505" />
      <circle cx="12" cy="208" r="10" fill="#050505" />
      <circle cx="200" cy="212" r="9" fill="#050505" />
      <circle cx="388" cy="208" r="10" fill="#050505" />

      {/* Scattered balls mid-shot */}
      <circle cx="180" cy="80" r="8" fill="#f5d800" />
      <circle cx="220" cy="140" r="8" fill="#cc0000" />
      <circle cx="290" cy="100" r="8" fill="#0055cc" />
      <circle cx="250" cy="170" r="8" fill="#6b1f8a" />

      {/* Cue ball mid-strike with motion blur */}
      <circle cx="110" cy="110" r="9" fill="#ffffff" opacity="0.3" />
      <circle cx="130" cy="110" r="9" fill="#ffffff" opacity="0.6" />
      <circle cx="150" cy="110" r="9" fill="#ffffff" />

      {/* Shot dots indicator — top right */}
      <g>
        <text x="310" y="30" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold" fontFamily="monospace">SHOTS</text>
        <circle cx="340" cy="45" r="5" fill="#22c55e" />
        <circle cx="354" cy="45" r="5" fill="#22c55e" />
        <circle cx="368" cy="45" r="5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      </g>

      {/* Trajectory line */}
      <line x1="150" y1="110" x2="220" y2="140" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
}
