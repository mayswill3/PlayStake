'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  userRole?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const playerNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '\u25A6' },
  { label: 'Wallet', href: '/wallet', icon: '\u25C8' },
  { label: 'Bets', href: '/bets', icon: '\u2694' },
  { label: 'Settings', href: '/settings', icon: '\u2699' },
];

const developerNav: NavItem[] = [
  { label: 'Overview', href: '/developer', icon: '\u25B6' },
  { label: 'Games', href: '/developer/games', icon: '\u265F' },
  { label: 'API Keys', href: '/developer/api-keys', icon: '\u26BF' },
  { label: 'Webhooks', href: '/developer/webhooks', icon: '\u21CB' },
];

const adminNav: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: '\u2605' },
  { label: 'Users', href: '/admin/users', icon: '\u263A' },
  { label: 'Disputes', href: '/admin/disputes', icon: '\u2696' },
  { label: 'Anomalies', href: '/admin/anomalies', icon: '\u26A0' },
];

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDeveloper = userRole === 'DEVELOPER' || userRole === 'ADMIN';

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-800 text-surface-300 hover:text-surface-100"
        aria-label="Toggle navigation"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-64 bg-surface-900 border-r border-surface-800
          flex flex-col
          transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-surface-800">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="text-brand-400 text-2xl font-bold">PS</span>
            <span className="text-lg font-semibold text-surface-100">PlayStake</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-surface-500">
            Player
          </div>
          {playerNav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onClick={() => setMobileOpen(false)}
            />
          ))}

          {isDeveloper && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-surface-500">
                Developer
              </div>
              {developerNav.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </>
          )}

          {userRole === 'ADMIN' && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-surface-500">
                Admin
              </div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 border-t border-surface-800">
          <p className="text-xs text-surface-500 text-center">PlayStake v1.0</p>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-colors duration-150 mb-0.5
        ${
          active
            ? 'bg-brand-600/15 text-brand-400'
            : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'
        }
      `}
      aria-current={active ? 'page' : undefined}
    >
      <span className="text-base" aria-hidden="true">{item.icon}</span>
      {item.label}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/developer') return pathname === '/developer';
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}
