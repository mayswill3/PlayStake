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
import { useRouter } from 'next/navigation';
import { RulesConsentDialog } from '@/components/rules/RulesConsent';
import { useToast } from '@/components/ui/Toast';
import { type MyInvite } from './ChallengeItem';
import { ChallengeModal } from './ChallengeModal';

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
  requiresReferee: boolean;
}

const POLL_MS = 6000;

/**
 * What to tell the challenger when a challenge they sent stops being pending
 * without being accepted. Returns null when there's nothing to say: they
 * cancelled it themselves, or sent a newer challenge that replaced it.
 */
function closedChallengeMessage(
  challenge: MyOutgoingChallenge,
  all: MyOutgoingChallenge[],
): string | null {
  const who = challenge.streamer.displayName;
  const game = challenge.gameName;
  switch (challenge.status) {
    case 'DECLINED':
      return `${who} declined your ${game} challenge. Nothing was taken from your balance.`;
    case 'EXPIRED':
      return `${who} didn't respond to your ${game} challenge in time. Nothing was taken from your balance.`;
    case 'CANCELLED': {
      const replacedByNewer = all.some(
        (other) => other.challengeId !== challenge.challengeId && other.createdAt > challenge.createdAt,
      );
      return replacedByNewer
        ? null
        : `${who} took another challenge, so yours was closed. Nothing was taken from your balance.`;
    }
    default:
      return null;
  }
}
// SSE messages are only a nudge to re-poll /api/lobby/invites.

interface ChallengesContextValue {
  invites: MyInvite[];
  outgoing: MyOutgoingChallenge[];
  loading: boolean;
  pendingCount: number;
  refereeOpenCount: number;
  busyId: string | null;
  busyOutgoingId: string | null;
  respond: (
    lobbyEntryId: string,
    action: 'ACCEPT' | 'DECLINE',
    acceptMatchRules?: boolean,
  ) => Promise<void>;
  cancelOutgoing: (challengeId: string) => Promise<void>;
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
 * render outside the dashboard (admin layout) where the provider
 * isn't mounted — there the badge is simply absent (0) rather than throwing.
 */
export function usePendingChallengeCount(): number {
  const ctx = useContext(ChallengesContext);
  return ctx?.pendingCount ?? 0;
}

/** Null-safe count of matches this user could referee right now — 0 for
 *  non-referees and outside the provider, so the badge simply stays absent. */
export function useOpenRefereeCount(): number {
  const ctx = useContext(ChallengesContext);
  return ctx?.refereeOpenCount ?? 0;
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
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [outgoing, setOutgoing] = useState<MyOutgoingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Set when accepting needs the Match Rules accepted first.
  const [rulesPromptId, setRulesPromptId] = useState<string | null>(null);
  const [busyOutgoingId, setBusyOutgoingId] = useState<string | null>(null);
  const [modalInvite, setModalInvite] = useState<MyInvite | null>(null);
  const [sseEnabled, setSseEnabled] = useState(false);
  const [refereeOpenCount, setRefereeOpenCount] = useState(0);

  const seenRef = useRef<Set<string>>(new Set());
  // Status of each sent challenge at the last poll, to spot ones that just closed.
  const outgoingStatusRef = useRef<Map<string, string>>(new Map());
  // Challenges this user cancelled here, so they aren't told about their own action.
  const selfCancelledRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/lobby/invites');
      if (!res.ok) return; // unauthenticated / transient — the poll retries
      const data = await res.json();
      const list: MyInvite[] = data.invites ?? [];
      const outgoingList: MyOutgoingChallenge[] = data.outgoing ?? [];
      setInvites(list);
      setOutgoing(outgoingList);
      setSseEnabled(Boolean(data.sseEnabled));
      setRefereeOpenCount(Number(data.refereeOpenCount) || 0);

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

      // Tell the challenger when a challenge they sent was declined, timed out
      // or was closed because the streamer took another one.
      if (initializedRef.current) {
        for (const challenge of outgoingList) {
          if (outgoingStatusRef.current.get(challenge.challengeId) !== 'PENDING') continue;
          if (challenge.status === 'PENDING') continue;
          if (challenge.status === 'ACCEPTED') {
            toast('success', `${challenge.streamer.displayName} accepted your ${challenge.gameName} challenge. An independent referee is joining.`);
            if (challenge.betId) router.push(`/bets/${challenge.betId}`);
            continue;
          }
          if (selfCancelledRef.current.has(challenge.challengeId)) continue;
          const message = closedChallengeMessage(challenge, outgoingList);
          if (message) toast('info', message);
        }
      }
      outgoingStatusRef.current = new Map(outgoingList.map((c) => [c.challengeId, c.status]));

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
      es = new EventSource('/api/lobby/stream');
    } catch {
      return;
    }
    es.onmessage = () => refreshRef.current();
    es.onerror = () => es.close(); // fall back to polling
    return () => es.close();
  }, [sseEnabled]);

  const respond = useCallback(
    async (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE', acceptMatchRules = false) => {
      setBusyId(lobbyEntryId);
      try {
        const res = await fetch('/api/lobby/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyEntryId, response: action, acceptMatchRules }),
        });
        if (!res.ok) {
          const errorBody = await res.clone().json().catch(() => ({}));
          if (errorBody?.code === 'MATCH_RULES_REQUIRED') {
            // First stream match (or the rules changed): ask, then accept again.
            setModalInvite(null);
            setRulesPromptId(lobbyEntryId);
            return;
          }
          // Expired / already-gone races: entry vanished or is no longer INVITED.
          if (res.status === 404 || res.status === 409) {
            toast('info', 'That challenge is no longer available — it may have expired.');
          } else {
            const body = await res.json().catch(() => ({}));
            toast('error', body.error || 'Could not respond to the challenge.');
          }
        } else if (action === 'ACCEPT') {
          // Every match is refereed: open the bet's page, which tracks the
          // referee joining and the result.
          const body = await res.json().catch(() => ({}));
          if (body?.status === 'MATCHED' && body?.betId) {
            toast('success', 'Challenge accepted — funds locked while an independent referee joins.');
            router.push(`/bets/${body.betId}`);
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
      selfCancelledRef.current.add(challengeId);
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
    [refresh, toast, router],
  );

  const value: ChallengesContextValue = {
    invites,
    outgoing,
    loading,
    pendingCount: invites.length,
    refereeOpenCount,
    busyId,
    busyOutgoingId,
    respond,
    cancelOutgoing,
    refresh,
  };

  return (
    <ChallengesContext.Provider value={value}>
      {children}
      <RulesConsentDialog
        open={rulesPromptId !== null}
        kind="player"
        busy={rulesPromptId !== null && busyId === rulesPromptId}
        acceptLabel="Accept rules and challenge"
        onAccept={async () => {
          const id = rulesPromptId;
          if (!id) return;
          await respond(id, 'ACCEPT', true);
          setRulesPromptId(null);
        }}
        onClose={() => setRulesPromptId(null)}
      />
      <ChallengeModal
        invite={modalInvite}
        busy={modalInvite !== null && busyId === modalInvite.lobbyEntryId}
        onRespond={respond}
        onClose={() => setModalInvite(null)}
      />
    </ChallengesContext.Provider>
  );
}
