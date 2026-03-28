import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: {
    default: 'Demo | PlayStake',
    template: '%s | PlayStake Demo',
  },
  description: 'See how PlayStake integrates with your favorite games.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-950">
      <nav id="demo-nav" className="border-b border-white/8 bg-surface-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/demo"
              className="font-display text-lg font-bold tracking-wider text-text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <img src="/logo.png" alt="PlayStake" className="h-8 w-8" />
                <span>PlayStake</span>
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors font-mono"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
