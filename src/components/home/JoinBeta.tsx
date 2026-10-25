'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { FaqList } from '@/components/landing/faq';
import { BETA_FAVOURITE_GAMES } from '@/lib/games/catalogue';
import type { FaqItem } from '@/lib/faq';

const BEFORE_YOU_JOIN: FaqItem[] = [
  {
    id: 'beta-available',
    q: 'What is available in the beta?',
    a: "Live stream challenges on Kick in EA SPORTS FC 27 and Tekken 8, decided by independent referees. Everything runs with test money, so you can try it all without risk.",
  },
  {
    id: 'beta-games',
    q: 'Which games can I play?',
    a: 'EA SPORTS FC 27 and Tekken 8 for now, with more to follow. Tell us your game when you sign up and we will use it to decide what comes next.',
  },
  {
    id: 'beta-real-money',
    q: 'When will real-money play launch?',
    a: 'Real-money play is not available. It will only switch on once PlayStake is licensed by the Gambling Commission.',
  },
  {
    id: 'beta-who',
    q: 'Who can join?',
    a: 'Anyone aged 18 or over. When real-money play launches, you will need to verify your identity before you can deposit or play.',
    links: [{ href: '/faq', label: 'All questions' }],
  },
];

const field =
  'h-12 w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper-elevated px-4 text-sm text-ps-text outline-none focus:border-[var(--ps-lime)] dark:border-[var(--ps-border-dark)] dark:bg-ps-ink dark:text-ps-text-on-dark';

export function JoinBeta() {
  const [email, setEmail] = useState('');
  const [game, setGame] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      setState('error');
      return;
    }
    if (!consent) {
      setError('Tick the box so we can send you beta updates.');
      setState('error');
      return;
    }
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, ...(game ? { game } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(res.status === 429 ? 'Too many attempts. Please try again shortly.' : body.error || 'Something went wrong. Please try again.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <section id="join" className="scroll-mt-20">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="relative overflow-hidden rounded-[var(--ps-radius-lg)] border-2 border-[var(--ps-lime)] bg-ps-paper-elevated p-6 sm:p-8 dark:bg-ps-ink-2">
          <Image
            src="/home/photos/beta-controller.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover object-right opacity-25 dark:opacity-70"
          />
          {/* Keeps the form readable over the photo. */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-ps-paper-elevated via-ps-paper-elevated/85 to-ps-paper-elevated/30 dark:from-ps-ink-2 dark:via-ps-ink-2/85 dark:to-ps-ink-2/20"
            aria-hidden="true"
          />
          <h2 className="relative font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Be part of the beta.</h2>
          <p className="relative mt-2 text-lg text-ps-muted dark:text-ps-muted-on-dark">Get updates for the games you play.</p>

          {state === 'done' ? (
            <div className="relative mt-8 flex items-start gap-3 rounded-[var(--ps-radius-md)] bg-[var(--ps-lime)]/15 p-4" role="status">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-semibold">You&apos;re on the list.</span> We&apos;ve sent a confirmation to {email}.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="relative mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="beta-email" className="mb-1.5 block text-sm font-semibold">
                  Email address
                </label>
                <input
                  id="beta-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="beta-game" className="mb-1.5 block text-sm font-semibold">
                  Game interest <span className="font-normal text-ps-muted dark:text-ps-muted-on-dark">(optional)</span>
                </label>
                <select id="beta-game" value={game} onChange={(event) => setGame(event.target.value)} className={field}>
                  <option value="">Choose a game</option>
                  {BETA_FAVOURITE_GAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--ps-lime)]"
                />
                <span>
                  Send me beta updates. See our{' '}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {state === 'error' && (
                <p className="text-sm font-medium text-ps-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={state === 'sending'}
                className="h-12 w-full rounded-[var(--ps-radius-md)] bg-[var(--ps-lime)] text-sm font-bold text-ps-ink transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === 'sending' ? 'Joining…' : 'Join the beta'}
              </button>
              <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
                Test beta only. No real-money wagering. 18+. Unsubscribe at any time.
              </p>
            </form>
          )}
        </div>

        <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-6 sm:p-8 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2">
          <h2 className="mb-6 font-display text-4xl font-extrabold tracking-tight">Before you join</h2>
          <FaqList items={BEFORE_YOU_JOIN} />
        </div>
      </div>
    </section>
  );
}
