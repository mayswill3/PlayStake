'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Scale, ShieldCheck } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { useToast } from '@/components/ui/Toast';

interface Profile {
  id: string;
  status: string;
  bio: string | null;
  isAvailable: boolean;
  matchesHandled: number;
  user: {
    displayName: string;
    email: string;
    kycStatus: string;
    kickAccount: { channelSlug: string | null } | null;
  };
  qualifications: { game: { id: string; name: string } }[];
}

interface Capacity {
  approved: number;
  available: number;
  suspended: number;
  pendingApplications: number;
  unclaimed: number;
  oldestUnclaimedSeconds: number | null;
  inProgress: number;
  medianClaimSeconds: number | null;
  expiredUnclaimed: number;
  windowDays: number;
}

interface Performance {
  refereeProfileId: string;
  displayName: string;
  status: string;
  isAvailable: boolean;
  matchesHandled: number;
  decisionsSubmitted: number;
  overturned: number;
  overturnRate: number | null;
  medianDecisionSeconds: number | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round((seconds / 3600) * 10) / 10}h`;
}

export default function AdminRefereesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [performance, setPerformance] = useState<Performance[]>([]);
  const [minDecisions, setMinDecisions] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [applications, operations] = await Promise.all([
      fetch('/api/admin/referees', { cache: 'no-store' }),
      fetch('/api/admin/referees/operations', { cache: 'no-store' }),
    ]);
    if (applications.ok) setProfiles((await applications.json()).profiles);
    if (operations.ok) {
      const data = await operations.json();
      setCapacity(data.capacity);
      setPerformance(data.performance);
      setMinDecisions(data.minDecisionsForRate);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(id: string, status: string) {
    setBusy(id);
    const response = await fetch(`/api/admin/referees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await response.json();
    if (!response.ok) toast('error', body.error ?? 'Review failed');
    else {
      toast('success', `Referee ${status.toLowerCase()}`);
      await load();
    }
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Trust & safety</p>
        <h1 className="font-display text-3xl font-bold text-ps-text dark:text-white">Referee applications</h1>
        <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
          Verify identity, Kick ownership, experience, and conflicts before approval.
        </p>
      </div>

      {/* Coverage: whether there are enough referees to absorb demand. */}
      {capacity && (
        <Card>
          <CardTitle>Coverage</CardTitle>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Approved', value: String(capacity.approved) },
              { label: 'Available now', value: String(capacity.available) },
              { label: 'Awaiting review', value: String(capacity.pendingApplications) },
              { label: 'Unclaimed', value: String(capacity.unclaimed) },
              { label: 'In progress', value: String(capacity.inProgress) },
              { label: 'Median claim', value: formatDuration(capacity.medianClaimSeconds) },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                  {stat.label}
                </p>
                <p className="font-display text-2xl font-bold tabular-nums text-ps-text dark:text-white">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {capacity.available === 0 && capacity.unclaimed > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-[var(--ps-radius-md)] border border-ps-error/25 bg-ps-error/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ps-error" />
              <p className="text-ps-error">
                {capacity.unclaimed} match{capacity.unclaimed === 1 ? '' : 'es'} waiting with no
                referee available. Refereed modes cannot settle until someone goes available.
              </p>
            </div>
          )}

          {capacity.oldestUnclaimedSeconds !== null && capacity.oldestUnclaimedSeconds > 600 && (
            <div className="mt-3 flex items-start gap-2 rounded-[var(--ps-radius-md)] border border-ps-warning/25 bg-ps-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ps-warning" />
              <p className="text-ps-warning">
                Longest unclaimed match has been waiting{' '}
                {formatDuration(capacity.oldestUnclaimedSeconds)}.
              </p>
            </div>
          )}

          <p className="mt-4 text-xs text-ps-muted dark:text-ps-muted-on-dark">
            {capacity.expiredUnclaimed} assignment
            {capacity.expiredUnclaimed === 1 ? '' : 's'} expired unclaimed in the last{' '}
            {capacity.windowDays} days.
          </p>
        </Card>
      )}

      {/* Decision quality per referee. */}
      {performance.length > 0 && (
        <Card className="overflow-x-auto">
          <CardTitle>Decision quality</CardTitle>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                <th className="py-2 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Referee</th>
                <th className="py-2 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Settled</th>
                <th className="py-2 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Decisions</th>
                <th className="py-2 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Overturned</th>
                <th className="py-2 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Rate</th>
                <th className="py-2 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Median decision</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((row) => (
                <tr key={row.refereeProfileId} className="border-b border-[var(--ps-border-light)] last:border-0 dark:border-[var(--ps-border-dark)]">
                  <td className="py-2">
                    {row.displayName}
                    {row.isAvailable && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-ps-lime">available</span>
                    )}
                  </td>
                  <td className="py-2 tabular-nums">{row.matchesHandled}</td>
                  <td className="py-2 tabular-nums">{row.decisionsSubmitted}</td>
                  <td className="py-2 tabular-nums">{row.overturned}</td>
                  <td className="py-2 tabular-nums">
                    {row.overturnRate === null ? (
                      <span
                        className="text-ps-muted dark:text-ps-muted-on-dark"
                        title={`Needs ${minDecisions} decisions before a rate is meaningful`}
                      >
                        —
                      </span>
                    ) : (
                      <span className={row.overturnRate > 0.2 ? 'text-ps-error' : ''}>
                        {Math.round(row.overturnRate * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 tabular-nums">{formatDuration(row.medianDecisionSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ps-muted dark:text-ps-muted-on-dark">
            Overturn rate is withheld below {minDecisions} decisions, where a single reversal
            would read as an alarming percentage.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <Card><p className="py-10 text-center text-ps-muted">No applications.</p></Card>
        ) : profiles.map((profile) => (
          <Card key={profile.id}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Scale className="h-5 w-5 text-ps-lime" />
                  <CardTitle>{profile.user.displayName}</CardTitle>
                  <StatusPill
                    status={profile.status === 'APPROVED' ? 'live' : profile.status === 'PENDING' ? 'waiting' : 'disputed'}
                    label={profile.status}
                  />
                </div>
                <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
                  {profile.user.email} · Kick {profile.user.kickAccount?.channelSlug ?? 'not connected'} · KYC {profile.user.kycStatus}
                </p>
                <p className="mt-3 text-sm text-ps-text dark:text-white">{profile.bio || 'No experience statement provided.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.qualifications.map((item) => (
                    <span key={item.game.id} className="rounded-full bg-ps-lime/10 px-3 py-1 text-xs font-semibold text-ps-lime">
                      {item.game.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <PSButton
                  disabled={busy === profile.id || !profile.user.kickAccount?.channelSlug || profile.user.kycStatus !== 'VERIFIED'}
                  onClick={() => update(profile.id, 'APPROVED')}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" /> Approve
                </PSButton>
                <PSButton variant="ghost" disabled={busy === profile.id} onClick={() => update(profile.id, 'REJECTED')}>
                  Reject
                </PSButton>
                {profile.status === 'APPROVED' && (
                  <PSButton variant="danger" disabled={busy === profile.id} onClick={() => update(profile.id, 'SUSPENDED')}>
                    Suspend
                  </PSButton>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
