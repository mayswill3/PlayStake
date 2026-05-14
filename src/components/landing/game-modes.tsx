import { Circle, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

const GAMES = [
  {
    emoji: '🎱',
    name: 'Pool / 8-Ball',
    description:
      'One-on-one 8-ball pool. Set your stake, match with an opponent, play live.',
    status: 'live' as const,
  },
  {
    emoji: '🎯',
    name: 'Darts',
    description: '501 head-to-head. Real targets, real stakes, real pressure.',
    status: 'coming-soon' as const,
  },
  {
    emoji: '⚽',
    name: 'Penalty Shootout',
    description:
      'Take penalties against a live keeper. Best of five — winner takes the pot.',
    status: 'coming-soon' as const,
  },
  {
    emoji: '🏆',
    name: 'Tournaments',
    description:
      'Bracket-style competitions with combined prize pools. Squad up or go solo.',
    status: 'coming-soon' as const,
  },
  {
    emoji: '👁️',
    name: 'Watch-Along Rooms',
    description:
      "Spectate live matches, predict outcomes, stake on friends' games.",
    status: 'coming-soon' as const,
  },
] as const;

export function GameModes() {
  return (
    <section id="games" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
            Games
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg">
            Choose Your Arena
          </h2>
          <p className="mt-3 text-fg-secondary max-w-lg mx-auto">
            Pool is live now. More arenas are coming — beta players choose what ships
            next.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.map((game) => (
            <GlassCard
              key={game.name}
              padding="md"
              neon={game.status === 'live' ? 'green' : false}
              className="flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl" role="img" aria-label={game.name}>
                  {game.emoji}
                </span>

                {game.status === 'live' ? (
                  <div
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                    style={{
                      background: 'rgba(34,197,94,0.12)',
                      border: '1px solid rgba(34,197,94,0.30)',
                    }}
                  >
                    <Circle
                      size={6}
                      className="fill-brand-400 text-brand-400 animate-pulse"
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">
                      Live
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-elevated border border-themed">
                    <Clock size={10} className="text-fg-muted" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-fg-muted uppercase tracking-widest">
                      Soon
                    </span>
                  </div>
                )}
              </div>

              <h3 className="font-display text-base font-bold text-fg">{game.name}</h3>
              <p className="mt-2 text-sm text-fg-secondary leading-relaxed">
                {game.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
