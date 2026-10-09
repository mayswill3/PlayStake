import { Gamepad2 } from 'lucide-react';
import { PlayButton, WatchButton } from './DemoVideo';

/** One side of the hero's head-to-head panel. */
function PlayerPanel({ side }: { side: 'one' | 'two' }) {
  const one = side === 'one';
  return (
    <div
      className="relative flex h-full items-center justify-center overflow-hidden"
      style={{
        background: one
          ? 'radial-gradient(120% 90% at 30% 30%, #1d4ed8 0%, #0b1e4a 45%, #060b18 100%)'
          : 'radial-gradient(120% 90% at 70% 30%, #0f766e 0%, #0a2e2b 45%, #060b18 100%)',
      }}
    >
      {/* Room glow and a controller, standing in for player photography. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: one
            ? 'radial-gradient(40% 30% at 70% 80%, rgba(56,189,248,.35), transparent)'
            : 'radial-gradient(40% 30% at 30% 80%, rgba(95,220,178,.35), transparent)',
        }}
        aria-hidden="true"
      />
      <Gamepad2
        className={`relative h-24 w-24 sm:h-28 sm:w-28 ${one ? 'text-sky-300/80 -rotate-12' : 'text-emerald-300/80 rotate-12'}`}
        strokeWidth={1.25}
        aria-hidden="true"
      />
      <span className="absolute left-3 top-3 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
        LIVE
      </span>
    </div>
  );
}

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-8 lg:px-8 lg:py-20">
        <div>
          <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Your game.
            <br />
            <span className="text-[var(--ps-lime-strong,#0f9f78)] dark:text-ps-text-on-dark">Head to head.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ps-muted dark:text-ps-muted-on-dark">
            Stake on your own matches against real players, with an independent referee deciding the result.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#join"
              className="inline-flex h-12 items-center justify-center rounded-[var(--ps-radius-md)] bg-[var(--ps-lime)] px-8 text-sm font-bold text-ps-ink transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-ink dark:focus-visible:ring-white"
            >
              Join the beta
            </a>
            <WatchButton video="full">Watch the demo</WatchButton>
          </div>
          <p className="mt-5 text-sm text-ps-muted dark:text-ps-muted-on-dark">
            Test beta only. No real-money wagering. 18+.
          </p>
        </div>

        <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--ps-radius-lg)] shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
          <div className="grid h-full grid-cols-2">
            <PlayerPanel side="one" />
            <PlayerPanel side="two" />
          </div>
          {/* The split between the two players. */}
          <div
            className="pointer-events-none absolute inset-y-[-10%] left-1/2 w-[3px] -translate-x-1/2 rotate-[12deg] bg-gradient-to-b from-transparent via-cyan-300 to-transparent shadow-[0_0_18px_4px_rgba(103,232,249,.55)]"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-[14%] flex flex-col items-center gap-4">
            <div className="rounded-[var(--ps-radius-md)] border border-cyan-300/50 bg-black/55 px-6 py-3 text-center text-white backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Demo match</p>
              <p className="mt-1 font-display text-base font-bold sm:text-lg">
                PLAYER ONE <span className="mx-2 text-[var(--ps-lime)]">VS</span> PLAYER TWO
              </p>
            </div>
            <PlayButton video="full" label="Play the demo match video" />
          </div>
        </div>
      </div>
    </section>
  );
}
