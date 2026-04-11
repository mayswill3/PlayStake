'use client';

import { Send } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';

interface InviteSentProps {
  targetName: string;
  inviteExpiresAt: string;
}

export function InviteSent({ targetName, inviteExpiresAt }: InviteSentProps) {
  const { label, secondsLeft } = useCountdown(inviteExpiresAt);
  // 60s total — progress shrinks from 100 → 0
  const percent = Math.max(0, Math.min(100, (secondsLeft / 60) * 100));

  return (
    <div className="rounded-xl border border-themed bg-elevated p-4">
      <div className="flex items-center gap-2 mb-3">
        <Send size={14} className="text-brand-600 dark:text-brand-400" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Invite sent
        </p>
      </div>

      <p className="text-sm text-fg mb-1">
        Waiting for <span className="font-semibold">{targetName}</span> to accept…
      </p>
      <p className="text-[11px] text-fg-muted mb-3">
        The invite expires automatically. If it times out, we&apos;ll drop you back into the lobby.
      </p>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-card overflow-hidden border border-themed" aria-hidden="true">
        <div
          className="h-full bg-brand-600 transition-[width] duration-1000 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p
        className="text-[11px] font-mono text-center mt-2 tabular-nums text-fg-muted"
        aria-live="polite"
      >
        {label}
      </p>
    </div>
  );
}
