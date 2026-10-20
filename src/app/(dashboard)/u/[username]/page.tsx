'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BellPlus, BellRing, Ban, Radio, Settings } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { Avatar } from '@/components/ui/Avatar';

interface Profile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isStreamer: boolean;
  channelSlug: string | null;
  isLive: boolean;
  gameName: string | null;
  memberSince: string;
  isSelf: boolean;
  isFollowing: boolean;
  blockedByMe: boolean;
}

/** A player's profile: who they are, follow and block. No gambling activity. */
export default function PlayerProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [busy, setBusy] = useState<'follow' | 'block' | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, { cache: 'no-store' });
      if (!res.ok) {
        setState('missing');
        return;
      }
      setProfile((await res.json()).profile);
      setState('ready');
    } catch {
      setState('missing');
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    const next = !profile.isFollowing;
    setBusy('follow');
    setProfile({ ...profile, isFollowing: next });
    try {
      const res = await fetch(`/api/users/${profile.username}/follow`, { method: next ? 'POST' : 'DELETE' });
      if (!res.ok) throw new Error();
      toast(
        'success',
        next
          ? `You're following ${profile.displayName}.${profile.isStreamer ? " We'll let you know when they go live." : ''}`
          : `You've unfollowed ${profile.displayName}.`,
      );
    } catch {
      setProfile({ ...profile, isFollowing: !next });
      toast('error', 'Could not update follow. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function setBlocked(block: boolean) {
    if (!profile) return;
    setBusy('block');
    try {
      const res = await fetch(`/api/users/${profile.username}/block`, { method: block ? 'POST' : 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', data.error ?? 'Something went wrong.');
        return;
      }
      setProfile({ ...profile, blockedByMe: block, isFollowing: block ? false : profile.isFollowing });
      setConfirmBlock(false);
      toast('success', block ? `You've blocked ${profile.displayName}.` : `You've unblocked ${profile.displayName}.`);
    } finally {
      setBusy(null);
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (state === 'missing' || !profile) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-ps-text dark:text-ps-text-on-dark">Player not found</h1>
        <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
          They may have changed their username, or chosen not to be findable.
        </p>
        <PSButton variant="ghost" className="mt-6" onClick={() => router.back()}>
          Go back
        </PSButton>
      </div>
    );
  }

  const joined = new Date(profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Card className="bg-ps-paper-elevated dark:bg-ps-ink-2 border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          <div className={`rounded-full p-1 ${profile.isLive ? 'ring-2 ring-rose-500' : ''}`}>
            <Avatar src={profile.avatarUrl} name={profile.displayName} size="lg" className="!h-24 !w-24 !text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold text-ps-text dark:text-ps-text-on-dark">
              {profile.displayName}
            </h1>
            <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">@{profile.username}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs sm:justify-start">
              {profile.isLive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 font-bold uppercase tracking-wider text-white">
                  <Radio size={12} aria-hidden="true" /> Live{profile.gameName ? ` · ${profile.gameName}` : ''}
                </span>
              ) : profile.isStreamer ? (
                <span className="rounded-full border border-[var(--ps-border-light)] px-2.5 py-1 font-semibold uppercase tracking-wider text-ps-muted dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark">
                  Streamer
                </span>
              ) : null}
              <span className="text-ps-muted dark:text-ps-muted-on-dark">Joined {joined}</span>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
              {profile.isSelf ? (
                <Link href="/settings">
                  <PSButton variant="secondary" icon={<Settings size={16} />}>
                    Edit profile
                  </PSButton>
                </Link>
              ) : profile.blockedByMe ? (
                <PSButton variant="secondary" loading={busy === 'block'} onClick={() => setBlocked(false)}>
                  Unblock
                </PSButton>
              ) : (
                <>
                  <PSButton
                    variant={profile.isFollowing ? 'secondary' : 'primary'}
                    loading={busy === 'follow'}
                    onClick={toggleFollow}
                    icon={profile.isFollowing ? <BellRing size={16} /> : <BellPlus size={16} />}
                  >
                    {profile.isFollowing ? 'Following' : 'Follow'}
                  </PSButton>
                  {profile.channelSlug && (
                    <Link href={`/streams/${profile.channelSlug}`}>
                      <PSButton variant="secondary" icon={<Radio size={16} />}>
                        {profile.isLive ? 'Watch & challenge' : 'Stream page'}
                      </PSButton>
                    </Link>
                  )}
                  <PSButton variant="ghost" icon={<Ban size={16} />} onClick={() => setConfirmBlock(true)}>
                    Block
                  </PSButton>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {profile.isSelf && (
        <p className="text-center text-sm text-ps-muted dark:text-ps-muted-on-dark">
          This is how other players see you. Results, stakes and your balance are never shown.
        </p>
      )}

      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Block ${profile.displayName}?`}
        actions={
          <>
            <PSButton variant="ghost" onClick={() => setConfirmBlock(false)}>
              Cancel
            </PSButton>
            <PSButton variant="danger" loading={busy === 'block'} onClick={() => setBlocked(true)}>
              Block
            </PSButton>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>They won&apos;t be able to find you, see your profile or challenge you.</li>
          <li>You&apos;ll stop following each other.</li>
          <li>They aren&apos;t told. You can unblock them any time in Settings.</li>
        </ul>
      </Dialog>
    </div>
  );
}
