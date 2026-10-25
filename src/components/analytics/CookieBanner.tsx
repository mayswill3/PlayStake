'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  analyticsEnabled,
  isMeasuredPath,
  readConsent,
  saveConsent,
} from '@/lib/analytics';

/**
 * Asks once, on public pages, whether we may use analytics cookies. Accept and
 * Reject carry equal weight, and nothing is set until the visitor chooses.
 * "Cookie settings" in the footer reopens it.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (analyticsEnabled() && isMeasuredPath(pathname) && readConsent() === null) setOpen(true);
  }, [pathname]);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (choice: 'granted' | 'denied') => {
    saveConsent(choice);
    setOpen(false);
  };

  const button =
    'inline-flex h-10 flex-1 items-center justify-center rounded-[var(--ps-radius-md)] border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-lime)] sm:flex-none';

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-4 shadow-ps-shadow-lg sm:p-5 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
    >
      <p className="font-display text-sm font-bold text-ps-text dark:text-ps-text-on-dark">Can we use analytics cookies?</p>
      <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
        They tell us which pages people visit, so we can improve the site. We only use them on public pages, never on
        your wallet, bets or identity checks, and we don&apos;t use them for advertising. Essential cookies that keep you
        signed in are always on.{' '}
        <Link href="/privacy#cookies" className="underline underline-offset-2">
          More about cookies
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose('denied')} className={`${button} border-[var(--ps-border-light)] text-ps-text hover:bg-ps-paper dark:border-[var(--ps-border-dark)] dark:text-ps-text-on-dark dark:hover:bg-ps-ink-3`}>
          Reject
        </button>
        <button type="button" onClick={() => choose('granted')} className={`${button} border-[var(--ps-border-light)] text-ps-text hover:bg-ps-paper dark:border-[var(--ps-border-dark)] dark:text-ps-text-on-dark dark:hover:bg-ps-ink-3`}>
          Accept
        </button>
      </div>
    </div>
  );
}
