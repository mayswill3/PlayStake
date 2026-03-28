'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Swords,
  Settings,
  Play,
  Gamepad2,
  Key,
  Webhook,
  Star,
  Users,
  Scale,
  AlertTriangle,
  Code2,
  Menu,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  userRole?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const playerNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Bets', href: '/bets', icon: Swords },
  { label: 'Demo Games', href: '/demo', icon: Gamepad2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const developerNav: NavItem[] = [
  { label: 'Overview', href: '/developer', icon: Play },
  { label: 'Games', href: '/developer/games', icon: Gamepad2 },
  { label: 'API Keys', href: '/developer/api-keys', icon: Key },
  { label: 'Webhooks', href: '/developer/webhooks', icon: Webhook },
  { label: 'SDK Demo', href: '/developer/sdk-demo', icon: Code2 },
];

const adminNav: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: Star },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Disputes', href: '/admin/disputes', icon: Scale },
  { label: 'Anomalies', href: '/admin/anomalies', icon: AlertTriangle },
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-sm bg-surface-800 text-surface-300 hover:text-text-primary"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
          fixed top-0 left-0 z-40 h-full w-[75vw] max-w-64 bg-surface-950 border-r border-white/8
          flex flex-col
          transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/8">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <img src="/logo.png" alt="PlayStake" className="h-8 w-8" />
            <span className="text-lg font-display font-semibold text-text-primary">PlayStake</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
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
              <div className="mt-6 mb-2 px-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
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
              <div className="mt-6 mb-2 px-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
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
        <div className="px-4 py-4 border-t border-white/8">
          <p className="font-mono text-[10px] text-text-muted text-center uppercase tracking-widest">PlayStake v1.0</p>
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
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-mono
        transition-colors duration-150 mb-0.5
        ${
          active
            ? 'bg-brand-400/10 text-brand-400 border-l-2 border-brand-400'
            : 'text-surface-400 hover:text-text-primary hover:bg-surface-800'
        }
      `}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/developer') return pathname === '/developer';
  if (href === '/admin') return pathname === '/admin';
  if (href === '/demo') return pathname.startsWith('/demo');
  return pathname.startsWith(href);
}
