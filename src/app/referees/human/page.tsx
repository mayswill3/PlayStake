import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { User, ArrowLeft, ArrowRight, Gavel, Eye, Banknote, AlertTriangle, CheckCircle2, Users, Star } from 'lucide-react';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata({
  title: 'Become a Human Game Referee',
  description:
    'Learn how PlayStake human referees watch live matches, verify results, flag disputes, build an officiating record, and earn a disclosed fee.',
  path: '/referees/human',
});

const STEPS = [
  { n: '01', label: 'Sign up as a referee', desc: 'Create your PlayStake account, connect Kick, complete identity verification, and apply from the Referee Hub.' },
  { n: '02', label: 'Receive a match notification', desc: 'When a staked match starts that needs a human referee, all opted-in referees get a notification. The first to accept takes the match.' },
  { n: '03', label: 'Watch both streams', desc: 'Go live on your own Kick channel, check both players are live on the declared game, then start the match and watch both of their streams until it ends.' },
  { n: '04', label: 'Record the result', desc: 'Record the winner, or a draw if the streams don’t show who won, with notes on what decided it. Players then have 15 minutes to dispute your call.' },
  { n: '05', label: 'Get paid', desc: 'Your referee fee is automatically credited to your PlayStake wallet after settlement. Withdraw it any time through the standard process.' },
];

const FAQS = [
  {
    q: 'How much do I earn per match?',
    a: 'The referee receives 10% of the platform fee, not 10% of the players’ pot. The amount depends on the stake and game fee and is shown with the match.',
  },
  {
    q: 'Can I referee any game?',
    a: 'When you apply, you choose the games you know well. PlayStake reviews your application and approves you game by game, and you are only offered matches in games you are approved for.',
  },
  {
    q: 'What if I make a wrong call?',
    a: 'Either player can file a dispute. If your decision is overturned on review, the match outcome is corrected and your referee record is updated. Repeated incorrect calls may result in suspension from the programme. PlayStake reviews all disputes fairly.',
  },
  {
    q: 'How many matches can I referee?',
    a: 'There is no minimum. You officiate one match at a time, and only claim a match when you can start it within 5 minutes. You are never penalised for not claiming a match.',
  },
];

export default function HumanRefereePage() {
  return (
    <div className="min-h-screen bg-page text-fg">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-themed backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/learn-more#for-referees" className="flex items-center gap-2 text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link href="/learn-more" className="flex items-center gap-2">
            <Image src="/logo.png" alt="PlayStake" width={32} height={32} className="h-8 w-8" />
            <span className="font-display text-lg font-bold text-fg">PlayStake</span>
          </Link>
          <Link
            href="/referee"
            className="h-9 px-4 inline-flex items-center rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d1f14 0%, #0a2018 60%, #0d1117 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 60% 0%, #22c55e 0%, transparent 60%)' }} />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="flex flex-col items-start gap-6 max-w-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <User size={32} style={{ color: '#4ade80' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4ade80' }}>Community-driven</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">Human Referee</h1>
              <p className="mt-4 text-lg text-white/60 leading-relaxed">
                Watch live matches, confirm results, and earn a fee for every match you officiate. No shifts, no minimums, no special equipment.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-semibold text-sm transition-colors"
              style={{ background: '#16a34a', color: '#fff' }}
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
        <Section icon={<Users size={20} />} color="green" title="What is a Human Referee?">
          <p>
            Human referees are verified PlayStake community members who watch live matches and confirm the outcome is legitimate. Human referees handle refereed matches on PlayStake today; an automated AI Referee is in development to take on routine validations, with humans staying in the loop wherever live judgement matters.
          </p>
          <p>
            You are not making rulings on complex edge cases from scratch. The match gives you everything you need: a live spectator view, the game state, and both players&apos; actions. Your job is to confirm what you saw.
          </p>
        </Section>

        {/* Step by step */}
        <section>
          <SectionHeader icon={<Gavel size={20} />} color="green" title="How it works, step by step" />
          <div className="mt-6 space-y-4">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div
                  className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
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

        {/* What you do */}
        <Section icon={<Eye size={20} />} color="green" title="What you actually do">
          <p>
            Once you claim a match, the Referee Hub shows both players&apos; Kick streams side by side. Go live on your own Kick channel so the call is made in the open, confirm both players are live on the declared game, and start the match. You watch. You do not interfere.
          </p>
          <p>
            When the match ends, record the result with notes on what decided it. Players then have 15 minutes to dispute your call, and the stakes stay in escrow until that time has passed.
          </p>
          <ul className="mt-3 space-y-2">
            {[
              'Both players’ live streams side by side',
              'Your call is made live on your own Kick stream',
              'Written notes with every decision: the score and any key moments',
              'A tamper-evident record of every step you take',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                <CheckCircle2 size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
        </Section>

        {/* Earnings */}
        <Section icon={<Banknote size={20} />} color="green" title="How earnings work">
          <p>
            Every match you successfully referee earns you a fee. The fee is taken from the platform fee — not from the players. Players never pay extra because a human referee is assigned. You are paid by PlayStake, not by either player.
          </p>
          <p>
            Fees are credited to your PlayStake wallet automatically after settlement. The exact amount is shown before you accept each match, so you always know what you are earning. There are no payment delays — once the match settles, the fee is yours.
          </p>
          <p>
            Withdraw your earnings any time through the standard wallet withdrawal process. No minimum balance required.
          </p>
        </Section>

        {/* Disputes */}
        <Section icon={<AlertTriangle size={20} />} color="green" title="Handling disputes">
          <p>
            If something looks wrong during a match — a suspicious disconnect, a player claiming a rule was broken, behaviour that looks like cheating — write down what you saw, with the time on stream, in your decision notes. Do not guess or feel pressured by either player.
          </p>
          <p>
            If you cannot tell from the streams who won, record a draw and explain why. Either player can dispute your call within 15 minutes; the PlayStake team then reviews both streams, match chat and your notes, and either upholds or corrects the result.
          </p>
          <p>
            Every referee follows the{' '}
            <Link href="/match-rules#referees" className="font-semibold text-fg underline underline-offset-2">
              Referee Code of Conduct
            </Link>
            , which you accept when you apply.
          </p>
        </Section>

        {/* How to qualify */}
        <Section icon={<Star size={20} />} color="green" title="How to qualify">
          <p>
            Any PlayStake user aged 18 or over can apply. There are no formal qualifications and no minimum hours. PlayStake reviews every application before you can officiate.
          </p>
          <p>
            You need a verified identity, a connected Kick account you can go live on, a good knowledge of the games you want to referee, and good standing on the platform. You must be independent of the players in any match you officiate.
          </p>
          <ul className="mt-3 space-y-2">
            {[
              'Completed PlayStake identity verification',
              'A connected Kick account',
              'Approval for each game you officiate',
              'Acceptance of the Referee Code of Conduct',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-fg-secondary">
                <CheckCircle2 size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
        </Section>

        {/* FAQ */}
        <section>
          <SectionHeader icon={<Users size={20} />} color="green" title="Frequently asked questions" />
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
          <h2 className="font-display text-xl font-bold text-fg mb-2">Ready to start earning?</h2>
          <p className="text-sm text-fg-secondary mb-5">Sign up, opt in to the referee programme, and start picking up matches today.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-semibold text-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Open Referee Hub
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Back link */}
        <div className="text-center pb-4">
          <Link href="/learn-more#for-referees" className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg transition-colors">
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
