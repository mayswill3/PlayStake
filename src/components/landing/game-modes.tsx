import { CircleDot, Target, Goal, Trophy, Eye } from 'lucide-react';
import { EyebrowPill, GlowCard, IconTile, StatusPill } from '@/components/ui/playstake';

const GAMES = [
  {
    icon: <CircleDot size={24} strokeWidth={1.5} />,
    name: 'Pool / 8-Ball',
    description:
      'One-on-one 8-ball pool. Set your stake, match with an opponent, play live.',
    status: 'live' as const,
  },
  {
    icon: <Target size={24} strokeWidth={1.5} />,
    name: 'Darts',
    description: '501 head-to-head. Real targets, real stakes, real pressure.',
    status: 'coming-soon' as const,
  },
  {
    icon: <Goal size={24} strokeWidth={1.5} />,
    name: 'Penalty Shootout',
    description:
      'Take penalties against a live keeper. Best of five — winner takes the pot.',
    status: 'coming-soon' as const,
  },
  {
    icon: <Trophy size={24} strokeWidth={1.5} />,
    name: 'Tournaments',
    description:
      'Bracket-style competitions with combined prize pools. Squad up or go solo.',
    status: 'coming-soon' as const,
  },
  {
    icon: <Eye size={24} strokeWidth={1.5} />,
    name: 'Watch-Along Rooms',
    description:
      "Spectate live matches, predict outcomes, stake on friends' games.",
    status: 'coming-soon' as const,
  },
] as const;

export function GameModes() {
  return (
    <section id="games" className="py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="GAMES" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Choose Your Arena.{' '}
            <span className="block ps-gradient-text">Prove Your Skill.</span>
          </h2>
          <p className="mt-3 text-ps-muted dark:text-ps-muted-on-dark max-w-lg mx-auto">
            Pool is live now. More arenas are coming — beta players choose what ships
            next.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.map((game) => (
            <GlowCard
              key={game.name}
              padding="md"
              glow={game.status === 'live' ? 'medium' : 'none'}
              className={`flex flex-col ${game.status === 'coming-soon' ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <IconTile
                  icon={game.icon}
                  size="sm"
                />
                {game.status === 'live' ? (
                  <StatusPill status="live" />
                ) : (
                  <StatusPill status="waiting" label="SOON" />
                )}
              </div>

              <h3 className="font-display text-base font-bold text-ps-text dark:text-ps-text-on-dark">{game.name}</h3>
              <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark leading-relaxed">
                {game.description}
              </p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
