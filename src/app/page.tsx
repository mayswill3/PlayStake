import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  ArrowRight,
  Gamepad2,
  Radio,
  ShieldCheck,
  Swords,
} from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Spinner } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: 'Log in | PlayStake',
  description: 'Log in to your PlayStake account.',
};

export default function HomePage() {
  const features = [
    {
      icon: Swords,
      title: 'Challenge real players',
      description: 'Set a stake and compete head-to-head.',
    },
    {
      icon: Radio,
      title: 'Play live with Kick',
      description: 'Connect your channel and accept viewer challenges.',
    },
    {
      icon: ShieldCheck,
      title: 'Protected stakes',
      description: 'Funds are held securely until the result is settled.',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-ps-paper text-ps-text dark:bg-ps-ink dark:text-ps-text-on-dark">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -left-52 -top-52 h-[620px] w-[620px] rounded-full"
          style={{ background: 'var(--ps-lime-20)', filter: 'blur(130px)' }}
        />
        <div
          className="absolute -right-40 top-1/3 h-[520px] w-[520px] rounded-full"
          style={{ background: 'var(--ps-cyan-10)', filter: 'blur(120px)' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(95,220,178,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(95,220,178,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <header className="relative z-10 border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-lime"
          >
            <Image
              src="/logo.png"
              alt="PlayStake"
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
            <span className="font-display text-xl font-bold">PlayStake</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/learn-more"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ps-muted transition-colors hover:bg-ps-paper-elevated hover:text-ps-text dark:text-ps-muted-on-dark dark:hover:bg-ps-ink-2 dark:hover:text-ps-text-on-dark"
            >
              Learn more
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/register"
              className="hidden h-10 items-center rounded-lg bg-ps-lime px-4 text-sm font-semibold text-ps-ink transition-colors hover:bg-ps-lime-strong sm:inline-flex"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:px-8 lg:py-16">
        <section className="order-2 lg:order-1">
          <span className="mb-5 inline-flex items-center rounded-full bg-ps-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white dark:border dark:border-[var(--ps-border-dark)]">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-ps-lime" />
            Skill-based competitive play
          </span>

          <h1
            className="max-w-2xl font-display font-extrabold leading-[1.04] tracking-tight"
            style={{ fontSize: 'clamp(2.35rem, 5vw, 4rem)' }}
          >
            Put your skill
            <span className="block ps-gradient-text">on the line.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-ps-muted dark:text-ps-muted-on-dark sm:text-lg">
            Challenge another player, agree the stake, play your game and let
            the result decide who wins. No house betting—just player versus
            player.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-xl border border-[var(--ps-border-light)] bg-white/70 p-4 shadow-ps-shadow-sm backdrop-blur-sm dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2/75"
                >
                  <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-ps-lime/15 text-ps-lime-strong dark:text-ps-lime">
                    <Icon size={18} />
                  </span>
                  <h2 className="font-display text-sm font-semibold">
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-ps-muted dark:text-ps-muted-on-dark">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-[var(--ps-border-light)] bg-ps-ink p-5 text-white shadow-ps-shadow-md dark:border-[var(--ps-border-dark)]">
            <div className="flex items-center gap-2">
              <Gamepad2 className="text-ps-lime" size={19} />
              <h2 className="font-display text-sm font-semibold">
                From challenge to payout
              </h2>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-4">
              {['Pick a game', 'Agree a stake', 'Play the match', 'Winner paid'].map(
                (step, index) => (
                  <li key={step} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ps-lime/40 bg-ps-lime/10 font-mono text-[10px] font-bold text-ps-lime">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ),
              )}
            </ol>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-ps-muted dark:text-ps-muted-on-dark">
            Play responsibly. Only stake what you can afford, and always check
            local eligibility requirements.
          </p>
        </section>

        <section className="order-1 mx-auto w-full max-w-md lg:order-2">
          <div className="mb-5 text-center lg:text-left">
            <p className="text-sm font-semibold text-ps-lime-strong dark:text-ps-lime">
              Player access
            </p>
            <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
              Sign in to play, stream and manage your challenges.
            </p>
          </div>

          <div className="rounded-[1.15rem] bg-gradient-to-br from-ps-lime/70 via-ps-lime/20 to-ps-cyan/70 p-px shadow-ps-glow">
            <Suspense
              fallback={
                <div className="flex min-h-96 items-center justify-center rounded-[calc(1.15rem-1px)] bg-card">
                  <Spinner size="lg" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ps-muted dark:text-ps-muted-on-dark">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-ps-lime" />
              Secure account access
            </span>
            <span>No account?</span>
            <Link
              href="/register"
              className="font-semibold text-ps-lime-strong hover:underline dark:text-ps-lime"
            >
              Join PlayStake
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--ps-border-light)] py-5 dark:border-[var(--ps-border-dark)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-ps-muted dark:text-ps-muted-on-dark sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} PlayStake</span>
          <span>Skill decides the winner.</span>
        </div>
      </footer>
    </div>
  );
}
