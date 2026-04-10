'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MobileMenu } from '@/components/ui/mobile-menu';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#for-players', label: 'For Players' },
  { href: '#for-developers', label: 'For Developers' },
  { href: '#pricing', label: 'Fees' },
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
        scrolled
          ? 'backdrop-blur-md border-b border-themed'
          : 'border-b border-transparent'
      }`}
      style={{
        backgroundColor: scrolled ? 'color-mix(in srgb, var(--bg) 80%, transparent)' : 'transparent',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="PlayStake"
              width={40}
              height={40}
              priority
              className="h-10 w-10"
            />
            <span className="font-display text-xl font-bold text-fg">PlayStake</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-fg-secondary hover:text-fg transition-colors"
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
              className="hidden lg:flex h-10 px-4 items-center text-sm font-medium text-fg hover:text-brand-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="hidden lg:flex h-10 px-5 items-center rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Get Started
            </Link>
            <MobileMenu links={NAV_LINKS} />
          </div>
        </div>
      </div>
    </header>
  );
}
