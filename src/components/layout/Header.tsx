'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { formatCents } from '@/lib/utils/format';

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
    <header className="sticky top-0 z-30 border-b border-surface-800 bg-surface-950/80 backdrop-blur-md">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left spacer for mobile hamburger */}
        <div className="lg:hidden w-10" />

        {/* Mobile logo */}
        <div className="lg:hidden">
          <Link href="/dashboard" className="text-brand-400 text-xl font-bold">PS</Link>
        </div>

        {/* Desktop spacer */}
        <div className="hidden lg:block" />

        {/* Right section */}
        <div className="flex items-center gap-4">
          {/* Balance */}
          {balance && (
            <Link
              href="/wallet"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors"
            >
              <span className="text-xs text-surface-400">Balance</span>
              <span className="text-sm font-semibold text-brand-400">
                {formatCents(balance.available)}
              </span>
              {balance.escrowed > 0 && (
                <span className="text-xs text-surface-500" title="In escrow">
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
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-800 transition-colors"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <Avatar
                  src={user.avatarUrl}
                  name={user.displayName}
                  size="sm"
                />
                <span className="hidden sm:block text-sm text-surface-200">
                  {user.displayName}
                </span>
                <svg
                  className={`h-4 w-4 text-surface-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-surface-900 border border-surface-800 shadow-xl py-1 z-50">
                  <div className="px-4 py-3 border-b border-surface-800">
                    <p className="text-sm font-medium text-surface-100">{user.displayName}</p>
                    <p className="text-xs text-surface-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Settings
                  </Link>
                  {(user.role === 'DEVELOPER' || user.role === 'ADMIN') ? (
                    <Link
                      href="/developer"
                      className="block px-4 py-2 text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Developer Portal
                    </Link>
                  ) : (
                    <Link
                      href="/developer"
                      className="block px-4 py-2 text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Become a Developer
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-danger-400 hover:bg-surface-800 transition-colors"
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
