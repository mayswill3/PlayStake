import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: {
    default: 'Play | PlayStake',
    template: '%s | PlayStake',
  },
  description: 'Play real-money wagered games on PlayStake.',
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ps-paper dark:bg-ps-ink text-ps-text dark:text-ps-text-on-dark">
      <nav
        id="demo-nav"
        className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] backdrop-blur-sm sticky top-0 z-50"
        style={{ backgroundColor: 'color-mix(in srgb, var(--ps-paper) 85%, transparent)' }}
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
  );
}
