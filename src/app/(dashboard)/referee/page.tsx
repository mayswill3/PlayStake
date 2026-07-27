'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2, ShieldCheck, Swords, Video } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { useToast } from '@/components/ui/Toast';

interface Game { id: string; name: string }
interface ProfileResponse {
  profile: null | {
    id: string;
    status: string;
    isAvailable: boolean;
    bio: string | null;
    qualifications: { game: Game }[];
  };
  games: Game[];
  requirements: { kickConnected: boolean; kycVerified: boolean };
}
interface Assignment {
  id: string;
  status: string;
  disputeDeadline: string | null;
  decision: string | null;
  rewardAmount: string | null;
  rewardPercent: string;
  bet: {
    id: string;
    amount: string;
    status: string;
    platformFeePercent: string;
    game: Game;
    playerA: Player;
    playerB: Player | null;
  };
}
interface Player {
  id: string;
  displayName: string;
  kickAccount: { channelSlug: string | null; isLive: boolean } | null;
}

export default function RefereeHubPage() {
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [available, setAvailable] = useState<Assignment[]>([]);
  const [mine, setMine] = useState<Assignment[]>([]);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const notifiedIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    const profileResponse = await fetch('/api/referees/profile', { cache: 'no-store' });
    if (!profileResponse.ok) return;
    const profile = await profileResponse.json() as ProfileResponse;
    setProfileData(profile);
    if (profile.profile) {
      const [availableResponse, mineResponse] = await Promise.all([
        fetch('/api/referees/assignments?scope=available', { cache: 'no-store' }),
        fetch('/api/referees/assignments?scope=mine', { cache: 'no-store' }),
      ]);
      if (availableResponse.ok) {
        setAvailable((await availableResponse.json()).assignments);
      }
      if (mineResponse.ok) setMine((await mineResponse.json()).assignments);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const active = useMemo(
    () => mine.find((item) => ['ASSIGNED', 'READY', 'IN_PROGRESS'].includes(item.status)),
    [mine],
  );

  async function apply() {
    setBusy(true);
    const response = await fetch('/api/referees/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, gameIds: selectedGames }),
    });
    const body = await response.json();
    if (!response.ok) toast('error', body.error ?? 'Application failed');
    else {
      toast('success', 'Application submitted for review');
      await load();
    }
    setBusy(false);
  }

  async function toggleAvailability() {
    if (!profileData?.profile) return;
    setBusy(true);
    const response = await fetch('/api/referees/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: !profileData.profile.isAvailable }),
    });
    const body = await response.json();
    if (!response.ok) toast('error', body.error ?? 'Could not update availability');
    else await load();
    setBusy(false);
  }

  async function assignmentAction(id: string, endpoint: string, body?: object) {
    setBusy(true);
    const response = await fetch(`/api/referees/assignments/${id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) toast('error', result.error ?? 'Action failed');
    else {
      toast('success', 'Match updated');
      await load();
    }
    setBusy(false);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      toast('error', 'This browser does not support notifications');
      return;
    }
    const permission = await Notification.requestPermission();
    toast(
      permission === 'granted' ? 'success' : 'error',
      permission === 'granted'
        ? 'Notifications enabled while the referee hub is open'
        : 'Notification permission was not granted',
    );
  }

  useEffect(() => {
    if (
      available.length > 0 &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const fresh = available.find((assignment) => !notifiedIds.current.has(assignment.id));
      if (fresh) {
        notifiedIds.current.add(fresh.id);
        new Notification('PlayStake match needs a referee', {
          body: `${fresh.bet.playerA.displayName} vs ${fresh.bet.playerB?.displayName ?? 'Player'} — ${fresh.bet.game.name}`,
        });
      }
    }
  }, [available]);

  if (!profileData) return <div className="py-20 text-center text-ps-muted">Loading referee hub…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Human officiating</p>
          <h1 className="font-display text-3xl font-bold text-ps-text dark:text-white">Referee Hub</h1>
          <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
            Watch both live feeds, record an evidence-backed result, and earn 10% of the platform fee.
          </p>
        </div>
        {profileData.profile?.status === 'APPROVED' && (
          <div className="flex gap-2">
            <PSButton variant="ghost" onClick={enableNotifications}>
              <Bell className="mr-2 h-4 w-4" /> Alerts
            </PSButton>
            <PSButton
              variant={profileData.profile.isAvailable ? 'danger' : 'primary'}
              disabled={busy}
              onClick={toggleAvailability}
            >
              {profileData.profile.isAvailable ? 'Go unavailable' : 'Go available'}
            </PSButton>
          </div>
        )}
      </div>

      {!profileData.profile ? (
        <ApplicationCard
          games={profileData.games}
          selected={selectedGames}
          bio={bio}
          requirements={profileData.requirements}
          busy={busy}
          onBio={setBio}
          onToggle={(id) => setSelectedGames((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
          )}
          onApply={apply}
        />
      ) : profileData.profile.status !== 'APPROVED' ? (
        <Card>
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-6 w-6 text-ps-lime" />
            <div>
              <CardTitle>Application {profileData.profile.status.toLowerCase()}</CardTitle>
              <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
                {profileData.profile.status === 'PENDING'
                  ? 'An administrator must review your identity, Kick account, and selected games before assignments become available.'
                  : 'Your account cannot accept referee assignments. Contact support if you believe this is a mistake.'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {!profileData.requirements.kycVerified && (
            <Card className="border-ps-warning/40">
              <p className="font-semibold text-ps-text dark:text-white">Identity verification required</p>
              <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
                Approval alone cannot enable availability until KYC is verified.
              </p>
            </Card>
          )}
          {active ? (
            <RefereeWorkbench assignment={active} busy={busy} onAction={assignmentAction} />
          ) : (
            <AvailableMatches assignments={available} busy={busy} onClaim={(id) => assignmentAction(id, 'claim')} />
          )}
          <AssignmentHistory assignments={mine} />
        </>
      )}
    </div>
  );
}

function ApplicationCard(props: {
  games: Game[];
  selected: string[];
  bio: string;
  requirements: ProfileResponse['requirements'];
  busy: boolean;
  onBio: (value: string) => void;
  onToggle: (id: string) => void;
  onApply: () => void;
}) {
  return (
    <Card>
      <CardTitle>Apply to referee</CardTitle>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <label className="text-sm font-semibold text-ps-text dark:text-white">Games you understand</label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {props.games.map((game) => (
              <label key={game.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--ps-border-light)] p-3 dark:border-[var(--ps-border-dark)]">
                <input type="checkbox" checked={props.selected.includes(game.id)} onChange={() => props.onToggle(game.id)} />
                <span className="text-sm text-ps-text dark:text-white">{game.name}</span>
              </label>
            ))}
          </div>
          <label className="mt-5 block text-sm font-semibold text-ps-text dark:text-white">Experience</label>
          <textarea
            value={props.bio}
            onChange={(event) => props.onBio(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell us about your experience with these games…"
            className="mt-2 w-full rounded-lg border border-[var(--ps-border-light)] bg-transparent p-3 text-sm text-ps-text outline-none focus:border-ps-lime dark:border-[var(--ps-border-dark)] dark:text-white"
          />
        </div>
        <div className="rounded-xl bg-ps-lime/10 p-5">
          <p className="font-semibold text-ps-text dark:text-white">Requirements</p>
          <Requirement ok={props.requirements.kickConnected} label="Connected Kick account" />
          <Requirement ok={props.requirements.kycVerified} label="Verified identity before going available" />
          <Requirement ok label="Independent from both players" />
          <PSButton
            className="mt-5 w-full"
            disabled={props.busy || !props.requirements.kickConnected || props.selected.length === 0}
            onClick={props.onApply}
          >
            Submit application
          </PSButton>
        </div>
      </div>
    </Card>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
      <CheckCircle2 className={`h-4 w-4 ${ok ? 'text-ps-lime' : 'text-ps-error'}`} />
      {label}
    </div>
  );
}

function AvailableMatches({ assignments, busy, onClaim }: { assignments: Assignment[]; busy: boolean; onClaim: (id: string) => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Available live matches</CardTitle>
        <StatusPill status={assignments.length ? 'live' : 'waiting'} label={`${assignments.length} waiting`} />
      </div>
      <div className="mt-4 space-y-3">
        {assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-ps-muted dark:text-ps-muted-on-dark">
            No eligible same-game live matches need a referee right now.
          </p>
        ) : assignments.map((assignment) => (
          <div key={assignment.id} className="flex flex-col gap-3 rounded-xl border border-[var(--ps-border-light)] p-4 dark:border-[var(--ps-border-dark)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ps-text dark:text-white">
                {assignment.bet.playerA.displayName} <span className="text-ps-muted">vs</span> {assignment.bet.playerB?.displayName}
              </p>
              <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
                {assignment.bet.game.name} · ${(Number(assignment.bet.amount) * 2).toFixed(2)} pot ·{' '}
                ${(Number(assignment.bet.amount) * 2 * Number(assignment.bet.platformFeePercent) * Number(assignment.rewardPercent)).toFixed(2)} referee fee
              </p>
            </div>
            <PSButton disabled={busy} onClick={() => onClaim(assignment.id)}>Claim match</PSButton>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RefereeWorkbench({ assignment, busy, onAction }: { assignment: Assignment; busy: boolean; onAction: (id: string, endpoint: string, body?: object) => void }) {
  const [decision, setDecision] = useState('PLAYER_A_WIN');
  const [notes, setNotes] = useState('');
  const players = [assignment.bet.playerA, assignment.bet.playerB].filter(Boolean) as Player[];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{assignment.bet.playerA.displayName} vs {assignment.bet.playerB?.displayName}</CardTitle>
            <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">{assignment.bet.game.name}</p>
          </div>
          <StatusPill status="live" label={assignment.status.replace(/_/g, ' ')} />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {players.map((player) => player.kickAccount?.channelSlug && (
            <div key={player.id}>
              <div className="mb-2 flex items-center gap-2">
                <Video className="h-4 w-4 text-ps-lime" />
                <p className="font-semibold text-ps-text dark:text-white">{player.displayName}</p>
              </div>
              <KickPlayer slug={player.kickAccount.channelSlug} />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {assignment.status === 'ASSIGNED' && (
            <PSButton disabled={busy} onClick={() => onAction(assignment.id, 'action', { action: 'READY' })}>
              I can see both streams
            </PSButton>
          )}
          {assignment.status === 'READY' && (
            <PSButton disabled={busy} onClick={() => onAction(assignment.id, 'action', { action: 'START' })}>
              Start officiating
            </PSButton>
          )}
        </div>
      </Card>
      {assignment.status === 'IN_PROGRESS' && (
        <Card>
          <CardTitle>Submit result</CardTitle>
          <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
            Your decision opens a 15-minute dispute window. Funds remain in escrow until it closes.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['PLAYER_A_WIN', `${assignment.bet.playerA.displayName} won`],
              ['PLAYER_B_WIN', `${assignment.bet.playerB?.displayName} won`],
              ['DRAW', 'Draw'],
            ].map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ps-border-light)] p-3 dark:border-[var(--ps-border-dark)]">
                <input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} />
                <span className="text-sm text-ps-text dark:text-white">{label}</span>
              </label>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Describe the evidence you saw (required)…"
            className="mt-4 w-full rounded-lg border border-[var(--ps-border-light)] bg-transparent p-3 text-sm text-ps-text outline-none focus:border-ps-lime dark:border-[var(--ps-border-dark)] dark:text-white"
          />
          <PSButton
            className="mt-3"
            disabled={busy || notes.trim().length < 10}
            onClick={() => onAction(assignment.id, 'decision', { decision, notes })}
          >
            Lock decision and open dispute window
          </PSButton>
        </Card>
      )}
    </div>
  );
}

function AssignmentHistory({ assignments }: { assignments: Assignment[] }) {
  return (
    <Card>
      <CardTitle>Assignment history</CardTitle>
      <div className="mt-4 divide-y divide-[var(--ps-border-light)] dark:divide-[var(--ps-border-dark)]">
        {assignments.length === 0 ? (
          <p className="py-5 text-sm text-ps-muted">No assignments yet.</p>
        ) : assignments.slice(0, 10).map((assignment) => (
          <div key={assignment.id} className="flex items-center justify-between py-3 text-sm">
            <div className="flex items-center gap-3">
              <Swords className="h-4 w-4 text-ps-lime" />
              <span className="text-ps-text dark:text-white">{assignment.bet.game.name}</span>
            </div>
            <span className="text-ps-muted dark:text-ps-muted-on-dark">{assignment.status.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
