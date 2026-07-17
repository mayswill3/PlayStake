'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Swords, Gamepad2, Settings, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePendingChallengeCount } from '@/components/lobby/ChallengesProvider';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Bets', href: '/bets', icon: Swords },
  { label: 'Challenges', href: '/challenges', icon: Bell },
  { label: 'Play', href: '/play', icon: Gamepad2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const pendingCount = usePendingChallengeCount();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-ps-paper dark:bg-ps-ink border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] pb-safe">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          const showDot = item.href === '/challenges' && pendingCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 flex-1 h-full
                transition-colors
                ${active ? 'text-ps-lime' : 'text-ps-muted dark:text-ps-muted-on-dark'}
              `}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {showDot && (
                  <span
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-ps-lime ring-2 ring-ps-paper dark:ring-ps-ink"
                    aria-label={`${pendingCount} pending`}
                  />
                )}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
