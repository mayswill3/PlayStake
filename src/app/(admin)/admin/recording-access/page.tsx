'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { formatDate } from '@/lib/utils/format';

interface Entry {
  id: string;
  action: string;
  targetId: string | null;
  details: { betId?: string; via?: string; kind?: string; reasonLabel?: string; note?: string; disputeId?: string; reason?: string };
  createdAt: string;
  actor: string;
}

const th = 'px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted';
const ACTION: Record<string, string> = { 'recording.view': 'Viewed', 'recording.hold': 'Hold placed', 'recording.release': 'Hold released' };

/** Who opened which recording, when and why: for the compliance lead's monthly review. */
export default function RecordingAccessPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => {
    fetch('/api/admin/recording-access', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((body) => setEntries(body.entries));
  }, []);

  return (
    <FadeIn>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Recording access</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Every opening of a match recording, by dispute reviewers and admins, with the reason given. Review monthly.
          </p>
        </div>
        {!entries ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : entries.length === 0 ? (
          <Card><p className="text-sm text-text-secondary">No recordings have been opened yet.</p></Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8">
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>Who</th>
                    <th className={th}>What</th>
                    <th className={th}>Match</th>
                    <th className={th}>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-text-secondary">{formatDate(entry.createdAt)}</td>
                      <td className="px-4 py-3 text-text-primary">{entry.actor}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {ACTION[entry.action] ?? entry.action}
                        {entry.details.kind ? ` · ${entry.details.kind === 'VOICE' ? 'voice' : 'video'}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        {(entry.details.betId ?? (entry.action !== 'recording.view' ? entry.targetId : null)) && (
                          <Link href={`/admin/matches/${entry.details.betId ?? entry.targetId}`} className="text-brand-400 hover:underline">Open</Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {entry.details.via === 'admin'
                          ? `${entry.details.reasonLabel}: ${entry.details.note}`
                          : entry.details.disputeId
                            ? 'Dispute review'
                            : entry.details.reason ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </FadeIn>
  );
}
