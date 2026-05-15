/**
 * Esports market context strip — investor-facing signal.
 *
 * Stats sourced from Newzoo Global Esports & Live Streaming Market Report 2023/2024.
 * Verify figures at newzoo.com before investor presentations.
 *
 * Sources:
 *  - 540M viewers:  Newzoo Global Esports Audience Report 2023
 *  - 3.2B gamers:   Newzoo Global Games Market Report 2023
 *  - $1.8B revenue: Newzoo Global Esports Market Report 2024
 */

const STATS = [
  {
    value: '540M+',
    label: 'Esports viewers globally',
    sub: 'Newzoo 2023',
  },
  {
    value: '3.2B+',
    label: 'Active gamers worldwide',
    sub: 'Newzoo 2023',
  },
  {
    value: '$1.8B',
    label: 'Esports industry revenue',
    sub: 'Newzoo 2024',
  },
] as const;

export function MarketStats() {
  return (
    <section
      aria-label="Esports market opportunity"
      className="bg-elevated border-b border-themed py-10 lg:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-8">
          The market we're built for
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4">
          {STATS.map(({ value, label, sub }, i) => (
            <div key={label} className="relative text-center">
              {/* Divider between cols on sm+ */}
              {i > 0 && (
                <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px bg-themed opacity-50" />
              )}

              <div
                className="font-display font-extrabold leading-none tracking-tight bg-clip-text text-transparent"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3rem)',
                  backgroundImage: 'linear-gradient(100deg, #22c55e 0%, #06b6d4 100%)',
                }}
              >
                {value}
              </div>

              <p className="mt-2 text-sm font-semibold text-fg">{label}</p>
              <p className="mt-0.5 text-xs text-fg-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* Context line */}
        <p className="mt-8 text-center text-sm text-fg-secondary max-w-2xl mx-auto">
          Competitive gaming is a global sport. PlayStake is building the wagering
          layer that lets players stake on their own matches — not on someone else's.
        </p>
      </div>
    </section>
  );
}
