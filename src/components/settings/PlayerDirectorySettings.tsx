'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

interface Me {
  username: string | null;
  usernameChangeAvailableAt: string | null;
  discoverable: boolean;
}

interface Blocked {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

const cardClass =
  'bg-ps-paper-elevated dark:bg-ps-ink-2 border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]';

/** Username, whether others can find you, and the people you've blocked. */
export function PlayerDirectorySettings() {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [username, setUsername] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileRes, blockedRes] = await Promise.all([
        fetch('/api/user/profile', { cache: 'no-store' }),
        fetch('/api/users/blocked', { cache: 'no-store' }),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setMe(data);
        setUsername(data.username ?? '');
      }
      if (blockedRes.ok) setBlocked((await blockedRes.json()).blocked);
    } catch {
      /* the cards show their empty state */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
    return data as Me;
  }

  async function saveUsername(event: FormEvent) {
    event.preventDefault();
    setSavingName(true);
    try {
      const updated = await patch({ username });
      setMe(updated);
      setUsername(updated.username ?? '');
      toast('success', `Your username is now @${updated.username}.`);
    } catch (error) {
      toast('error', (error as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function setDiscoverable(discoverable: boolean) {
    if (!me) return;
    setSavingVisibility(true);
    setMe({ ...me, discoverable });
    try {
      await patch({ discoverable });
      toast('success', discoverable ? 'Other players can now find and follow you.' : "You're hidden from player search.");
    } catch {
      setMe({ ...me, discoverable: !discoverable });
      toast('error', 'Could not update this setting.');
    } finally {
      setSavingVisibility(false);
    }
  }

  async function unblock(target: Blocked) {
    setUnblocking(target.username);
    try {
      const res = await fetch(`/api/users/${target.username}/block`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setBlocked((list) => list.filter((b) => b.username !== target.username));
      toast('success', `You've unblocked ${target.displayName}.`);
    } catch {
      toast('error', 'Could not unblock. Please try again.');
    } finally {
      setUnblocking(null);
    }
  }

  const lockedUntil = me?.usernameChangeAvailableAt
    ? new Date(me.usernameChangeAvailableAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    : null;
  const unchanged = username.trim().replace(/^@/, '').toLowerCase() === (me?.username ?? '');

  return (
    <Card id="players" className={`scroll-mt-24 ${cardClass}`}>
      <CardTitle>Finding and following</CardTitle>
      <CardDescription>How other players find you. Your bets, results and balance are never shown.</CardDescription>

      <form onSubmit={saveUsername} className="mt-4 space-y-2">
        <Input
          label="Username"
          prefix={<span className="text-sm font-medium">@</span>}
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, ''))}
          maxLength={21}
          disabled={!me || Boolean(lockedUntil)}
          autoComplete="off"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
            {lockedUntil
              ? `You can change it again on ${lockedUntil}.`
              : '3–20 letters, numbers or underscores. You can change it once every 30 days.'}
            {me?.username && (
              <>
                {' '}
                <Link href={`/u/${me.username}`} className="underline">
                  View your profile
                </Link>
              </>
            )}
          </p>
          <PSButton type="submit" size="sm" loading={savingName} disabled={!me || Boolean(lockedUntil) || unchanged}>
            Save username
          </PSButton>
        </div>
      </form>

      <div className="mt-5 flex items-start justify-between gap-4 rounded-[var(--ps-radius-md)] bg-ps-paper p-4 dark:bg-ps-ink-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">Let other players find and follow me</p>
          <p className="mt-1 text-xs text-ps-muted dark:text-ps-muted-on-dark">
            Shows your name, username and photo in player search. Streamers can always be found, because their
            channel is public. You&apos;re hidden automatically while on a break or self-excluded.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
          <input
            type="checkbox"
            checked={me?.discoverable ?? false}
            disabled={savingVisibility || !me}
            onChange={(event) => void setDiscoverable(event.target.checked)}
            className="h-4 w-4 accent-[var(--ps-lime)]"
          />
          {me?.discoverable ? 'On' : 'Off'}
        </label>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">Blocked players</p>
        {blocked.length === 0 ? (
          <p className="mt-1 text-xs text-ps-muted dark:text-ps-muted-on-dark">
            You haven&apos;t blocked anyone. You can block someone from their profile.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--ps-border-light)] dark:divide-[var(--ps-border-dark)]">
            {blocked.map((target) => (
              <li key={target.username} className="flex items-center gap-3 py-2">
                <Avatar src={target.avatarUrl} name={target.displayName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ps-text dark:text-ps-text-on-dark">{target.displayName}</span>
                  <span className="block truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">@{target.username}</span>
                </span>
                <PSButton variant="ghost" size="sm" loading={unblocking === target.username} onClick={() => unblock(target)}>
                  Unblock
                </PSButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
