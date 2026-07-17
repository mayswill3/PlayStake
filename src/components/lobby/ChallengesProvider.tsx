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
import { useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import { ChallengeItem, type MyInvite } from './ChallengeItem';

const POLL_MS = 6000;
// The lobby SSE stream requires a gameType but also subscribes the caller to
// their per-user lobby:invite:<userId> channel regardless — so any valid game
// type opens the invite feed. We only use messages as a nudge to re-poll.
const SSE_GAMETYPE = 'darts';

interface ChallengesContextValue {
  invites: MyInvite[];
  loading: boolean;
  pendingCount: number;
  busyId: string | null;
  respond: (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE') => Promise<void>;
  refresh: () => Promise<void>;
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
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalInvite, setModalInvite] = useState<MyInvite | null>(null);
  const [sseEnabled, setSseEnabled] = useState(false);

  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/lobby/invites');
      if (!res.ok) return; // unauthenticated / transient — the poll retries
      const data = await res.json();
      const list: MyInvite[] = data.invites ?? [];
      setInvites(list);
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
      initializedRef.current = true;
    } catch {
      /* network blip — the next poll retries */
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
          toast('success', 'Challenge accepted — your match is set!');
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
    [refresh, toast],
  );

  const value: ChallengesContextValue = {
    invites,
    loading,
    pendingCount: invites.length,
    busyId,
    respond,
    refresh,
  };

  return (
    <ChallengesContext.Provider value={value}>
      {children}
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
