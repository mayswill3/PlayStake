export function BullseyePreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Table felt background */}
      <rect width="400" height="220" fill="#0a6e3a" rx="8" />

      {/* Texture lines */}
      {[...Array(18)].map((_, i) => (
        <line
          key={i}
          x1="0"
          y1={i * 12 + 6}
          x2="400"
          y2={i * 12 + 6}
          stroke="rgba(0,0,0,0.04)"
          strokeWidth="0.5"
        />
      ))}

      {/* Target — concentric circles */}
      <circle cx="200" cy="110" r="80" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <circle cx="200" cy="110" r="55" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <circle cx="200" cy="110" r="30" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <circle cx="200" cy="110" r="10" fill="rgba(245,216,0,0.8)" />

      {/* Crosshair lines */}
      <line x1="200" y1="20" x2="200" y2="200" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="110" y1="110" x2="290" y2="110" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 4" />

      {/* Player A ball — yellow */}
      <circle cx="155" cy="90" r="11" fill="#f5d800" />
      <circle cx="152" cy="87" r="3" fill="rgba(255,255,255,0.5)" />

      {/* Player B ball — blue */}
      <circle cx="240" cy="130" r="11" fill="#0055cc" />
      <circle cx="237" cy="127" r="3" fill="rgba(255,255,255,0.5)" />

      {/* Distance indicator lines */}
      <line x1="155" y1="90" x2="200" y2="110" stroke="#f5d800" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="240" y1="130" x2="200" y2="110" stroke="#0055cc" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}
