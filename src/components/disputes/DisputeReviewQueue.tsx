'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/Card';
import { formatCents } from '@/lib/utils/format';

interface QueueItem {
  id: string;
  status: string;
  createdAt: string;
  takenByMe: boolean;
  gameName: string;
  stakeAmount: number;
  players: [string, string];
  reason: string;
}

/** Disputes an approved dispute reviewer may take: none they played in, refereed or are linked to. */
export function DisputeReviewQueue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/referees/disputes', { cache: 'no-store' });
        if (res.ok && !cancelled) setItems((await res.json()).disputes);
      } catch {
        /* the next poll retries */
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Card>
      <CardTitle>Dispute reviews</CardTitle>
      <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
        You&apos;re approved to review disputes about other referees&apos; calls. You&apos;ll never see a dispute for a match
        you played in or refereed, or one with a player you follow, are followed by or have blocked.
      </p>
      {items === null ? null : items.length === 0 ? (
        <p className="mt-4 text-sm text-ps-muted dark:text-ps-muted-on-dark">No disputes waiting.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/referee/disputes/${item.id}`}
                className="block rounded-lg border border-[var(--ps-border-light)] p-3 transition-colors hover:border-[var(--ps-lime)] dark:border-[var(--ps-border-dark)]"
              >
                <p className="text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
                  {item.gameName} · {item.players[0]} vs {item.players[1]} · {formatCents(Math.round(item.stakeAmount * 100))} each
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-ps-muted dark:text-ps-muted-on-dark">{item.reason}</p>
                <p className="mt-1 text-xs font-semibold text-ps-lime">{item.takenByMe ? 'Taken by you' : 'Waiting for a reviewer'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
