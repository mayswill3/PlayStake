import Link from 'next/link';
import {
  Send, UserCheck, Gamepad2, Bot, User, Trophy,
  Check, Shield, CheckCircle2, ArrowRight, ArrowDown, TrendingUp,
} from 'lucide-react';
import { LandingNav } from '@/components/landing/nav';
import { Footer } from '@/components/layout/Footer';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STEPS_BEFORE_FORK = [
  {
    num: '01',
    title: 'Send a Bet Request',
    icon: Send,
    accent: '#22c55e',
    accentBg: 'rgba(34,197,94,0.12)',
    description:
      'Challenge a friend or another player to a match on any supported game including EAFC 26, Tic-Tac-Toe, Higher/Lower, and more. Pick your game and set the stake amount.',
    chips: ['Choose the game', 'Set the stake amount', 'Opponent gets notified'],
  },
  {
    num: '02',
    title: 'Opponent Accepts',
    icon: UserCheck,
    accent: '#06b6d4',
    accentBg: 'rgba(6,182,212,0.12)',
    description:
      'Your opponent receives the challenge and accepts. The moment they accept, both stakes are locked in escrow and neither player can access the funds until the match is decided.',
    chips: ['Stake locked in escrow instantly', 'Both players confirmed', 'Safe to cancel before opponent accepts'],
  },
  {
    num: '03',
    title: 'Load the Game',
    icon: Gamepad2,
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.12)',
    description:
      'Both players launch the game on their preferred platform. PlayStake runs in the background on your phone, tablet, or browser with no need to switch devices mid-match.',
    chips: ['TV, console, mobile, or PC', 'Keep PlayStake open in background', 'Fund your wallet before you start'],
  },
];

const AI_CHIPS = ['Screen recording required', 'Confirmed in seconds', 'Available 24/7'];
const HUMAN_CHIPS = ['Live match spectator', 'Manual confirmation', 'Avg. match found in under 5 mins'];

const STEP_06 = {
  num: '06',
  title: 'Referee Confirms & Pays Out',
  icon: Trophy,
  accent: '#10b981',
  accentBg: 'rgba(16,185,129,0.12)',
  description:
    'Once the game ends, the referee confirms the final result. The winner\'s payout is released from escrow and lands in their PlayStake wallet instantly. No disputes, no waiting.',
  chips: ['Winner paid instantly', 'Disputes handled within 24 hrs', 'Disconnect protection included'],
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepBadge({ num, accent }: { num: string; accent: string }) {
  return (
    <div
      className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold tabular-nums"
      style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}40` }}
    >
      {num}
    </div>
  );
}

function Connector({ accent = 'rgba(255,255,255,0.1)' }: { accent?: string }) {
  return (
    <div className="flex justify-start pl-5">
      <div className="w-px h-8" style={{ background: accent }} />
    </div>
  );
}

function StepCard({
  num, title, icon: Icon, accent, accentBg, description, chips,
}: {
  num: string;
  title: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
  description: string;
  chips: string[];
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex flex-col items-center flex-shrink-0">
        <StepBadge num={num} accent={accent} />
      </div>
      <div className="flex-1 rounded-2xl border border-themed bg-card p-6 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: accentBg, color: accent }}
          >
            <Icon size={20} strokeWidth={2} />
          </div>
          <h3 className="font-display text-lg font-bold text-fg">{title}</h3>
        </div>
        <p className="text-fg-secondary text-sm leading-relaxed mb-4">{description}</p>
        <ul className="space-y-1.5">
          {chips.map((chip) => (
            <li key={chip} className="flex items-center gap-2 text-sm" style={{ color: accent }}>
              <Check size={13} strokeWidth={2.5} />
              <span className="text-fg-secondary">{chip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page sections
// ---------------------------------------------------------------------------

function PageHero() {
  return (
    <section className="bg-page pt-16 pb-20 lg:pt-24 lg:pb-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-4">
          The Full Process
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-fg">
          From challenge to{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' }}
          >
            cash
          </span>
          {', every step explained.'}
        </h1>
        <p className="mt-6 text-lg text-fg-secondary max-w-xl mx-auto">
          PlayStake handles the entire wagering flow, from the initial challenge through referee assignment and instant payout. Here is exactly how it works.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <Shield size={15} className="text-brand-600" />
            Escrowed funds
          </div>
          <div className="hidden sm:block w-px h-4 bg-border-themed" />
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <CheckCircle2 size={15} className="text-brand-600" />
            Dual-source verification
          </div>
          <div className="hidden sm:block w-px h-4 bg-border-themed" />
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <TrendingUp size={15} className="text-brand-600" />
            Instant payouts
          </div>
        </div>
      </div>
    </section>
  );
}

function StepsTimeline() {
  return (
    <section className="bg-elevated py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">

        {/* Steps 01 – 03 */}
        {STEPS_BEFORE_FORK.map((step, i) => (
          <div key={step.num}>
            <StepCard {...step} />
            {i < STEPS_BEFORE_FORK.length - 1 && <Connector accent={step.accent + '40'} />}
          </div>
        ))}

        {/* Connector into fork */}
        <Connector accent="rgba(6,182,212,0.3)" />

        {/* Step 04 — Select Referee */}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center flex-shrink-0">
            <StepBadge num="04" accent="#06b6d4" />
          </div>
          <div className="flex-1 rounded-2xl border border-themed bg-card p-6 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}
              >
                <Shield size={20} strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-fg">Select Your Referee</h3>
                <p className="text-xs text-fg-muted">Both players must agree before the match starts</p>
              </div>
            </div>
            <p className="text-fg-secondary text-sm leading-relaxed">
              Before play begins, both players choose how the match will be monitored. You can either use the instant AI referee or wait for a verified human referee to be assigned.
            </p>
          </div>
        </div>

        {/* Fork — 05a and 05b side by side */}
        <div className="pl-14 mt-4">
          <div className="grid sm:grid-cols-2 gap-4">

            {/* 05a — AI Referee */}
            <div className="rounded-2xl border border-themed bg-card overflow-hidden flex flex-col">
              <div className="h-1" style={{ background: 'linear-gradient(90deg, #06b6d4, #0891b2)' }} />
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee' }}
                  >
                    <Bot size={20} strokeWidth={1.75} />
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee' }}
                  >
                    05a · Automated
                  </span>
                </div>
                <h4 className="font-display text-base font-bold text-fg mb-1">AI Referee</h4>
                <p className="text-sm text-fg-secondary leading-relaxed flex-1 mb-4">
                  The AI engine monitors your screen recording in real time. Once recording is confirmed, you are cleared to start immediately.
                </p>
                <ul className="space-y-1.5">
                  {AI_CHIPS.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm">
                      <Check size={12} strokeWidth={2.5} className="flex-shrink-0" style={{ color: '#22d3ee' }} />
                      <span className="text-fg-secondary">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 05b — Human Referee */}
            <div className="rounded-2xl border border-themed bg-card overflow-hidden flex flex-col">
              <div className="h-1" style={{ background: 'linear-gradient(90deg, #22c55e, #16a34a)' }} />
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}
                  >
                    <User size={20} strokeWidth={1.75} />
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}
                  >
                    05b · Community
                  </span>
                </div>
                <h4 className="font-display text-base font-bold text-fg mb-1">Human Referee</h4>
                <p className="text-sm text-fg-secondary leading-relaxed flex-1 mb-4">
                  A verified human referee is matched to your game. They join the lobby and confirm when both players are ready to start.
                </p>
                <ul className="space-y-1.5">
                  {HUMAN_CHIPS.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm">
                      <Check size={12} strokeWidth={2.5} className="flex-shrink-0" style={{ color: '#4ade80' }} />
                      <span className="text-fg-secondary">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          {/* Converge arrow */}
          <div className="flex justify-center mt-4 text-fg-muted">
            <ArrowDown size={20} strokeWidth={1.5} />
          </div>
        </div>

        {/* Connector into step 06 */}
        <Connector accent="rgba(16,185,129,0.3)" />

        {/* Step 06 */}
        <StepCard {...STEP_06} />

      </div>
    </section>
  );
}

function PageCta() {
  return (
    <section className="bg-page py-20 lg:py-28">
      <div className="mx-auto max-w-xl px-4 sm:px-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-4">
          Ready to play?
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-fg">
          Your first bet is one challenge away.
        </h2>
        <p className="mt-4 text-fg-secondary">
          Create your account, fund your wallet, and challenge anyone to a match in under two minutes.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 active:scale-[0.98] transition-all w-full sm:w-auto"
          >
            Get Started
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-12 px-6 rounded-lg border border-themed text-fg-secondary hover:text-fg hover:bg-elevated transition-all w-full sm:w-auto text-sm font-medium"
          >
            Back to Home
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <TrendingUp size={14} className="text-brand-600" />
            Escrowed &amp; secure
          </div>
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <CheckCircle2 size={14} className="text-brand-600" />
            Instant payouts
          </div>
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Shield size={14} className="text-brand-600" />
            Dispute protection
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-page text-fg">
      <LandingNav />
      <PageHero />
      <StepsTimeline />
      <PageCta />
      <Footer />
    </main>
  );
}
