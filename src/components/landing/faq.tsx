import { EyebrowPill } from '@/components/ui/playstake';

const FAQS = [
  {
    q: 'How does staking work?',
    a: 'Before a match starts, both players agree on a stake amount. Funds are held in escrow — neither side can access them until the result is verified. The winner\'s wallet is credited automatically.',
  },
  {
    q: 'How are results verified?',
    a: 'Games played on PlayStake report their own result. Streamed matches are officiated by an independent, approved referee who watches both players\' live streams and records the result, with every step written to a tamper-evident audit trail. Either player can dispute a result before it pays out.',
  },
  {
    q: 'What happens in a dispute?',
    a: 'Either player can dispute a result from the bet page within the time shown there — 24 hours for most games, or the 15-minute window after a referee\'s decision. Payout pauses and our team reviews game logs, stream footage and referee evidence. If you are unhappy with the outcome, you can make a complaint and, after our final response, take it to IBAS, our independent adjudicator.',
  },
  {
    q: 'When will real-money play launch?',
    a: 'PlayStake is currently in closed beta. Real-money play will be enabled following KYC verification, compliance review, and regulatory readiness in each operating territory. Beta users will be the first to be notified.',
  },
  {
    q: 'How does responsible play work?',
    a: 'You can set daily, weekly and monthly deposit limits, take a cool-off break, self-exclude for six months to five years, and turn on session reminders — all from Responsible Play. We check every account against GAMSTOP, the national self-exclusion scheme, and reach out if your play shows signs of harm. Free support is available from GamCare on 0808 8020 133.',
  },
  {
    q: 'How are payouts handled?',
    a: "When real-money play is live, winnings are credited to your PlayStake wallet as soon as a result settles. From there you can withdraw to your verified bank account. Most withdrawals are processed automatically; occasionally we may need to review one for security or legal reasons before it is paid.",
  },
] as const;

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="FAQ" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Questions?{' '}
            <span className="ps-gradient-text">Answered.</span>
          </h2>
        </div>

        {/* Accordion — uses native <details> (no JS required) */}
        <dl className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-[var(--ps-radius-lg)] overflow-hidden ps-gradient-border-mask-light shadow-ps-shadow-sm"
            >
              <summary
                className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-5 text-ps-text dark:text-ps-text-on-dark font-semibold text-sm sm:text-base list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-blue)] dark:focus-visible:ring-[var(--ps-lime)] focus-visible:ring-inset"
                style={{ WebkitAppearance: 'none' }}
              >
                <dt>{q}</dt>
                {/* Rotates from + to x when open */}
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 text-ps-lime text-xl font-light transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <dd className="px-5 pb-5 text-ps-muted dark:text-ps-muted-on-dark text-sm leading-relaxed">
                {a}
              </dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}
