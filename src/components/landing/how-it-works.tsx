import { Gamepad2, Shield, Trophy, ChevronRight, Check } from 'lucide-react';

interface StepProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: 'lime' | 'teal' | 'brand';
  chips: string[];
}

const STEPS: StepProps[] = [
  {
    number: '01',
    title: 'Play',
    description: 'Choose your game and challenge an opponent. Set your stake amount before the match starts.',
    icon: <Gamepad2 size={32} strokeWidth={2} />,
    accent: 'lime',
    chips: ['Skill-based matching', 'Any game, any platform'],
  },
  {
    number: '02',
    title: 'Stake',
    description: 'Funds locked in escrow — neither player can touch them until the result is verified.',
    icon: <Shield size={32} strokeWidth={2} />,
    accent: 'teal',
    chips: ['Dual-source verification', 'Fair dispute resolution'],
  },
  {
    number: '03',
    title: 'Earn',
    description: 'Winner receives the pot instantly. No withdrawal requests. No waiting.',
    icon: <Trophy size={32} strokeWidth={2} />,
    accent: 'brand',
    chips: ['Instant payout'],
  },
];

// Each card uses the themable bg-card surface as base (inverts with theme),
// with an accent-colored top border + tinted badge/icon/chip to differentiate.
const ACCENT_STYLES = {
  lime: {
    topBorder: 'linear-gradient(90deg, #22c55e, #4ade80)',
    badge: 'bg-[#22c55e] text-white',
    icon: 'text-[#16a34a] dark:text-[#4ade80]',
    iconBg: 'bg-[#22c55e]/10 dark:bg-[#22c55e]/15',
    chip: 'text-[#15803d] dark:text-[#4ade80]',
  },
  teal: {
    topBorder: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
    badge: 'bg-[#06b6d4] text-white',
    icon: 'text-[#0891b2] dark:text-[#22d3ee]',
    iconBg: 'bg-[#06b6d4]/10 dark:bg-[#06b6d4]/15',
    chip: 'text-[#0e7490] dark:text-[#22d3ee]',
  },
  brand: {
    topBorder: 'linear-gradient(90deg, #10b981, #34d399)',
    badge: 'bg-[#10b981] text-white',
    icon: 'text-[#059669] dark:text-[#34d399]',
    iconBg: 'bg-[#10b981]/10 dark:bg-[#10b981]/15',
    chip: 'text-[#047857] dark:text-[#34d399]',
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
        <div className="relative grid lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative flex">
              <StepCard {...step} />
              {/* Desktop connector */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-5 z-10 h-9 w-9 items-center justify-center rounded-full bg-page border border-themed">
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
      className="relative flex w-full flex-col rounded-2xl border border-themed bg-card overflow-hidden transition-transform duration-200 hover:-translate-y-1 shadow-sm"
    >
      {/* Accent top border */}
      <div className="h-1" style={{ background: styles.topBorder }} />

      <div className="flex flex-col flex-1 p-8">
        {/* Step badge */}
        <div
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold tabular-nums w-fit ${styles.badge}`}
        >
          {number}
        </div>

        {/* Icon */}
        <div className={`mt-6 flex h-14 w-14 items-center justify-center rounded-xl ${styles.iconBg} ${styles.icon}`}>
          {icon}
        </div>

        {/* Title */}
        <h3 className="mt-6 font-display text-2xl font-bold uppercase tracking-wider text-fg">
          {title}
        </h3>

        {/* Description */}
        <p className="mt-3 text-fg-secondary leading-relaxed">{description}</p>

        {/* Chips */}
        <ul className="mt-auto pt-6 space-y-2">
          {chips.map((chip) => (
            <li key={chip} className={`flex items-center gap-2 text-sm font-medium ${styles.chip}`}>
              <Check size={16} strokeWidth={2.5} />
              {chip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
