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

import { EyebrowPill, StatStrip } from '@/components/ui/playstake';

const STATS = [
  {
    value: '540M+',
    label: 'Esports viewers globally',
    caption: 'Newzoo 2023',
  },
  {
    value: '3.2B+',
    label: 'Active gamers worldwide',
    caption: 'Newzoo 2023',
  },
  {
    value: '$1.8B',
    label: 'Esports industry revenue',
    caption: 'Newzoo 2024',
  },
];

export function MarketStats() {
  return (
    <section
      aria-label="Esports market opportunity"
      className="bg-ps-paper dark:bg-ps-ink-2 py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <div className="text-center mb-3">
          <EyebrowPill label="THE OPPORTUNITY" />
        </div>

        {/* Headline */}
        <h2
          className="text-center font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark mb-4"
        >
          A $1.8 Billion Market.{' '}
          <span className="block ps-gradient-text">Still Wide Open.</span>
        </h2>

        <p className="text-center text-ps-muted dark:text-ps-muted-on-dark max-w-xl mx-auto mb-10">
          Competitive gaming is a global sport. PlayStake is building the wagering
          layer that lets players stake on their own matches — not on someone else&apos;s.
        </p>

        {/* Stats */}
        <StatStrip stats={STATS} className="max-w-4xl mx-auto" />
      </div>
    </section>
  );
}
