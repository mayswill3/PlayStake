import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronRight,
  Gamepad2,
  MessageCircle,
  PauseCircle,
  Play,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { PlayButton, WatchButton } from './DemoVideo';

const panel =
  'rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2';
const muted = 'text-ps-muted dark:text-ps-muted-on-dark';
const sectionTitle = 'font-display text-3xl font-extrabold tracking-tight sm:text-4xl';

// ── 02 Find your game ────────────────────────────────────────────────────────

const GAMES = [
  {
    name: 'EA SPORTS FC 27',
    href: '/games/ea-sports-fc-27',
    image: '/home/photos/game-football.webp',
    alt: 'A floodlit football stadium at night',
    status: 'In beta',
  },
  {
    name: 'Tekken 8',
    href: '/games/tekken-8',
    image: '/home/photos/game-fighting.webp',
    alt: 'A torch-lit fighting arena beneath snowy mountains',
    status: 'In beta',
  },
];

export function FindYourGame() {
  return (
    <section id="games" className="scroll-mt-20 border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className={sectionTitle}>Find your game</h2>
          <Link href="/games" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline">
            How each game works <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        {/* A swipeable row on phones, a grid from tablet up. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
          {GAMES.map((game) => (
            <Link
              key={game.name}
              href={game.href}
              aria-label={`How ${game.name} matches work`}
              className="relative flex aspect-[16/8] w-[85%] shrink-0 snap-start items-end overflow-hidden rounded-[var(--ps-radius-lg)] p-5 text-white shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-lime)] sm:w-auto sm:p-6"
            >
              <Image src={game.image} alt={game.alt} fill sizes="(min-width: 640px) 50vw, 85vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
              <div className="relative">
                <p className="font-display text-2xl font-extrabold uppercase leading-tight tracking-tight sm:text-3xl">{game.name}</p>
                <span className="mt-2 inline-block rounded bg-[#C8F04B] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ps-ink">
                  {game.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className={`mt-4 text-xs ${muted}`}>
          Game names are trademarks of their owners. PlayStake is not affiliated with or endorsed by them.
        </p>
      </div>
    </section>
  );
}

// ── 03 A simple way to play ──────────────────────────────────────────────────

const STEPS = [
  { icon: Gamepad2, title: 'Agree the match', body: 'Game, stake and opponent' },
  { icon: Play, title: 'Play head to head', body: 'Both of you live on Kick' },
  { icon: ShieldCheck, title: 'Review the result', body: 'Independent referee decides' },
];

export function SimpleWayToPlay() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className={`${sectionTitle} mb-8`}>A simple way to play</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--ps-lime)] font-display text-lg font-bold">
                {index + 1}
              </span>
              <Icon className="h-9 w-9 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className={`text-sm ${muted}`}>{body}</p>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className={`ml-auto hidden h-5 w-5 md:block ${muted}`} aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── 04 Referee review ────────────────────────────────────────────────────────

const REVIEW_STEPS = [
  { title: 'Result disputed', body: 'Either player can dispute the referee’s call within 15 minutes. Nothing is paid out meanwhile.' },
  { title: 'Evidence reviewed', body: 'Our team reviews both streams, match chat and the referee’s notes.' },
  { title: 'Decision explained', body: 'The result is upheld or corrected, and both players are told the outcome.' },
];

export function RefereeReview() {
  return (
    <section className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className={`${sectionTitle} mb-8`}>
          A clear process.
          <br />
          Even when a match is disputed.
        </h2>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--ps-radius-lg)] bg-black">
            <Image
              src="/home/photos/referee-review.webp"
              alt="A referee in a headset watching both players' streams side by side"
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25">
              <PlayButton video="match" label="Play the referee demo" />
              <p className="font-display text-lg font-bold uppercase tracking-wide text-white">Referee demo</p>
            </div>
          </div>
          <div className={`${panel} p-6`}>
            <h3 className="font-display text-2xl font-bold">How a review works</h3>
            <ol className="mt-6 space-y-6">
              {REVIEW_STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-4">
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--ps-lime)] bg-ps-paper-elevated font-bold dark:bg-ps-ink-2">
                    {index + 1}
                  </span>
                  {index < REVIEW_STEPS.length - 1 && (
                    <span className="absolute left-5 top-10 h-[calc(100%+0.5rem)] w-px bg-[var(--ps-lime)]/60" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className={`mt-1 text-sm ${muted}`}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <WatchButton video="match" className="mt-8 w-full">Watch referee demo</WatchButton>
            <p className={`mt-3 text-center text-xs ${muted}`}>
              Read the <Link href="/match-rules" className="underline">Match Rules</Link>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 05 Costs and control ─────────────────────────────────────────────────────

/** Worked example of a £5 match on a game with a 5% fee. */
const STAKE = 5;
const FEE_PERCENT = 0.05;
const POT = STAKE * 2;
const FEE = POT * FEE_PERCENT;
const gbp = (amount: number) => `£${amount.toFixed(2)}`;

const CONTROLS = [
  { icon: SlidersHorizontal, title: 'Set personal limits', body: 'Daily, weekly and monthly deposit limits, and play reminders.', href: '/responsible-play' },
  { icon: PauseCircle, title: 'Take a break', body: 'Pause for a day up to six weeks, or self-exclude.', href: '/responsible-play' },
  { icon: MessageCircle, title: 'Get support', body: 'Free, confidential help whenever you need it.', href: '/faq#help' },
];

export function CostsAndControl() {
  const rows = [
    ['Player one stake', gbp(STAKE)],
    ['Player two stake', gbp(STAKE)],
    ['Total pot', gbp(POT)],
    [`Example match fee (${FEE_PERCENT * 100}%)`, gbp(FEE)],
  ];
  return (
    <section className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className={`${sectionTitle} mb-8`}>Know the costs. Stay in control.</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={`${panel} p-6`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-bold">Example pricing</h3>
              <span className="rounded-full border border-[var(--ps-lime)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                Example · not live
              </span>
            </div>
            <dl className="mt-5 overflow-hidden rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-[var(--ps-border-light)] px-4 py-2.5 text-sm dark:border-[var(--ps-border-dark)]">
                  <dt>{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between bg-[#C8F04B] px-4 py-3 font-bold text-ps-ink">
                <dt>Winner receives</dt>
                <dd className="tabular-nums">{gbp(POT - FEE)}</dd>
              </div>
            </dl>
            <p className={`mt-3 text-sm ${muted}`}>
              Includes the winner&apos;s own stake back. The losing player loses {gbp(STAKE)}. The fee depends on the
              game and is always shown before you commit.
            </p>
            <p className={`mt-2 text-xs ${muted}`}>Example only. Final pricing to be confirmed.</p>
          </div>
          <div className={`${panel} p-6`}>
            <h3 className="font-display text-2xl font-bold">Your controls</h3>
            <ul className="mt-5 space-y-3">
              {CONTROLS.map(({ icon: Icon, title, body, href }) => (
                <li key={title}>
                  <Link
                    href={href}
                    className="flex items-center gap-4 rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] p-4 transition-colors hover:border-[var(--ps-lime)] dark:border-[var(--ps-border-dark)]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-[var(--ps-lime)]/15">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{title}</span>
                      <span className={`block text-sm ${muted}`}>{body}</span>
                    </span>
                    <ChevronRight className={`h-5 w-5 ${muted}`} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className={`mt-4 text-xs ${muted}`}>
              Need help now? GamCare is free and confidential on 0808 8020 133.
            </p>
          </div>
        </div>
        <p className={`mt-4 text-xs ${muted}`}>Test beta only. No real-money wagering.</p>
      </div>
    </section>
  );
}

// ── 06 See the full match experience ─────────────────────────────────────────

const CLIPS = [
  { video: 'challenge' as const, poster: '/home/photos/challenge-setup.webp', title: 'Setting up a challenge' },
  { video: 'match' as const, poster: '/home/photos/head-to-head.webp', title: 'Playing the match' },
  { video: 'result' as const, poster: '/home/photos/referee-result.webp', title: 'Reviewing the result' },
];

export function MatchExperience() {
  return (
    <section className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">See the full match experience.</h2>
        <p className={`mt-2 text-lg ${muted}`}>From challenge to result review.</p>
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {CLIPS.map((clip) => (
            <figure key={clip.video} className="w-[85%] shrink-0 snap-start md:w-auto">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--ps-radius-lg)] bg-black">
                <Image src={clip.poster} alt="" fill sizes="(min-width: 768px) 33vw, 85vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <PlayButton video={clip.video} label={`Play: ${clip.title}`} className="h-11 w-11" />
                  <span className="rounded-full border border-white/80 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Beta preview
                  </span>
                </div>
              </div>
              <figcaption className="mt-3 font-semibold">{clip.title}</figcaption>
            </figure>
          ))}
        </div>
        <p className={`mt-4 text-center text-xs ${muted}`}>
          Recorded in our test environment with test accounts. Game streams are simulated.
        </p>
      </div>
    </section>
  );
}
