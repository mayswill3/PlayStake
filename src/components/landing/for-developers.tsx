'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bot, User, CheckCircle2, Zap, Shield, Clock, Eye, Banknote, ArrowRight, Gavel, Users, Brain, AlertTriangle, FileCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

const AI_FEATURES = [
  'Watches game state in real-time',
  'Auto-validates results instantly',
  'Available 24/7, no scheduling',
  'Cryptographically audited log',
];

const HUMAN_FEATURES = [
  'Watch matches live as they happen',
  'Confirm the winner manually',
  'Earn a fee for every match',
  'Flexible, pick up matches when you want',
];

const STEPS = [
  { step: '01', title: 'Sign up as a referee', description: 'Create your account and opt in to the referee program.' },
  { step: '02', title: 'Get assigned matches', description: 'Receive notifications when staked matches need a referee.' },
  { step: '03', title: 'Watch & validate', description: 'Spectate the match live, confirm the result when it ends.' },
  { step: '04', title: 'Get paid', description: 'Earn your referee fee automatically after settlement.' },
];

export function ForDevelopers() {
  const [showAiModal, setShowAiModal] = useState(false);
  const [showHumanModal, setShowHumanModal] = useState(false);

  return (
    <section id="for-referees" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="text-center mb-12">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">
            Become a Referee
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-fg leading-tight">
            Watch games. Verify results. Get paid.
          </h2>
          <p className="mt-4 text-lg text-fg-secondary max-w-2xl mx-auto">
            Every match needs a referee. Choose your style: automated AI or a human referee.
          </p>
        </div>

        {/* Two referee type cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {/* AI Referee Card */}
          <div className="relative rounded-2xl border border-themed bg-card overflow-hidden flex flex-col">
            <div className="h-1 bg-gradient-to-r from-[#06b6d4] to-[#0891b2]" />
            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#06b6d4]/10 text-[#0891b2] dark:bg-[#06b6d4]/15 dark:text-[#22d3ee]">
                  <Bot size={24} strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#06b6d4]/10 text-[#0891b2] dark:bg-[#06b6d4]/15 dark:text-[#22d3ee]">
                  Automated
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-fg mb-1">AI Referee</h3>
              <p className="text-sm text-fg-secondary mb-5">
                Instant, unbiased, always on. The AI engine validates results directly from game data. No human needed.
              </p>

              <ul className="space-y-2.5 flex-1 mb-6">
                {AI_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                    <CheckCircle2 size={15} className="flex-shrink-0 text-[#22d3ee]" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setShowAiModal(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#0891b2] dark:text-[#22d3ee] hover:opacity-80 transition-opacity"
              >
                How AI refereeing works
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Human Referee Card */}
          <div className="relative rounded-2xl border border-themed bg-card overflow-hidden flex flex-col">
            <div className="h-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a]" />
            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-400">
                  <User size={24} strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-400">
                  Community-driven
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-fg mb-1">Human Referee</h3>
              <p className="text-sm text-fg-secondary mb-5">
                Watch live matches, confirm results, and earn a fee from every match you officiate. No shifts, no minimums.
              </p>

              <ul className="space-y-2.5 flex-1 mb-6">
                {HUMAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                    <CheckCircle2 size={15} className="flex-shrink-0 text-brand-500 dark:text-brand-400" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setShowHumanModal(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:opacity-80 transition-opacity"
              >
                How human refereeing works
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* How it works steps */}
        <div className="max-w-xl mx-auto">
          <HowItWorksCard />
        </div>

        {/* Sign up CTA */}
        <div className="text-center mt-10">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold transition-colors"
          >
            Sign up to referee
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* AI Referee Modal */}
      <Dialog open={showAiModal} onClose={() => setShowAiModal(false)} title="How AI Refereeing Works">
        <div className="space-y-5 mt-1">
          <ModalSection
            icon={<Brain size={16} />}
            color="cyan"
            heading="What it is"
            body="A rules engine connected directly to the game session. It reads game state events in real-time (scores, turns, outcomes) and verifies the reported result matches the actual game data before any settlement is triggered."
          />
          <ModalSection
            icon={<Shield size={16} />}
            color="cyan"
            heading="Why it's reliable"
            body="No human error, no bias, no subjectivity. The AI applies the same rules to every match, every time. Every decision is logged to an immutable audit trail cryptographically tied to the bet ID."
          />
          <ModalSection
            icon={<Zap size={16} />}
            color="cyan"
            heading="How it's triggered"
            body="When a match ends, the AI referee runs automatically within seconds. If the result is clean, settlement proceeds immediately. If an anomaly is detected, the match is flagged for human review before any funds move."
          />
          <ModalSection
            icon={<FileCheck size={16} />}
            color="cyan"
            heading="Trust & transparency"
            body="Every AI decision produces a signed verification record. Players can view the full audit log for their match at any time: exactly what was checked, what was found, and what decision was made."
          />
        </div>
      </Dialog>

      {/* Human Referee Modal */}
      <Dialog open={showHumanModal} onClose={() => setShowHumanModal(false)} title="How Human Refereeing Works">
        <div className="space-y-5 mt-1">
          <ModalSection
            icon={<Users size={16} />}
            color="green"
            heading="What it is"
            body="Verified PlayStake community members who sign up to watch live matches and confirm the outcome is legitimate. Human referees bring real judgement to edge cases that automated systems can't always resolve."
          />
          <ModalSection
            icon={<Gavel size={16} />}
            color="green"
            heading="How you get assigned"
            body="When a match starts that needs a human referee, all opted-in referees receive a notification. The first to accept gets the match. You can accept as many or as few as you like, with no minimum commitment."
          />
          <ModalSection
            icon={<Eye size={16} />}
            color="green"
            heading="What you do"
            body="Watch the match live via the spectator view. When it ends, confirm the winner. If something looks wrong (a disconnect, a rule dispute, suspicious behaviour), flag it and a full dispute review is triggered."
          />
          <ModalSection
            icon={<Banknote size={16} />}
            color="green"
            heading="How you earn"
            body="A referee fee is automatically credited to your wallet after settlement. The fee comes from the platform, not from the players. More matches refereed = more earnings. Payouts follow the standard withdrawal process."
          />
          <ModalSection
            icon={<AlertTriangle size={16} />}
            color="green"
            heading="Who can do it"
            body="Any verified PlayStake user can apply to become a referee. No special equipment or skills required — just a stable internet connection and a working knowledge of the game you're officiating."
          />
        </div>
      </Dialog>
    </section>
  );
}

function ModalSection({
  icon,
  color,
  heading,
  body,
}: {
  icon: React.ReactNode;
  color: 'cyan' | 'green';
  heading: string;
  body: string;
}) {
  const iconClass = color === 'cyan'
    ? 'text-[#22d3ee] bg-[#06b6d4]/15'
    : 'text-brand-400 bg-brand-400/15';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${iconClass}`}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-text-primary font-sans">{heading}</h3>
      </div>
      <p className="text-sm text-text-secondary font-sans leading-relaxed pl-8">{body}</p>
    </div>
  );
}

function HowItWorksCard() {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl"
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

      {/* Footer */}
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
