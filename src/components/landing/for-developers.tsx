'use client';

import Link from 'next/link';
import { Eye, ShieldCheck, Banknote, Clock, ArrowRight, Users, Gavel } from 'lucide-react';

const FEATURES = [
  {
    icon: Eye,
    title: 'Watch live matches',
    description: 'Spectate staked games in real-time and verify the outcome is fair.',
  },
  {
    icon: ShieldCheck,
    title: 'Validate results',
    description: 'Confirm the winner, flag disputes, and ensure every match is clean.',
  },
  {
    icon: Banknote,
    title: 'Earn per match',
    description: 'Get paid a fee from every match you referee. More matches = more earnings.',
  },
  {
    icon: Clock,
    title: 'Flexible schedule',
    description: 'Pick up matches whenever you want. No shifts, no minimums.',
  },
];

const STEPS = [
  { step: '01', title: 'Sign up as a referee', description: 'Create your account and opt in to the referee program.' },
  { step: '02', title: 'Get assigned matches', description: 'Receive notifications when staked matches need a referee.' },
  { step: '03', title: 'Watch & validate', description: 'Spectate the match live, confirm the result when it ends.' },
  { step: '04', title: 'Get paid', description: 'Earn your referee fee automatically after settlement.' },
];

export function ForDevelopers() {
  return (
    <section id="for-referees" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* How it works steps (left on desktop) */}
          <div className="order-2 lg:order-1">
            <HowItWorksCard />
          </div>

          {/* Text (right on desktop) */}
          <div className="order-1 lg:order-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">
              Become a Referee
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-fg leading-tight">
              Watch games. Verify results. Get paid.
            </h2>
            <p className="mt-4 text-lg text-fg-secondary">
              Nominate yourself to referee staked matches. You watch the game live, confirm the outcome is legit, and earn a fee from every match you officiate.
            </p>

            <ul className="mt-8 space-y-6">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex gap-4">
                    <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-[#06b6d4]/10 text-[#0891b2] dark:bg-[#06b6d4]/15 dark:text-[#22d3ee]">
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
              Sign up to referee
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksCard() {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl max-w-xl mx-auto"
      style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/15 text-brand-400">
          <Gavel size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">How Refereeing Works</p>
          <p className="text-xs text-white/40">4 simple steps to start earning</p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 py-5 space-y-5">
        {STEPS.map((s, i) => (
          <div key={s.step} className="flex gap-4">
            <div className="flex-shrink-0 flex flex-col items-center">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: 'rgba(6,182,212,0.12)',
                  color: '#22d3ee',
                  border: '1px solid rgba(6,182,212,0.25)',
                }}
              >
                {s.step}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px flex-1 mt-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
              )}
            </div>
            <div className="pt-1.5">
              <h4 className="text-sm font-semibold text-white/90">{s.title}</h4>
              <p className="mt-1 text-sm text-white/50 leading-relaxed">{s.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-white/40" />
          <span className="text-xs text-white/40">Open to all verified users</span>
        </div>
        <span className="text-xs font-mono text-brand-400">Earn per match</span>
      </div>
    </div>
  );
}
