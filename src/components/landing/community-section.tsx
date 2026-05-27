import { Lock, Users, Trophy, Eye, MessageCircle } from 'lucide-react';
import { EyebrowPill, GlowCard, IconTile } from '@/components/ui/playstake';

const FEATURES = [
  {
    icon: <Lock size={24} strokeWidth={1.5} />,
    title: 'Private Challenges',
    description: 'Challenge a friend directly. Set the stake, send a link.',
  },
  {
    icon: <Users size={24} strokeWidth={1.5} />,
    title: 'Friends & Rivals',
    description: 'Add players, track their form, rematch whenever.',
  },
  {
    icon: <Trophy size={24} strokeWidth={1.5} />,
    title: 'Leaderboards',
    description: 'Global, game-specific, and friends-only rankings.',
  },
  {
    icon: <Eye size={24} strokeWidth={1.5} />,
    title: 'Watch Rooms',
    description: 'Spectate live matches. Stake on the outcome if you want.',
  },
  {
    icon: <MessageCircle size={24} strokeWidth={1.5} />,
    title: 'Live Chat',
    description: 'In-match banter, post-match debrief, community threads.',
  },
] as const;

export function CommunitySection() {
  return (
    <section id="community" className="py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="COMMUNITY" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Built for Players,{' '}
            <span className="block ps-gradient-text">By Players.</span>
          </h2>
          <p className="mt-3 text-ps-muted dark:text-ps-muted-on-dark max-w-lg mx-auto">
            Build rivalries. Grow your rep. Watch your friends lose their money.
          </p>
        </div>

        {/* Feature cards — 5-column on lg, 2-column + 3 on sm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEATURES.map(({ icon, title, description }) => (
            <GlowCard key={title} padding="md" glow="subtle" className="flex flex-col items-center text-center">
              <IconTile icon={icon} size="sm" className="mb-3" />
              <h3 className="font-display text-sm font-bold text-ps-text dark:text-ps-text-on-dark mb-1.5">{title}</h3>
              <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark leading-relaxed">{description}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
