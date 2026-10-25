import Image from 'next/image';
import { PlayButton, WatchButton } from './DemoVideo';

const HERO_ALT = 'Two players in headsets, each holding a controller, facing off in a head-to-head match';

/** The "demo match" badge and play button that sit on the hero image. */
function DemoBadge() {
  return (
    <div className="absolute inset-x-0 bottom-[10%] flex flex-col items-center gap-3 sm:gap-4">
      <div className="rounded-[var(--ps-radius-md)] border border-cyan-300/50 bg-black/55 px-5 py-2.5 text-center text-white backdrop-blur-sm sm:px-6 sm:py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:text-[11px]">Demo match</p>
        <p className="mt-1 font-display text-sm font-bold sm:text-lg">
          PLAYER ONE <span className="mx-2 text-[var(--ps-lime)]">VS</span> PLAYER TWO
        </p>
      </div>
      <PlayButton video="full" label="Play the demo match video" />
    </div>
  );
}

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      {/* Desktop: the photo fills the right of the hero and fades into the page. */}
      <div className="absolute inset-y-0 right-0 hidden w-[62%] lg:block">
        {/* Lazy, so phones (where this copy is hidden) never download it. */}
        <Image
          src="/home/photos/head-to-head.webp"
          alt={HERO_ALT}
          fill
          fetchPriority="high"
          sizes="(min-width: 1024px) 62vw, 1px"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-ps-paper to-transparent dark:from-ps-ink"
          aria-hidden="true"
        />
        <DemoBadge />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-24">
        <div className="lg:max-w-[46%]">
          <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Your game.
            <br />
            <span className="text-[#0f9f78] dark:text-ps-text-on-dark">Head to head.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ps-muted dark:text-ps-muted-on-dark">
            Stake on your own matches against real players, with an independent referee deciding the result.
          </p>

          {/* Phones: the photo sits between the intro and the buttons. */}
          <div className="relative mt-6 aspect-[16/10] overflow-hidden rounded-[var(--ps-radius-lg)] lg:hidden">
            {/* The phone LCP image: fetched first, at the width it's shown. */}
            <Image
              src="/home/photos/head-to-head.webp"
              alt={HERO_ALT}
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 1024px) 1px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
              className="object-cover"
            />
            <DemoBadge />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8">
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
      </div>
    </section>
  );
}
