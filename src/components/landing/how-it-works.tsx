import { Gamepad2, Coins, Swords, ShieldCheck, Zap } from 'lucide-react';
import { EyebrowPill, GlowCard, IconTile, StepIndicator } from '@/components/ui/playstake';

const STEPS = [
  {
    icon: <Gamepad2 size={24} strokeWidth={1.5} />,
    title: 'Pick a Game',
    description: 'Choose pool, darts, or penalty shootout — more games are on the way.',
    label: 'Choose a Game',
  },
  {
    icon: <Coins size={24} strokeWidth={1.5} />,
    title: 'Set the Stake',
    description: 'Pick any amount within your stake limit. Both players lock in escrow.',
    label: 'Set Your Stake',
  },
  {
    icon: <Swords size={24} strokeWidth={1.5} />,
    title: 'Match With an Opponent',
    description: 'Skill-matched pairing finds you a real challenger within seconds.',
    label: 'Play the Match',
  },
  {
    icon: <ShieldCheck size={24} strokeWidth={1.5} />,
    title: 'Result Verified',
    description: 'Two independent sources confirm the result. No disputes, no delays.',
    label: 'Verified Result',
  },
  {
    icon: <Zap size={24} strokeWidth={1.5} />,
    title: 'Winner Paid',
    description: "The pot hits the winner's wallet instantly. No withdrawal forms.",
    label: 'Instant Settlement',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="text-center mb-4">
          <EyebrowPill label="HOW IT WORKS" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Five Steps to Fair Play.{' '}
            <span className="block ps-gradient-text">Every One Verified.</span>
          </h2>
          <p className="mt-4 text-ps-muted dark:text-ps-muted-on-dark max-w-xl mx-auto">
            From challenge accepted to pot in wallet — every step verified, every payout
            instant.
          </p>
        </div>

        {/* Step indicator — horizontal numbered circles */}
        <div className="mb-10 flex justify-center">
          <StepIndicator
            steps={STEPS.map((s) => ({ label: s.label }))}
            orientation="auto"
          />
        </div>

        {/* Step cards — 5-column grid on lg, 3+2 on md, stacked on mobile */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          role="list"
          aria-label="Match flow steps"
        >
          {STEPS.map((step, i) => (
            <GlowCard
              key={i}
              padding="md"
              glow="subtle"
              as="article"
              className="flex flex-col items-center text-center"
            >
              <div role="listitem">
                <IconTile icon={step.icon} size="md" className="mb-4" />
                <div className="text-xs font-bold text-ps-lime mb-2 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-display text-base font-bold text-ps-text dark:text-ps-text-on-dark mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark leading-relaxed">
                  {step.description}
                </p>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
