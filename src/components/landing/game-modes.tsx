import { Goal, Swords, Trophy, Eye } from 'lucide-react';
import { EyebrowPill, GlowCard, IconTile, StatusPill } from '@/components/ui/playstake';

const GAMES = [
  {
    icon: <Goal size={24} strokeWidth={1.5} />,
    name: 'EA SPORTS FC 27',
    description:
      'One-against-one online friendlies, both players streaming on Kick and an independent referee recording the score.',
    status: 'live' as const,
  },
  {
    icon: <Swords size={24} strokeWidth={1.5} />,
    name: 'Tekken 8',
    description: 'First-to-3 sets, both players streaming on Kick and an independent referee recording the winner.',
    status: 'live' as const,
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
    description: 'Spectate live refereed matches with the community.',
    status: 'coming-soon' as const,
  },
] as const;

export function GameModes() {
  return (
    <section id="games" className="scroll-mt-16 py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="GAMES" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Choose Your Arena.{' '}
            <span className="block ps-gradient-text">Prove Your Skill.</span>
          </h2>
          <p className="mt-3 text-ps-muted dark:text-ps-muted-on-dark max-w-lg mx-auto">
            EA SPORTS FC 27 and Tekken 8 are in the beta. More games are coming, and beta
            players choose what ships next.
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
