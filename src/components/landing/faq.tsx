const FAQS = [
  {
    q: 'How does staking work?',
    a: 'Before a match starts, both players agree on a stake amount. Funds are held in escrow — neither side can access them until the result is verified. The winner\'s wallet is credited automatically.',
  },
  {
    q: 'How are results verified?',
    a: 'PlayStake captures results from two independent sources: the game platform\'s API and our in-game tracking widget. If both sources agree, the result settles instantly. If they disagree, a dispute is automatically opened.',
  },
  {
    q: 'What happens in a dispute?',
    a: 'Either player can raise a dispute within 24 hours of a result. Our team reviews game logs, screenshots, and any referee reports. We aim to resolve all disputes within 24 hours.',
  },
  {
    q: 'When will real-money play launch?',
    a: 'PlayStake is currently in closed beta. Real-money play will be enabled following KYC verification, compliance review, and regulatory readiness in each operating territory. Beta users will be the first to be notified.',
  },
  {
    q: 'How does responsible play work?',
    a: 'PlayStake is being built with responsible play at its core. When real-money play launches, the platform will include configurable stake limits, cool-down periods, self-exclusion options, and direct links to gambling support organisations.',
  },
  {
    q: 'How are payouts handled?',
    a: "When real-money play is live, winners receive instant transfers to their PlayStake wallet. From there, funds can be withdrawn to a linked bank account or payment method. No withdrawal request forms, no manual review delays.",
  },
] as const;

export function FAQ() {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
            FAQ
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg">
            Questions? Answered.
          </h2>
        </div>

        {/* Accordion — uses native <details> (no JS required) */}
        <dl className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl overflow-hidden"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(var(--glass-blur, 0px))',
                WebkitBackdropFilter: 'blur(var(--glass-blur, 0px))',
                border: '1px solid var(--glass-border)',
              }}
            >
              <summary
                className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-5 text-fg font-semibold text-sm sm:text-base list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset"
                style={{ WebkitAppearance: 'none' }}
              >
                <dt>{q}</dt>
                {/* Rotates from + to × when open */}
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 text-brand-400 text-xl font-light transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <dd className="px-5 pb-5 text-fg-secondary text-sm leading-relaxed">
                {a}
              </dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}
