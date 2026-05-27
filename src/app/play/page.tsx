import Link from 'next/link';
import { Grid3x3, Layers, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlowCard } from '@/components/ui/playstake/GlowCard';
import { IconTile } from '@/components/ui/playstake/IconTile';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { PSButton } from '@/components/ui/playstake/PSButton';

interface DemoCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  status: 'live' | 'expired';
}

const DEMOS: DemoCardProps[] = [
  {
    href: '/play/cards',
    icon: Layers,
    title: 'Higher / Lower',
    description: 'Classic card game with turn-based wagering and score tracking.',
    status: 'live',
  },
  {
    href: '/play/tictactoe',
    icon: Grid3x3,
    title: 'Tic-Tac-Toe',
    description: 'Classic strategy game with two-player wagering and win detection.',
    status: 'live',
  },
  {
    href: '/play/darts',
    icon: Target,
    title: 'Darts 301',
    description: 'Start at 301, aim the moving crosshair, and click to throw.',
    status: 'live',
  },
];

export default function DemoIndex() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ps-text dark:text-ps-text-on-dark mb-2">
          Game Lobby
        </h1>
        <p className="text-base text-ps-muted dark:text-ps-muted-on-dark">
          Choose a game and stake your claim.
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

function DemoCard({ href, icon: Icon, title, description, status }: DemoCardProps) {
  const isLive = status === 'live';

  return (
    <Link href={href} className="group">
      <GlowCard
        glow={isLive ? 'subtle' : 'none'}
        padding="md"
        className={!isLive ? 'opacity-60 pointer-events-none' : ''}
      >
        <div className="flex items-center justify-between mb-4">
          <IconTile icon={<Icon className="h-full w-full" />} size="sm" />
          <StatusPill status={isLive ? 'live' : 'expired'} label={isLive ? 'LIVE' : 'COMING SOON'} />
        </div>
        <h2 className="font-display text-lg font-semibold text-ps-text dark:text-ps-text-on-dark mb-1">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-ps-muted dark:text-ps-muted-on-dark mb-4">
          {description}
        </p>
        {isLive && (
          <PSButton variant="primary" size="sm" className="w-full">
            Play Now
          </PSButton>
        )}
      </GlowCard>
    </Link>
  );
}
