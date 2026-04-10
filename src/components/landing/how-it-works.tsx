import { Gamepad2, Shield, Trophy, ChevronRight, Check } from 'lucide-react';

interface StepProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: 'amber' | 'slate' | 'brand';
  chips: string[];
}

const STEPS: StepProps[] = [
  {
    number: '01',
    title: 'Play',
    description: 'Choose your game and challenge an opponent. Set your stake amount before the match starts.',
    icon: <Gamepad2 size={32} strokeWidth={2} />,
    accent: 'amber',
    chips: ['Skill-based matching', 'Any game, any platform'],
  },
  {
    number: '02',
    title: 'Stake',
    description: 'Funds locked in escrow — neither player can touch them until the result is verified.',
    icon: <Shield size={32} strokeWidth={2} />,
    accent: 'slate',
    chips: ['Dual-source verification', 'Fair dispute resolution'],
  },
  {
    number: '03',
    title: 'Earn',
    description: 'Winner receives the pot instantly. No withdrawal requests. No waiting.',
    icon: <Trophy size={32} strokeWidth={2} />,
    accent: 'brand',
    chips: ['Instant payout', '5% platform fee only'],
  },
];

const ACCENT_STYLES = {
  amber: {
    card: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30',
    badge: 'bg-amber-500 text-white',
    icon: 'text-amber-600 dark:text-amber-400',
    chip: 'text-amber-700 dark:text-amber-400',
  },
  slate: {
    card: 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700/30',
    badge: 'bg-slate-800 text-white dark:bg-slate-700',
    icon: 'text-slate-700 dark:text-slate-300',
    chip: 'text-slate-700 dark:text-slate-300',
  },
  brand: {
    card: 'bg-brand-50 border-brand-200 dark:bg-brand-950/20 dark:border-brand-800/30',
    badge: 'bg-brand-600 text-white',
    icon: 'text-brand-600 dark:text-brand-400',
    chip: 'text-brand-700 dark:text-brand-400',
  },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">
            How PlayStake works
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-fg">
            Three steps to winning
          </h2>
          <p className="mt-4 text-lg text-fg-secondary max-w-2xl mx-auto">
            From challenge to payout in minutes. Everything verified by dual sources and backed by escrow.
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative grid lg:grid-cols-3 gap-6 lg:gap-8">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative">
              <StepCard {...step} />
              {/* Desktop connector */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-page border border-themed">
                  <ChevronRight size={16} className="text-fg-muted" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ number, title, description, icon, accent, chips }: StepProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div
      className={`relative rounded-2xl border p-8 transition-transform duration-200 hover:-translate-y-1 ${styles.card}`}
    >
      {/* Step badge */}
      <div
        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold tabular-nums ${styles.badge}`}
      >
        {number}
      </div>

      {/* Icon */}
      <div className={`mt-6 ${styles.icon}`}>{icon}</div>

      {/* Title */}
      <h3 className="mt-6 font-display text-2xl font-bold uppercase tracking-wider text-fg">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-3 text-fg-secondary leading-relaxed">{description}</p>

      {/* Chips */}
      <ul className="mt-6 space-y-2">
        {chips.map((chip) => (
          <li key={chip} className={`flex items-center gap-2 text-sm font-medium ${styles.chip}`}>
            <Check size={16} strokeWidth={2.5} />
            {chip}
          </li>
        ))}
      </ul>
    </div>
  );
}
