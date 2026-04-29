import Link from 'next/link';
import Image from 'next/image';
import { Bot, ArrowLeft, ArrowRight, Shield, Zap, FileCheck, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'AI Referee — PlayStake',
  description: 'How the PlayStake AI Referee works: automated result validation, audit trails, and instant settlement.',
};

const HOW_IT_WORKS_STEPS = [
  { n: '01', label: 'Match starts', desc: 'Both players accept the bet and the game session begins. The AI referee is activated and begins listening to game state events.' },
  { n: '02', label: 'AI watches in real time', desc: 'Every score, turn, and outcome event is streamed directly from the game to the AI engine. Nothing is self-reported.' },
  { n: '03', label: 'Match ends', desc: 'The game session closes and the AI receives the final state snapshot.' },
  { n: '04', label: 'Validation runs', desc: 'The AI cross-references the reported result against the full event log. Scores, win conditions, and rule constraints are all checked.' },
  { n: '05', label: 'Settlement or escalation', desc: 'If everything checks out, settlement proceeds immediately. If an anomaly is detected, the match is held and escalated to a human reviewer before any funds move.' },
];

const FAQS = [
  {
    q: 'Can the AI be wrong?',
    a: 'The AI applies deterministic rules to verifiable game data — it cannot misinterpret what the game reported. If there is a data integrity issue (connectivity loss, corrupted state), the match is automatically flagged for human review rather than settled.',
  },
  {
    q: 'What games support AI refereeing?',
    a: 'All games built on the PlayStake SDK emit the standard event format the AI engine reads. Game developers can enable AI refereeing when registering their game. The PlayStake-built games (Darts 501, Tic-Tac-Toe, Higher/Lower, and others) support it by default.',
  },
  {
    q: 'What happens if there is a dispute after AI settlement?',
    a: 'Players can file a dispute within 24 hours of settlement. The full AI audit log is pulled into the review. If the log confirms the AI decision was correct, the dispute is closed. If a data error is found, funds are adjusted accordingly.',
  },
  {
    q: 'Who can see the audit log?',
    a: 'Both players in a match can view the full audit record for their specific bet at any time. The log shows every event that was checked, the rules that were applied, and the final decision. It is tied to the bet ID and cannot be altered after the fact.',
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
          <Link href="/" className="flex items-center gap-2">
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
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#22d3ee' }}>Automated</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">AI Referee</h1>
              <p className="mt-4 text-lg text-white/60 leading-relaxed">
                An automated rules engine that watches every match in real time, validates the result against verified game data, and triggers settlement in seconds. No human needed.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-semibold text-sm transition-colors"
              style={{ background: '#0891b2', color: '#fff' }}
            >
              Sign up to referee
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* What is it */}
        <Section icon={<Brain size={20} />} color="cyan" title="What is an AI Referee?">
          <p>
            The AI Referee is a rules engine that runs server-side for every match on PlayStake. It is not a chatbot or a machine learning model making probabilistic guesses. It is a deterministic validator: given a set of game events, it applies the game's rules and checks whether the reported result is consistent with what actually happened.
          </p>
          <p>
            Every game built on the PlayStake SDK emits a structured stream of events — scores, moves, turn changes, win conditions. The AI engine consumes this stream directly. Players cannot alter it.
          </p>
        </Section>

        {/* How it works step by step */}
        <section>
          <SectionHeader icon={<Zap size={20} />} color="cyan" title="How it works, step by step" />
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
        <Section icon={<Shield size={20} />} color="cyan" title="Why it's unbiased">
          <p>
            Human referees are subject to fatigue, favouritism, and inconsistency. The AI applies exactly the same rules to every match, every time. There is no mood, no prior history with a player, and no financial incentive to skew a result.
          </p>
          <p>
            Decisions are deterministic: the same input always produces the same output. This makes the system auditable in a way that human judgement fundamentally is not.
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
            Every AI decision produces a signed verification record tied to the bet ID. The record contains the full event log that was evaluated, the rules that were applied to each event, the intermediate checks, and the final decision.
          </p>
          <p>
            Both players can view their match's audit record at any time from the bet detail page. The record is immutable: it cannot be edited after the fact, and the signature lets anyone verify the record has not been tampered with.
          </p>
          <p>
            This gives players a level of transparency that is impossible with a human referee: you can see exactly why you won or lost, not just that a referee said so.
          </p>
        </Section>

        {/* When AI flags a match */}
        <Section icon={<AlertTriangle size={20} />} color="cyan" title="When the AI flags a match">
          <p>
            The AI does not force a settlement when it detects something it cannot confidently validate. The following situations trigger an escalation to human review instead:
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
            When a match is escalated, funds remain in escrow. Both players are notified and the case is assigned to a human reviewer. This prevents the AI from ever making a bad call under uncertainty.
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
          <h2 className="font-display text-xl font-bold text-fg mb-2">Ready to start?</h2>
          <p className="text-sm text-fg-secondary mb-5">Sign up as a referee and start earning from every match you officiate.</p>
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
