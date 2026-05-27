import { EyebrowPill, ComparisonCard } from '@/components/ui/playstake';

const COMPARISON_COLUMNS = [
  {
    heading: 'Informal Wagers',
    items: [
      { label: 'Real opponent (not the house)', included: false },
      { label: 'Escrow-backed stakes', included: false },
      { label: 'Dual-source result verification', included: false },
      { label: 'Instant settlement', included: false },
      { label: 'Dispute resolution', included: false },
      { label: 'Player community', included: false },
    ],
  },
  {
    heading: 'Existing Platforms',
    items: [
      { label: 'Real opponent (not the house)', included: false },
      { label: 'Escrow-backed stakes', included: true },
      { label: 'Dual-source result verification', included: false },
      { label: 'Instant settlement', included: false },
      { label: 'Dispute resolution', included: false },
      { label: 'Player community', included: false },
    ],
  },
  {
    heading: 'PlayStake',
    highlighted: true,
    items: [
      { label: 'Real opponent (not the house)', included: true },
      { label: 'Escrow-backed stakes', included: true },
      { label: 'Dual-source result verification', included: true },
      { label: 'Instant settlement', included: true },
      { label: 'Dispute resolution', included: true },
      { label: 'Player community', included: true },
    ],
  },
];

export function NotBookmaker() {
  return (
    <section id="not-bookmaker" className="py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink-2">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="FUNDAMENTALLY DIFFERENT" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark leading-tight">
            Not Odds. Not the House.{' '}
            <span className="block ps-gradient-text">Just the Match.</span>
          </h2>
          <p className="mt-4 text-ps-muted dark:text-ps-muted-on-dark max-w-xl mx-auto">
            Traditional bookmakers let you bet <em>on</em> esports. PlayStake lets you
            bet <em>in</em> it — staking on your own match, against a real opponent,
            with the result determining everything.
          </p>
        </div>

        {/* Comparison table */}
        <ComparisonCard columns={COMPARISON_COLUMNS} />

        <p className="mt-6 text-center text-xs text-ps-muted dark:text-ps-muted-on-dark max-w-md mx-auto">
          PlayStake is being built with responsible play, verification, and regulatory
          readiness at the core. No real-money deposits are accepted until all compliance
          requirements are met.
        </p>
      </div>
    </section>
  );
}
