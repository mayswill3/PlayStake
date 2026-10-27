'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { formatCents } from '@/lib/utils/format';

interface Disclosure {
  statement: string;
  explainer: string;
  reason: 'first' | 'changed' | 'six_monthly' | null;
  balanceCents: number;
}

/**
 * LCCP 4.2.1: customers who have deposited acknowledge how their funds are
 * protected before gambling with them, again after any change, and, because
 * PlayStake's rating is "not protected", every six months, with the funds held
 * for them shown. Until they do, staking is refused.
 */
export function FundsProtectionReminder() {
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/wallet/funds-protection', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: (Disclosure & { acknowledged: boolean; hasDeposited: boolean }) | null) => {
        if (data && !data.acknowledged && data.hasDeposited) setDisclosure(data);
      })
      .catch(() => {});
  }, []);

  async function acknowledge() {
    setBusy(true);
    try {
      const response = await fetch('/api/wallet/funds-protection', { method: 'POST' });
      if (response.ok) setDisclosure(null);
    } finally {
      setBusy(false);
    }
  }

  const heading =
    disclosure?.reason === 'six_monthly'
      ? 'Reminder: your funds are not protected'
      : disclosure?.reason === 'changed'
        ? 'How we hold your funds has changed'
        : 'How your funds are protected';

  return (
    <Dialog
      open={disclosure !== null}
      onClose={() => setDisclosure(null)}
      title={heading}
      actions={
        <div className="flex flex-wrap gap-2">
          <PSButton size="sm" disabled={!ticked || busy} onClick={acknowledge}>
            I understand
          </PSButton>
          <PSButton size="sm" variant="ghost" disabled={busy} onClick={() => setDisclosure(null)}>
            Later
          </PSButton>
        </div>
      }
    >
      {disclosure && (
        <div className="space-y-3 text-sm text-fg-secondary">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <p>
              We hold <strong className="text-fg">{formatCents(disclosure.balanceCents)}</strong> for you.{' '}
              <strong className="text-fg">{disclosure.statement}</strong>
            </p>
          </div>
          <p>{disclosure.explainer}</p>
          <p>
            You can still withdraw your balance at any time. You can&apos;t stake deposited funds until you confirm.{' '}
            <Link href="/terms#funds-protection" className="underline">
              Read more
            </Link>
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
            <span>I have read and understood that my funds are not protected if PlayStake becomes insolvent.</span>
          </label>
        </div>
      )}
    </Dialog>
  );
}
