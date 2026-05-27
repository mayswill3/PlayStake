'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MobileMenu } from '@/components/ui/mobile-menu';
import { PSButton } from '@/components/ui/playstake';

const NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '#games', label: 'Games' },
  { href: '#trust', label: 'Trust & Safety' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all ${
        scrolled ? 'backdrop-blur-md border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]' : 'border-b border-transparent'
      }`}
      style={{
        backgroundColor: scrolled
          ? 'color-mix(in srgb, var(--bg) 85%, transparent)'
          : 'transparent',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-lime)] rounded-lg">
            <Image
              src="/logo.png"
              alt="PlayStake"
              width={40}
              height={40}
              priority
              className="h-10 w-10"
            />
            <span className="font-display text-xl font-bold text-ps-text dark:text-ps-text-on-dark">PlayStake</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-blue)] dark:focus-visible:ring-[var(--ps-lime)] rounded"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 lg:gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden lg:flex h-10 px-4 items-center text-sm font-medium text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-blue)] dark:focus-visible:ring-[var(--ps-lime)] rounded"
            >
              Log in
            </Link>
            <a href="#beta-signup" className="hidden lg:block">
              <PSButton size="sm">Join Beta</PSButton>
            </a>
            <MobileMenu links={NAV_LINKS} />
          </div>
        </div>
      </div>
    </header>
  );
}
