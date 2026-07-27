'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import { ChallengeItem, type MyInvite } from './ChallengeItem';

/** A joinable match (bet reached MATCHED, not yet played) — mirrors MyMatchDTO. */
export interface MyMatch {
  betId: string;
  gameType: string;
  gameName: string;
  myRole: 'A' | 'B';
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  stakeAmount: number;
}

export interface MyOutgoingChallenge {
  challengeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  gameType: string;
  gameName: string;
  stakeAmount: number;
  streamer: { userId: string; displayName: string };
  expiresAt: string;
  createdAt: string;
  betId: string | null;
}

const POLL_MS = 6000;
// The lobby SSE stream requires a gameType but also subscribes the caller to
// their per-user lobby:invite:<userId> channel regardless — so any valid game
// type opens the invite feed. We only use messages as a nudge to re-poll.
const SSE_GAMETYPE = 'darts';

interface ChallengesContextValue {
  invites: MyInvite[];
  matches: MyMatch[];
  outgoing: MyOutgoingChallenge[];
  loading: boolean;
  pendingCount: number;
  busyId: string | null;
  busyOutgoingId: string | null;
  respond: (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE') => Promise<void>;
  cancelOutgoing: (challengeId: string) => Promise<void>;
  resumeMatch: (match: MyMatch) => void;
  refresh: () => Promise<void>;
}

/** Route segment for each game type: /play/<segment>. */
function playPath(gameType: string, betId: string): string {
  return `/play/${gameType}?bet=${betId}`;
}

const ChallengesContext = createContext<ChallengesContextValue | null>(null);

export function useChallenges(): ChallengesContextValue {
  const ctx = useContext(ChallengesContext);
  if (!ctx) throw new Error('useChallenges must be used within ChallengesProvider');
  return ctx;
}

/**
 * Null-safe pending count for nav badges. The shared Sidebar / bottom nav also
 * render outside the dashboard (admin layout, /play pages) where the provider
 * isn't mounted — there the badge is simply absent (0) rather than throwing.
 */
export function usePendingChallengeCount(): number {
  const ctx = useContext(ChallengesContext);
  return ctx?.pendingCount ?? 0;
}

/**
 * Ambient challenge listener + data source for the challenge inbox.
 *
 * Poll-primary (works with SSE off, the dev default): polls /api/lobby/invites.
 * If the server reports SSE is enabled, it also opens the existing lobby SSE
 * stream purely as a nudge to re-poll for instant delivery — polling stays the
 * source of truth. On a genuinely new invite it fires a toast + modal. Accept /
 * Decline route through /api/lobby/respond (the sole escrow handoff); this
 * component adds no money-path code.
 */
export function ChallengesProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [outgoing, setOutgoing] = useState<MyOutgoingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyOutgoingId, setBusyOutgoingId] = useState<string | null>(null);
  const [modalInvite, setModalInvite] = useState<MyInvite | null>(null);
  const [sseEnabled, setSseEnabled] = useState(false);

  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  // betIds this client has already navigated into (imperatively on accept or via
  // the ambient auto-route) — prevents double-navigation across the two paths.
  const routedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/lobby/invites');
      if (!res.ok) return; // unauthenticated / transient — the poll retries
      const data = await res.json();
      const list: MyInvite[] = data.invites ?? [];
      const matchList: MyMatch[] = data.matches ?? [];
      const outgoingList: MyOutgoingChallenge[] = data.outgoing ?? [];
      setInvites(list);
      setMatches(matchList);
      setOutgoing(outgoingList);
      setSseEnabled(Boolean(data.sseEnabled));

      // Surface only genuinely NEW invites — never on the first load.
      if (initializedRef.current) {
        const fresh = list.filter((i) => !seenRef.current.has(i.lobbyEntryId));
        if (fresh.length > 0) {
          const latest = fresh[fresh.length - 1];
          toast('info', `${latest.from.displayName} challenged you to ${latest.gameName}`);
          setModalInvite(latest);
        }
      }
      seenRef.current = new Set(list.map((i) => i.lobbyEntryId));

      // Accept->play handoff: route the player into any joinable match we
      // haven't already routed into. This is how an idle challenger gets pulled
      // into the game once their challenge is accepted — same ambient poll that
      // delivered the challenge. Only fires post-init so a page load doesn't
      // yank someone mid-navigation.
      if (initializedRef.current) {
        const toEnter = matchList.find((m) => !routedRef.current.has(m.betId));
        if (toEnter) {
          routedRef.current.add(toEnter.betId);
          toast('success', `Challenge on — joining ${toEnter.gameName}…`);
          router.push(playPath(toEnter.gameType, toEnter.betId));
        }
      }
      initializedRef.current = true;
    } catch {
      /* network blip — the next poll retries */
    } finally {
      setLoading(false);
    }
  }, [toast, router]);

  useEffect(() => {
    refreshRef.current = () => void refresh();
  }, [refresh]);

  // Primary path: poll.
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Upgrade: when the server flag is on, use SSE messages as a re-poll nudge.
  useEffect(() => {
    if (!sseEnabled) return;
    let es: EventSource;
    try {
      es = new EventSource(`/api/lobby/stream?gameType=${SSE_GAMETYPE}`);
    } catch {
      return;
    }
    es.onmessage = () => refreshRef.current();
    es.onerror = () => es.close(); // fall back to polling
    return () => es.close();
  }, [sseEnabled]);

  const respond = useCallback(
    async (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE') => {
      setBusyId(lobbyEntryId);
      try {
        const res = await fetch('/api/lobby/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyEntryId, response: action }),
        });
        if (!res.ok) {
          // Expired / already-gone races: entry vanished or is no longer INVITED.
          if (res.status === 404 || res.status === 409) {
            toast('info', 'That challenge is no longer available — it may have expired.');
          } else {
            const body = await res.json().catch(() => ({}));
            toast('error', body.error || 'Could not respond to the challenge.');
          }
        } else if (action === 'ACCEPT') {
          // Route the accepter straight into the game for this bet. The response
          // carries { status: 'MATCHED', betId, gameType }. Mark it routed so the
          // ambient match-poll doesn't navigate again.
          const body = await res.json().catch(() => ({}));
          if (body?.status === 'MATCHED' && body?.betId && body?.gameType) {
            routedRef.current.add(body.betId);
            toast('success', 'Challenge accepted — starting the match…');
            router.push(playPath(body.gameType, body.betId));
          } else {
            toast('success', 'Challenge accepted — your match is set!');
          }
        } else {
          toast('info', 'Challenge declined.');
        }
      } catch {
        toast('error', 'Something went wrong.');
      } finally {
        setBusyId(null);
        setModalInvite((m) => (m?.lobbyEntryId === lobbyEntryId ? null : m));
        void refresh();
      }
    },
    [refresh, toast, router],
  );

  const cancelOutgoing = useCallback(
    async (challengeId: string) => {
      setBusyOutgoingId(challengeId);
      try {
        const res = await fetch(`/api/lobby/challenges/${challengeId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          if (res.status === 404 || res.status === 409) {
            toast('info', 'That challenge is no longer pending.');
          } else {
            const body = await res.json().catch(() => ({}));
            toast('error', body.error || 'Could not cancel the challenge.');
          }
          return;
        }
        toast('info', 'Challenge cancelled.');
        await refresh();
      } catch {
        toast('error', 'Something went wrong.');
      } finally {
        setBusyOutgoingId(null);
      }
    },
    [refresh, toast],
  );

  const resumeMatch = useCallback(
    (match: MyMatch) => {
      routedRef.current.add(match.betId);
      router.push(playPath(match.gameType, match.betId));
    },
    [router],
  );

  const value: ChallengesContextValue = {
    invites,
    matches,
    outgoing,
    loading,
    pendingCount: invites.length,
    busyId,
    busyOutgoingId,
    respond,
    cancelOutgoing,
    resumeMatch,
    refresh,
  };

  const resumableMatch = matches[0];
  const showResume = Boolean(resumableMatch) && !pathname.startsWith('/play/');

  return (
    <ChallengesContext.Provider value={value}>
      {children}
      {showResume && resumableMatch && (
        <div className="fixed bottom-20 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-brand-400/40 bg-surface-900 p-4 text-surface-100 shadow-2xl lg:bottom-6 lg:right-6">
          <p className="font-display font-semibold">Your match is ready</p>
          <p className="mt-1 text-sm text-surface-300">
            {resumableMatch.gameName} against{' '}
            {resumableMatch.myRole === 'A'
              ? resumableMatch.playerBName
              : resumableMatch.playerAName}
          </p>
          <Button
            className="mt-3 w-full"
            onClick={() => resumeMatch(resumableMatch)}
          >
            Resume match
          </Button>
        </div>
      )}
      <Dialog open={modalInvite !== null} onClose={() => setModalInvite(null)} title="New challenge">
        {modalInvite && (
          <ChallengeItem
            invite={modalInvite}
            busy={busyId === modalInvite.lobbyEntryId}
            onRespond={respond}
          />
        )}
      </Dialog>
    </ChallengesContext.Provider>
  );
}
