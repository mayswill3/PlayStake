import Link from 'next/link';
import Image from 'next/image';
import { SOCIAL_PROFILES } from '@/lib/seo';

export function Footer() {
  return (
    <footer className="border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Column 1: Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10"
              />
              <span className="font-display text-xl font-bold text-ps-text dark:text-ps-text-on-dark">PlayStake</span>
            </Link>
            <p className="mt-4 text-sm text-ps-muted dark:text-ps-muted-on-dark max-w-xs">
              Peer-to-peer skill wagering for competitive gamers. Play your game, stake
              your skill, earn your winnings.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={SOCIAL_PROFILES.instagram}
                target="_blank"
                rel="me noopener noreferrer"
                className="rounded-lg border border-[var(--ps-border-light)] px-3 py-2 text-sm font-medium text-ps-muted transition-colors hover:border-[var(--ps-lime-35)] hover:text-ps-lime dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark"
              >
                Instagram
              </a>
              <a
                href={SOCIAL_PROFILES.tiktok}
                target="_blank"
                rel="me noopener noreferrer"
                className="rounded-lg border border-[var(--ps-border-light)] px-3 py-2 text-sm font-medium text-ps-muted transition-colors hover:border-[var(--ps-lime-35)] hover:text-ps-lime dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark"
              >
                TikTok
              </a>
            </div>
          </div>

          {/* Column 2: Product */}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-ps-text dark:text-ps-text-on-dark mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/how-it-works" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <a href="/learn-more#games" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Games
                </a>
              </li>
              <li>
                <a href="/learn-more#community" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Community
                </a>
              </li>
              <li>
                <a href="/learn-more#beta-signup" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Join Beta
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust */}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-ps-text dark:text-ps-text-on-dark mb-4">
              Trust & Safety
            </h3>
            <ul className="space-y-3">
              <li>
                <a href="/learn-more#trust" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Responsible Play
                </a>
              </li>
              <li>
                <a href="/learn-more#faq" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="https://www.begambleaware.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors"
                >
                  BeGambleAware ↗
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-ps-text dark:text-ps-text-on-dark mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="mailto:support@playstake.org" className="text-sm text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-lime transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark text-center sm:text-left">
            © 2026 PlayStake. All rights reserved. PlayStake does not currently hold a
            gambling licence. 18+ only.
          </p>
          <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
            Built for competitive gamers.
          </p>
        </div>
      </div>
    </footer>
  );
}
