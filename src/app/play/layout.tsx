import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChallengesProvider } from '@/components/lobby/ChallengesProvider';

export const metadata: Metadata = {
  title: {
    default: 'Play | PlayStake',
    template: '%s | PlayStake',
  },
  description: 'Play real-money wagered games on PlayStake.',
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
                  <Image src="/logo.png" alt="PlayStake" width={32} height={32} className="h-8 w-8" />
                  <span>PlayStake</span>
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </ChallengesProvider>
  );
}
