import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChallengesProvider } from '@/components/lobby/ChallengesProvider';
import { EligibilityNotice } from '@/components/compliance/EligibilityNotice';
import { SessionReminder } from '@/components/responsible-play/SessionReminder';
import { InteractionPrompt } from '@/components/responsible-play/InteractionPrompt';
import { LimitReviewPrompt } from '@/components/responsible-play/LimitReviewPrompt';
import { SessionClock } from '@/components/responsible-play/SessionClock';

export const metadata: Metadata = {
  title: 'Play',
  description: 'Play real-money wagered games on PlayStake.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

// The game pages read the ?bet= query param (accept->play handoff) via
// useSearchParams and are fully client-interactive, so render them on demand
// rather than statically prerendering (which would need a CSR-bailout Suspense
// boundary around every game page).
export const dynamic = 'force-dynamic';

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    // ChallengesProvider is mounted here too (not only in the dashboard layout)
    // so a streamer sitting on /play/<their game> while live still receives
    // challenges. LobbyContainer on these pages only tracks the streamer's own
    // join-based entry, so it never surfaces a server-created challenge entry.
    <ChallengesProvider>
      <div className="min-h-screen bg-ps-paper dark:bg-ps-ink text-ps-text dark:text-ps-text-on-dark">
        <nav
          id="demo-nav"
          className="sticky top-0 z-50 border-b border-[var(--ps-border-light)] bg-ps-paper/85 backdrop-blur-sm dark:border-[var(--ps-border-dark)] dark:bg-ps-ink/85"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <Link
                href="/play"
                className="font-display text-lg font-bold tracking-wider text-ps-text dark:text-ps-text-on-dark"
              >
                <span className="inline-flex items-center gap-2">
                  <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
                  {/* Room for the clock on phones: the mark alone carries the brand. */}
                  <span className="hidden sm:inline">PlayStake</span>
                  <span className="sr-only sm:hidden">PlayStake</span>
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <SessionClock />
                <ThemeToggle />
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <EligibilityNotice />
        <main>{children}</main>
        <div
          id="play-fullscreen-clock"
          className="pointer-events-none fixed left-1/2 top-1 z-[110] hidden -translate-x-1/2 [&>div]:bg-black/60 [&>div]:text-white/80"
        >
          <SessionClock />
        </div>
        {/* Reality checks run where the games are played, not only on the dashboard. */}
        <SessionReminder />
        <InteractionPrompt />
        <LimitReviewPrompt />
      </div>
    </ChallengesProvider>
  );
}
