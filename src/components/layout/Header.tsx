'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
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
    <header className="sticky top-0 z-30 border-b border-white/8 bg-surface-950/90 backdrop-blur-md">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left spacer for mobile hamburger */}
        <div className="lg:hidden w-10" />

        {/* Mobile logo */}
        <div className="lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="PlayStake" className="h-8 w-8" />
          </Link>
        </div>

        {/* Desktop spacer */}
        <div className="hidden lg:block" />

        {/* Right section */}
        <div className="flex items-center gap-4">
          {/* Balance */}
          {balance && (
            <Link
              href="/wallet"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm bg-surface-800 hover:bg-surface-700 transition-colors"
            >
              <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Balance</span>
              <span className="text-sm font-mono tabular-nums text-brand-400">
                {formatCents(balance.available)}
              </span>
              {balance.escrowed > 0 && (
                <span className="font-mono text-xs text-text-secondary" title="In escrow">
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
                className="flex items-center gap-2 p-1.5 rounded-sm hover:bg-surface-800 transition-colors"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <Avatar
                  src={user.avatarUrl}
                  name={user.displayName}
                  size="sm"
                />
                <span className="hidden sm:block text-sm font-mono text-surface-200">
                  {user.displayName}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-sm bg-surface-850 border border-white/8 py-1 z-50">
                  <div className="px-4 py-3 border-b border-white/8">
                    <p className="text-sm font-mono font-medium text-text-primary">{user.displayName}</p>
                    <p className="text-xs font-mono text-text-muted truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm font-mono text-surface-300 hover:text-text-primary hover:bg-surface-800 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Settings
                  </Link>
                  {(user.role === 'DEVELOPER' || user.role === 'ADMIN') ? (
                    <Link
                      href="/developer"
                      className="block px-4 py-2 text-sm font-mono text-surface-300 hover:text-text-primary hover:bg-surface-800 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Developer Portal
                    </Link>
                  ) : (
                    <Link
                      href="/developer"
                      className="block px-4 py-2 text-sm font-mono text-surface-300 hover:text-text-primary hover:bg-surface-800 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Become a Developer
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm font-mono text-danger-400 hover:bg-surface-800 transition-colors"
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
