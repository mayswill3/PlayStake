'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

interface Eligibility {
  eligible: boolean;
  code?: string;
  message?: string;
}

const NEXT_STEP: Record<string, { label: string; href: string }> = {
  KYC_REQUIRED: { label: 'Verify your identity', href: '/verification' },
  PLAY_BREAK_ACTIVE: { label: 'Responsible play', href: '/responsible-play' },
  GAMSTOP_EXCLUDED: { label: 'Withdraw your balance', href: '/wallet' },
};

/**
 * Explains, before the customer tries, why they can't play: identity not
 * verified yet, a break, GAMSTOP, or a restricted account. The games are
 * blocked server-side regardless; this only makes the reason visible.
 */
export function EligibilityNotice() {
  const [state, setState] = useState<Eligibility | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/compliance/eligibility', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Eligibility | null) => {
        if (active && data) setState(data);
      })
      .catch(() => {
        /* the games still enforce it */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!state || state.eligible) return null;
  const next = state.code ? NEXT_STEP[state.code] : undefined;

  return (
    <div
      role="status"
      className="mx-auto mt-6 flex max-w-7xl items-start gap-3 rounded-[var(--ps-radius-md)] border border-ps-warning/30 bg-ps-warning/10 px-4 py-3 text-sm sm:mx-6 lg:mx-auto"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ps-warning" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-ps-text dark:text-ps-text-on-dark">You can&apos;t play right now</p>
        <p className="mt-0.5 text-ps-muted dark:text-ps-muted-on-dark">{state.message}</p>
        {next && (
          <Link href={next.href} className="mt-1.5 inline-block font-semibold text-ps-lime hover:underline">
            {next.label}
          </Link>
        )}
      </div>
    </div>
  );
}
