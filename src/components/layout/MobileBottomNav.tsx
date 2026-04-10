'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Swords, Gamepad2, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Bets', href: '/bets', icon: Swords },
  { label: 'Play', href: '/play', icon: Gamepad2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-page border-t border-themed pb-safe">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 flex-1 h-full
                transition-colors
                ${active ? 'text-brand-600 dark:text-brand-400' : 'text-fg-muted'}
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
