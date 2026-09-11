import Link from 'next/link';
import { Bot, User, Check, ArrowRight } from 'lucide-react';
import { EyebrowPill, GlowCard, IconTile, PSButton, StatusPill } from '@/components/ui/playstake';

const HUMAN_FEATURES = [
  'Watch live matches, confirm the winner',
  'Earn a fee for every match — paid by PlayStake, not the players',
  'No shifts, no minimums — claim matches when you want',
];

const AI_FEATURES = [
  'Will watch game state in real-time',
  'Will auto-validate results instantly',
  'Available 24/7, no scheduling',
];

const STEPS = [
  { step: '01', title: 'Sign up', description: 'Create your account and apply to the referee programme.' },
  { step: '02', title: 'Get notified', description: 'See staked matches that need a referee, the moment they appear.' },
  { step: '03', title: 'Watch & verify', description: 'Spectate the match live and confirm the result when it ends.' },
  { step: '04', title: 'Get paid', description: 'Your referee fee lands in your wallet automatically at settlement.' },
];

export function ForReferees() {
  return (
    <section
      id="for-referees"
      className="scroll-mt-16 py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink-2"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="BECOME A REFEREE" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Watch Games. Verify Results.{' '}
            <span className="block ps-gradient-text">Get Paid.</span>
          </h2>
          <p className="mt-3 text-ps-muted dark:text-ps-muted-on-dark max-w-xl mx-auto">
            Every staked match needs a referee. Human referees verify matches today —
            an automated AI referee is in development.
          </p>
        </div>

        {/* Referee type cards */}
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-12">
          <GlowCard padding="md" glow="medium" className="flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <IconTile icon={<User size={24} strokeWidth={1.5} />} size="sm" />
              <StatusPill status="live" label="LIVE NOW" />
            </div>
            <h3 className="font-display text-base font-bold text-ps-text dark:text-ps-text-on-dark">
              Human Referee
            </h3>
            <ul className="mt-3 space-y-2 flex-1 mb-5">
              {HUMAN_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-ps-muted dark:text-ps-muted-on-dark leading-relaxed"
                >
                  <Check size={14} strokeWidth={2.5} className="mt-1 flex-shrink-0 text-ps-lime" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/referees/human"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark hover:text-ps-lime dark:hover:text-ps-lime transition-colors"
            >
              How human refereeing works
              <ArrowRight size={14} />
            </Link>
          </GlowCard>

          <GlowCard padding="md" glow="none" className="flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <IconTile icon={<Bot size={24} strokeWidth={1.5} />} size="sm" />
              <StatusPill status="waiting" label="IN DEVELOPMENT" />
            </div>
            <h3 className="font-display text-base font-bold text-ps-text dark:text-ps-text-on-dark">
              AI Referee
            </h3>
            <ul className="mt-3 space-y-2 flex-1 mb-5">
              {AI_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-ps-muted dark:text-ps-muted-on-dark leading-relaxed"
                >
                  <Check size={14} strokeWidth={2.5} className="mt-1 flex-shrink-0 text-ps-lime" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/referees/ai"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark hover:text-ps-lime dark:hover:text-ps-lime transition-colors"
            >
              What we&apos;re building
              <ArrowRight size={14} />
            </Link>
          </GlowCard>
        </div>

        {/* How it works steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-10">
          {STEPS.map((item) => (
            <div key={item.step} className="flex gap-3">
              <span className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-ps-lime/15 font-mono text-xs font-bold text-ps-text dark:text-ps-lime">
                {item.step}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
                  {item.title}
                </h4>
                <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <a href="/register">
            <PSButton size="lg" className="min-w-[200px]">
              Sign up to referee
            </PSButton>
          </a>
          <p className="mt-3 text-xs text-ps-muted dark:text-ps-muted-on-dark">
            Open to verified users with a connected Kick account.
          </p>
        </div>
      </div>
    </section>
  );
}
