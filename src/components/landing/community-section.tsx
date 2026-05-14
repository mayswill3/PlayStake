import { Lock, Users, Trophy, Eye, MessageCircle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

const FEATURES = [
  {
    icon: Lock,
    title: 'Private Challenges',
    description: 'Challenge a friend directly. Set the stake, send a link.',
  },
  {
    icon: Users,
    title: 'Friends & Rivals',
    description: 'Add players, track their form, rematch whenever.',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    description: 'Global, game-specific, and friends-only rankings.',
  },
  {
    icon: Eye,
    title: 'Watch Rooms',
    description: 'Spectate live matches. Stake on the outcome if you want.',
  },
  {
    icon: MessageCircle,
    title: 'Live Chat',
    description: 'In-match banter, post-match debrief, community threads.',
  },
] as const;

export function CommunitySection() {
  return (
    <section id="community" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent-400 mb-3">
            Community
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg">
            More Than Matches
          </h2>
          <p className="mt-3 text-fg-secondary max-w-lg mx-auto">
            Build rivalries. Grow your rep. Watch your friends lose their money.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <GlassCard key={title} padding="md" className="flex flex-col items-center text-center">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                style={{ background: 'rgba(6,182,212,0.10)' }}
              >
                <Icon size={20} className="text-accent-400" aria-hidden="true" />
              </div>
              <h3 className="font-display text-sm font-bold text-fg mb-1.5">{title}</h3>
              <p className="text-xs text-fg-secondary leading-relaxed">{description}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
