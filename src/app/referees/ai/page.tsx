import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Bot, ArrowLeft, ArrowRight, Shield, Zap, FileCheck, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'AI Game Referee — In Development',
  description:
    'The AI Referee is in development. See how PlayStake’s planned automated validator will check match results against game events, preserve audit trails, and escalate anomalies for human review.',
  path: '/referees/ai',
});

const HOW_IT_WORKS_STEPS = [
  { n: '01', label: 'Match starts', desc: 'Both players accept the bet and the game session begins. The AI referee will activate and listen to game state events.' },
  { n: '02', label: 'AI watches in real time', desc: 'Every score, turn, and outcome event will be streamed directly from the game to the validation engine. Nothing self-reported.' },
  { n: '03', label: 'Match ends', desc: 'The game session closes and the AI will receive the final state snapshot.' },
  { n: '04', label: 'Validation runs', desc: 'The AI will cross-reference the reported result against the full event log. Scores, win conditions, and rule constraints all checked.' },
  { n: '05', label: 'Settlement or escalation', desc: 'If everything checks out, settlement proceeds immediately. If an anomaly is detected, the match will be held and escalated to a human reviewer before any funds move.' },
];

const FAQS = [
  {
    q: 'When will the AI Referee launch?',
    a: 'It is in development now. Before it settles any real match it will run in shadow mode alongside our existing verification, and it goes live only once its decisions match confirmed outcomes across historical matches. Until then, every match is verified the way it is today: independent result reports from the game server and the player’s client, with human referees and reviewers handling anything that doesn’t line up.',
  },
  {
    q: 'Will the AI be able to make a wrong call?',
    a: 'The design is deterministic rules applied to verifiable game data — not a model making probabilistic guesses — so it cannot misinterpret what the game reported. If there is a data integrity issue (connectivity loss, corrupted state), the match will be flagged for human review rather than settled.',
  },
  {
    q: 'What games will support AI refereeing?',
    a: 'The validator is being built first for the PlayStake-built games (Darts 501, Tic-Tac-Toe, Higher/Lower, and others), where we control the full event stream. Games built on the PlayStake SDK that emit the standard event format will follow.',
  },
  {
    q: 'What happens if there is a dispute after AI settlement?',
    a: 'Players will be able to file a dispute within 24 hours of settlement, exactly as they can today. The full AI audit log will be pulled into the review. If the log confirms the decision was correct, the dispute is closed. If a data error is found, funds are adjusted accordingly.',
  },
  {
    q: 'Who will be able to see the audit log?',
    a: 'Both players in a match will be able to view the full audit record for their specific bet. The log will show every event that was checked, the rules that were applied, and the final decision, tied to the bet ID and unalterable after the fact.',
  },
];

export default function AiRefereePage() {
  return (
    <div className="min-h-screen bg-page text-fg">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-themed backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/#for-referees" className="flex items-center gap-2 text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link href="/learn-more" className="flex items-center gap-2">
            <Image src="/logo.png" alt="PlayStake" width={32} height={32} className="h-8 w-8" />
            <span className="font-display text-lg font-bold text-fg">PlayStake</span>
          </Link>
          <Link
            href="/register"
            className="h-9 px-4 inline-flex items-center rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0e1e2e 0%, #0a2a3a 60%, #0d1117 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 60% 0%, #06b6d4 0%, transparent 60%)' }} />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="flex flex-col items-start gap-6 max-w-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}>
              <Bot size={32} style={{ color: '#22d3ee' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#22d3ee' }}>In development</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">AI Referee</h1>
              <p className="mt-4 text-lg text-white/60 leading-relaxed">
                We are building an automated rules engine that will watch matches in real time, validate results against verified game data, and trigger settlement in seconds. This page describes what&apos;s coming — it is not live yet.
              </p>
            </div>
            <Link
              href="/referees/human"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-semibold text-sm transition-colors"
              style={{ background: '#0891b2', color: '#fff' }}
            >
              Referee matches today
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* Current status */}
        <div className="rounded-2xl border border-themed bg-card p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#22d3ee' }}>How matches are verified today</p>
          <p className="text-sm text-fg-secondary leading-relaxed">
            The AI Referee is not yet running on PlayStake. Right now, every match is verified by two independent result reports — one from the game server and one from the player&apos;s client — and any mismatch automatically opens a dispute held by a human reviewer before funds move. Human referees cover matches where live judgement matters. The AI Referee will be added on top of this system, not in place of it.
          </p>
        </div>

        {/* What is it */}
        <Section icon={<Brain size={20} />} color="cyan" title="What we're building">
          <p>
            The AI Referee will be a rules engine running server-side. It is not a chatbot or a machine learning model making probabilistic guesses. It is a deterministic validator: given a set of game events, it applies the game&apos;s rules and checks whether the reported result is consistent with what actually happened.
          </p>
          <p>
            Games built on the PlayStake SDK emit a structured stream of events — scores, moves, turn changes, win conditions. The validation engine will consume this stream directly, so players cannot alter it.
          </p>
        </Section>

        {/* How it works step by step */}
        <section>
          <SectionHeader icon={<Zap size={20} />} color="cyan" title="How it will work, step by step" />
          <div className="mt-6 space-y-4">
            {HOW_IT_WORKS_STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div
                  className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}
                >
                  {s.n}
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-fg">{s.label}</p>
                  <p className="mt-0.5 text-sm text-fg-secondary leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why unbiased */}
        <Section icon={<Shield size={20} />} color="cyan" title="Why it will be unbiased">
          <p>
            Human referees are subject to fatigue, favouritism, and inconsistency. The AI will apply exactly the same rules to every match, every time. There is no mood, no prior history with a player, and no financial incentive to skew a result.
          </p>
          <p>
            Decisions will be deterministic: the same input always produces the same output. This makes the system auditable in a way that human judgement fundamentally is not.
          </p>
          <ul className="mt-3 space-y-2">
            {['Same rules, every match', 'No fatigue or distraction', 'No relationship with either player', 'Fully auditable decision log'].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                <CheckCircle2 size={14} style={{ color: '#22d3ee', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
        </Section>

        {/* Audit trail */}
        <Section icon={<FileCheck size={20} />} color="cyan" title="The audit trail">
          <p>
            Every AI decision will produce a signed verification record tied to the bet ID. The record will contain the full event log that was evaluated, the rules that were applied to each event, the intermediate checks, and the final decision.
          </p>
          <p>
            Both players will be able to view their match&apos;s audit record at any time from the bet detail page. The record will be immutable: it cannot be edited after the fact, and the signature lets anyone verify the record has not been tampered with.
          </p>
          <p>
            This gives players a level of transparency that is impossible with a human referee: you will see exactly why you won or lost, not just that a referee said so.
          </p>
        </Section>

        {/* When AI flags a match */}
        <Section icon={<AlertTriangle size={20} />} color="cyan" title="When the AI will escalate to a human">
          <p>
            The AI will not force a settlement when it detects something it cannot confidently validate. The following situations will trigger an escalation to human review instead:
          </p>
          <ul className="mt-3 space-y-2">
            {[
              'Score mismatch between reported result and event log',
              'Missing or corrupted events (e.g. connectivity loss during match)',
              'Game ended in an unexpected state (e.g. mid-match disconnection)',
              'Replay or timing anomalies that suggest manipulation',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-fg-secondary">
                <span className="flex-shrink-0 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>!</span>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            When a match is escalated, funds remain in escrow. Both players are notified and the case is assigned to a human reviewer. Human referees stay in the system as the escalation path — automation is designed to reduce their load, never to remove the safety net.
          </p>
        </Section>

        {/* FAQ */}
        <section>
          <SectionHeader icon={<Brain size={20} />} color="cyan" title="Frequently asked questions" />
          <div className="mt-6 space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <p className="text-sm font-semibold text-fg">{faq.q}</p>
                <p className="mt-1.5 text-sm text-fg-secondary leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="rounded-2xl border border-themed bg-card p-8 text-center">
          <h2 className="font-display text-xl font-bold text-fg mb-2">Want to referee matches today?</h2>
          <p className="text-sm text-fg-secondary mb-5">Human refereeing is live now. Sign up as a referee and start earning from every match you officiate.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-semibold text-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Sign up to referee
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Back link */}
        <div className="text-center pb-4">
          <Link href="/#for-referees" className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg transition-colors">
            <ArrowLeft size={14} />
            Back to Become a Referee
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, color, title }: { icon: React.ReactNode; color: 'cyan' | 'green'; title: string }) {
  const iconStyle = color === 'cyan'
    ? { background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.2)' }
    : { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' };
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={iconStyle}>
        {icon}
      </span>
      <h2 className="font-display text-xl font-bold text-fg">{title}</h2>
    </div>
  );
}

function Section({ icon, color, title, children }: { icon: React.ReactNode; color: 'cyan' | 'green'; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeader icon={icon} color={color} title={title} />
      <div className="pl-12 space-y-3 text-sm text-fg-secondary leading-relaxed">
        {children}
      </div>
    </section>
  );
}
