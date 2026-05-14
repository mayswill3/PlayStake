import { Gamepad2, Coins, Swords, ShieldCheck, Zap } from 'lucide-react';
import { StepCard } from '@/components/ui/StepCard';

const STEPS = [
  {
    number: '01',
    icon: <Gamepad2 size={20} aria-hidden="true" />,
    title: 'Pick a Game',
    description: 'Choose pool, darts, or penalty shootout — more games are on the way.',
    accent: 'green' as const,
  },
  {
    number: '02',
    icon: <Coins size={20} aria-hidden="true" />,
    title: 'Set the Stake',
    description: 'Pick any amount within your stake limit. Both players lock in escrow.',
    accent: 'cyan' as const,
  },
  {
    number: '03',
    icon: <Swords size={20} aria-hidden="true" />,
    title: 'Match With an Opponent',
    description: 'Skill-matched pairing finds you a real challenger within seconds.',
    accent: 'green' as const,
  },
  {
    number: '04',
    icon: <ShieldCheck size={20} aria-hidden="true" />,
    title: 'Result Verified',
    description: 'Two independent sources confirm the result. No disputes, no delays.',
    accent: 'cyan' as const,
  },
  {
    number: '05',
    icon: <Zap size={20} aria-hidden="true" />,
    title: 'Winner Paid',
    description: 'The pot hits the winner\'s wallet instantly. No withdrawal forms.',
    accent: 'green' as const,
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="text-center mb-10 lg:mb-12">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
            How it works
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg">
            Five Steps to Winning
          </h2>
          <p className="mt-4 text-fg-secondary max-w-xl mx-auto">
            From challenge accepted to pot in wallet — every step verified, every payout
            instant.
          </p>
        </div>

        {/*
          Mobile: horizontal scroll with snap (swipe through steps).
          lg+:    5-column grid.
        */}
        <div
          className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto pb-4 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scroll-smooth"
          role="list"
          aria-label="Match flow steps"
        >
          {STEPS.map((step) => (
            <div
              key={step.number}
              role="listitem"
              className="flex-shrink-0 w-[260px] sm:w-[280px] lg:w-auto snap-start"
            >
              <StepCard
                number={step.number}
                icon={step.icon}
                title={step.title}
                description={step.description}
                accent={step.accent}
                className="h-full"
              />
            </div>
          ))}
        </div>

        {/* Scroll hint — mobile only */}
        <p className="mt-3 text-center text-xs text-fg-muted lg:hidden" aria-hidden="true">
          Swipe to see all steps →
        </p>
      </div>
    </section>
  );
}
