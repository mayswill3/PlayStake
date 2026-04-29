'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { formatCents } from '@/lib/utils/format';
import { ChevronDown } from 'lucide-react';

interface HeaderProps {
  user: {
    displayName: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  } | null;
  balance?: { available: number; escrowed: number } | null;
}

export function Header({ user, balance }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors, redirect anyway
    }
    router.push('/login');
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-themed backdrop-blur-md"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
    >
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left spacer for mobile hamburger */}
        <div className="lg:hidden w-10" />

        {/* Mobile logo */}
        <div className="lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo.png" alt="PlayStake" width={32} height={32} className="h-8 w-8" />
          </Link>
        </div>

        {/* Desktop spacer */}
        <div className="hidden lg:block" />

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Balance */}
          {balance && (
            <Link
              href="/wallet"
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-elevated hover:opacity-80 transition-opacity border border-themed"
            >
              <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Balance</span>
              <span className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                {formatCents(balance.available)}
              </span>
              {balance.escrowed > 0 && (
                <span className="hidden sm:inline text-xs text-fg-secondary" title="In escrow">
                  ({formatCents(balance.escrowed)})
                </span>
              )}
            </Link>
          )}

          {/* User dropdown */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-elevated transition-colors"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <Avatar
                  src={user.avatarUrl}
                  name={user.displayName}
                  size="sm"
                />
                <span className="hidden sm:block text-sm font-medium text-fg">
                  {user.displayName}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-fg-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-themed py-1 z-50 shadow-lg">
                  <div className="px-4 py-3 border-b border-themed">
                    <p className="text-sm font-medium text-fg">{user.displayName}</p>
                    <p className="text-xs text-fg-muted truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-fg-secondary hover:text-fg hover:bg-elevated transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-danger-500 hover:bg-elevated transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
