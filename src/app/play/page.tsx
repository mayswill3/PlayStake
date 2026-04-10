import Link from 'next/link';
import { Circle, Disc, Grid3x3, Layers, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DemoCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const DEMOS: DemoCardProps[] = [
  {
    href: '/play/cards',
    icon: Layers,
    title: 'Higher / Lower',
    description: 'Classic card game with turn-based wagering and score tracking.',
  },
  {
    href: '/play/tictactoe',
    icon: Grid3x3,
    title: 'Tic-Tac-Toe',
    description: 'Classic strategy game with two-player wagering and win detection.',
  },
  {
    href: '/play/pool',
    icon: Circle,
    title: '8-Ball Pool',
    description: 'Classic 8-ball pool with realistic physics and two-player wagering.',
  },
  {
    href: '/play/3shot',
    icon: Target,
    title: '3-Shot Pool',
    description: '3 shots each. Most balls potted wins. Fast-paced wagered match.',
  },
  {
    href: '/play/bullseye',
    icon: Disc,
    title: 'Bullseye Pool',
    description: 'Land closest to the target. Win the round. Precision wagered match.',
  },
];

export default function DemoIndex() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-fg mb-2">
          Game Demos
        </h1>
        <p className="text-base text-fg-secondary">
          See how PlayStake integrates with different game types.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((demo) => (
          <DemoCard key={demo.href} {...demo} />
        ))}
      </div>
    </div>
  );
}

function DemoCard({ href, icon: Icon, title, description }: DemoCardProps) {
  return (
    <Link href={href} className="group">
      <div className="h-full rounded-xl border border-themed bg-card p-6 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:border-brand-600/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:text-brand-400">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-semibold text-fg">
            {title}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-fg-secondary">
          {description}
        </p>
      </div>
    </Link>
  );
}
