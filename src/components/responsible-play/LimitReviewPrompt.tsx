'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PSButton } from '@/components/ui/playstake/PSButton';

/**
 * The six-monthly reminder to review deposit limits (RTS 12). Shown once when
 * due; either answer is recorded and restarts the six months.
 */
export function LimitReviewPrompt() {
  const router = useRouter();
  const [state, setState] = useState<{ hasLimits: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/responsible-play/limit-review', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { due?: boolean; hasLimits?: boolean } | null) => {
        if (data?.due) setState({ hasLimits: Boolean(data.hasLimits) });
      })
      .catch(() => {});
  }, []);

  async function answer(review: boolean) {
    setBusy(true);
    try {
      await fetch('/api/responsible-play/limit-review', { method: 'POST' });
    } finally {
      setBusy(false);
      setState(null);
    }
    if (review) router.push('/responsible-play');
  }

  return (
    <Dialog
      open={state !== null}
      onClose={() => void answer(false)}
      title="Time to review your limits"
      actions={
        <div className="flex flex-wrap gap-2">
          <PSButton size="sm" disabled={busy} onClick={() => answer(true)}>
            {state?.hasLimits ? 'Review my limits' : 'Set a deposit limit'}
          </PSButton>
          <PSButton size="sm" variant="ghost" disabled={busy} onClick={() => answer(false)}>
            {state?.hasLimits ? 'Keep them as they are' : 'Not now'}
          </PSButton>
        </div>
      }
    >
      <div className="flex items-start gap-3 text-sm text-fg-secondary">
        <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ps-lime)]" aria-hidden="true" />
        <p>
          {state?.hasLimits
            ? "It's been six months since you last looked at your deposit limits. Check they still suit you: you can lower them straight away, and any increase takes effect after 24 hours."
            : "It's been six months since we last asked. A deposit limit caps how much you can put in each day, week or month. You can set one at any time."}
        </p>
      </div>
    </Dialog>
  );
}
