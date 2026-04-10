import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: {
    default: 'Demo | PlayStake',
    template: '%s | PlayStake Demo',
  },
  description: 'See how PlayStake integrates with your favorite games.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-fg">
      <nav
        id="demo-nav"
        className="border-b border-themed backdrop-blur-sm sticky top-0 z-50"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/demo"
              className="font-display text-lg font-bold tracking-wider text-fg"
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
                className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg transition-colors"
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
