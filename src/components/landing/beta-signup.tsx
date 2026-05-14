'use client';

import { useState, type FormEvent } from 'react';

const GAMES = ['Pool / Snooker', 'Darts', 'Penalty Shootout', 'Other'] as const;
const PLAYER_TYPES = ['Player', 'Streamer', 'Investor', 'Developer', 'Partner'] as const;

type FormState = {
  name: string;
  email: string;
  game: string;
  type: string;
};

export function BetaSignup() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    game: '',
    type: '',
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: POST to /api/beta-signup (or Loops / Mailchimp integration)
    // Expected payload: { name, email, game, playerType }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section
        id="beta-signup"
        className="py-20 lg:py-28 bg-elevated"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="mx-auto max-w-lg px-4 text-center">
          <div className="text-5xl mb-4" role="img" aria-label="Gaming controller">
            🎮
          </div>
          <h2 className="font-display text-3xl font-extrabold text-fg mb-3">
            You're on the list.
          </h2>
          <p className="text-fg-secondary">
            We'll be in touch when beta access opens. Spread the word.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="beta-signup" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
              Join the Beta
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg">
              Get Early Access
            </h2>
            <p className="mt-3 text-fg-secondary max-w-md mx-auto">
              Be the first to play when we launch. Early players shape the product.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="beta-name"
                  className="block text-sm font-medium text-fg-secondary mb-1.5"
                >
                  Name
                </label>
                <input
                  id="beta-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-4 transition-colors"
                  aria-required="true"
                />
              </div>
              <div>
                <label
                  htmlFor="beta-email"
                  className="block text-sm font-medium text-fg-secondary mb-1.5"
                >
                  Email
                </label>
                <input
                  id="beta-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-11 px-4 transition-colors"
                  aria-required="true"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="beta-game"
                  className="block text-sm font-medium text-fg-secondary mb-1.5"
                >
                  Favourite Game
                </label>
                <select
                  id="beta-game"
                  name="game"
                  required
                  value={form.game}
                  onChange={(e) => setForm({ ...form, game: e.target.value })}
                  className="w-full h-11 px-4 transition-colors appearance-none"
                  aria-required="true"
                >
                  <option value="" disabled>
                    Select a game
                  </option>
                  {GAMES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="beta-type"
                  className="block text-sm font-medium text-fg-secondary mb-1.5"
                >
                  I am a…
                </label>
                <select
                  id="beta-type"
                  name="playerType"
                  required
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full h-11 px-4 transition-colors appearance-none"
                  aria-required="true"
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {PLAYER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-lg bg-brand-500 text-surface-950 font-bold text-sm tracking-wide transition-all btn-glow-hover hover:bg-brand-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
            >
              Request Beta Access
            </button>

            <p className="text-center text-xs text-fg-muted">
              No spam. Unsubscribe any time. Your data is never shared.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
