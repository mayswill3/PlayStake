import { ComparisonTable } from '@/components/ui/ComparisonTable';

export function NotBookmaker() {
  return (
    <section id="not-bookmaker" className="py-20 lg:py-28 bg-page">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
            Fundamentally different
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg leading-tight">
            Not Odds. Not the House.{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #22c55e 0%, #06b6d4 100%)' }}
            >
              Just the Match.
            </span>
          </h2>
          <p className="mt-4 text-fg-secondary max-w-xl mx-auto">
            Traditional bookmakers let you bet <em>on</em> esports. PlayStake lets you
            bet <em>in</em> it — staking on your own match, against a real opponent,
            with the result determining everything.
          </p>
        </div>

        {/* Table card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur, 0px))',
            WebkitBackdropFilter: 'blur(var(--glass-blur, 0px))',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          <div className="px-4 sm:px-6">
            <ComparisonTable />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-fg-muted max-w-md mx-auto">
          PlayStake is being built with responsible play, verification, and regulatory
          readiness at the core. No real-money deposits are accepted until all compliance
          requirements are met.
        </p>
      </div>
    </section>
  );
}
