import Link from 'next/link';
import { ShieldCheck, Zap, Scale, BarChart2, ArrowRight, Target } from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Secure escrow',
    description: 'Funds are locked until the result is verified by both the game server and the widget.',
  },
  {
    icon: Zap,
    title: 'Instant settlement',
    description: 'Winnings hit your wallet automatically. No withdrawal request, no waiting.',
  },
  {
    icon: Scale,
    title: 'Fair dispute resolution',
    description: 'Contest any result within 24 hours. An admin reviews the evidence and decides.',
  },
  {
    icon: BarChart2,
    title: 'Track your record',
    description: 'Win rate, net profit, and full bet history in your dashboard.',
  },
];

export function ForPlayers() {
  return (
    <section id="for-players" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text (left on desktop) */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">
              For Players
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-fg leading-tight">
              Bet on your skill. Get paid instantly.
            </h2>
            <p className="mt-4 text-lg text-fg-secondary">
              Every match is backed by escrow and verified by two independent sources. No shady dealings — just you, your opponent, and your skill.
            </p>

            <ul className="mt-8 space-y-6">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex gap-4">
                    <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600 dark:bg-brand-600/15">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">{feature.title}</h3>
                      <p className="mt-1 text-fg-secondary">{feature.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 mt-8 text-brand-600 hover:text-brand-700 font-semibold transition-colors"
            >
              Create your account
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Bet mockup card (right on desktop) */}
          <div className="lg:pl-8">
            <BetMockupCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function BetMockupCard() {
  return (
    <div
      className="relative rounded-2xl p-6 shadow-2xl max-w-md mx-auto"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Top: game label */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400">
            <Target size={22} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/50">Game</div>
            <div className="text-white font-semibold text-lg">Pool — 8-Ball</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-brand-600/15 px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75 animate-ping"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400"></span>
          </span>
          <span className="text-xs font-bold text-brand-400 tracking-wider">MATCHED</span>
        </div>
      </div>

      {/* vs line */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">Opponent</div>
        <div className="text-white font-semibold">vs. xKingSlayer99</div>
      </div>

      {/* Stake / Pot */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">Your stake</div>
          <div className="text-white font-bold text-2xl tabular-nums">$10.00</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">Total pot</div>
          <div className="text-brand-400 font-bold text-2xl tabular-nums">$20.00</div>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-[11px] uppercase tracking-widest text-white/50 mb-2">
          <span>Result verified in</span>
          <span className="text-brand-400 tabular-nums font-bold">00:45</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-brand-500 to-brand-400"></div>
        </div>
      </div>
    </div>
  );
}
