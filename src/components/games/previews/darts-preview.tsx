export function DartsPreview() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      {/* Background — dark pub */}
      <rect width="400" height="220" fill="#0a0a0e" rx="8" />
      {/* Warm lamp glow */}
      <radialGradient id="darts-lamp" cx="50%" cy="0%" r="60%">
        <stop offset="0%" stopColor="#ffc850" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#ffc850" stopOpacity="0" />
      </radialGradient>
      <rect width="400" height="220" fill="url(#darts-lamp)" />

      {/* Wood panel — left */}
      <rect x="0" y="0" width="80" height="220" fill="#1c1108" />
      {[0,22,44,66,88,110,132,154,176,198,220].map(y => (
        <line key={y} x1="0" y1={y} x2="80" y2={y+1} stroke="rgba(80,50,20,0.3)" strokeWidth="1" />
      ))}

      {/* Dartboard — concentric circles */}
      <circle cx="200" cy="110" r="90" fill="#111" stroke="#333" strokeWidth="2" />

      {/* Segment alternating black/cream rings (simplified) */}
      <circle cx="200" cy="110" r="85" fill="none" stroke="#888" strokeWidth="0.5" />
      {/* Outer double ring */}
      <circle cx="200" cy="110" r="85" fill="none" stroke="#444" strokeWidth="9" />
      {/* Treble ring */}
      <circle cx="200" cy="110" r="55" fill="none" stroke="#444" strokeWidth="9" />

      {/* Radial segment lines (8 visible) */}
      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19].map(i => {
        const ang = (i / 20) * Math.PI * 2 - Math.PI / 2;
        const x2 = 200 + Math.cos(ang) * 85;
        const y2 = 110 + Math.sin(ang) * 85;
        return <line key={i} x1="200" y1="110" x2={x2} y2={y2} stroke="rgba(200,200,200,0.3)" strokeWidth="0.6" />;
      })}

      {/* Coloured rings */}
      {/* Double ring red/green alternate — just two arcs as circles */}
      <circle cx="200" cy="110" r="80" fill="none" stroke="#cc2222" strokeWidth="5" strokeDasharray="12.6 12.6" />
      <circle cx="200" cy="110" r="52" fill="none" stroke="#226622" strokeWidth="5" strokeDasharray="12.6 12.6" />

      {/* Bull */}
      <circle cx="200" cy="110" r="9" fill="#226622" />
      {/* Bullseye */}
      <circle cx="200" cy="110" r="4" fill="#cc2222" />

      {/* Number labels (simplified — just a few) */}
      <text x="200" y="20" fill="#f0e8d0" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">20</text>
      <text x="286" y="115" fill="#f0e8d0" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">6</text>
      <text x="114" y="115" fill="#f0e8d0" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">11</text>

      {/* Dart stuck in treble 20 zone */}
      <line x1="197" y1="58" x2="204" y2="66" stroke="#c8c8c8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="204" y1="66" x2="207" y2="70" stroke="#aaa" strokeWidth="1.5" />
      <polygon points="193,58 197,54 197,62" fill="rgba(100,180,255,0.7)" />

      {/* Scoreboard left */}
      <rect x="8" y="75" width="65" height="70" rx="4" fill="#1a2a1a" stroke="#4a8a4a" strokeWidth="1.5" />
      <text x="40" y="92" fill="#90d090" fontSize="9" fontFamily="sans-serif" textAnchor="middle">You</text>
      <text x="40" y="122" fill="#e8ffe8" fontSize="26" fontFamily="monospace" fontWeight="bold" textAnchor="middle">180</text>
      <text x="40" y="136" fill="#70b070" fontSize="8" fontFamily="monospace" textAnchor="middle">3 darts left</text>

      {/* Scoreboard right */}
      <rect x="327" y="75" width="65" height="70" rx="4" fill="#141414" stroke="#333" strokeWidth="1" />
      <text x="360" y="92" fill="#777" fontSize="9" fontFamily="sans-serif" textAnchor="middle">Opponent</text>
      <text x="360" y="122" fill="#aaa" fontSize="26" fontFamily="monospace" fontWeight="bold" textAnchor="middle">241</text>

      {/* "301" label */}
      <text x="200" y="212" fill="rgba(255,255,255,0.2)" fontSize="11" fontFamily="monospace" textAnchor="middle">Darts 301</text>
    </svg>
  );
}
