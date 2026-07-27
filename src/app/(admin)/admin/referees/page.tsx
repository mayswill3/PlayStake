'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scale, ShieldCheck } from 'lucide-react';
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

export default function AdminRefereesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/referees', { cache: 'no-store' });
    if (response.ok) setProfiles((await response.json()).profiles);
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
