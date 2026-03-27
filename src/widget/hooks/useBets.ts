import { useState, useEffect, useCallback, useRef } from "react";
import type { BetData, CreateBetParams, BetOutcome } from "../types";

interface UseBetsOptions {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  gameId: string;
  isAuthenticated: boolean;
  onBalanceChange: () => void;
}

interface UseBetsReturn {
  openBets: BetData[];
  activeBet: BetData | null;
  recentBets: BetData[];
  loading: boolean;
  error: string | null;
  createBet: (params: CreateBetParams) => Promise<BetData | null>;
  consentBet: (betId: string) => Promise<BetData | null>;
  acceptBet: (betId: string) => Promise<BetData | null>;
  confirmResult: (betId: string, outcome: BetOutcome) => Promise<boolean>;
  disputeResult: (betId: string, reason: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

function generateIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Central hook for all bet operations.
 *
 * - Fetches open bets for the game (available to accept)
 * - Tracks the player's active/matched bet
 * - Keeps recent bet history
 * - Provides action functions: createBet, consentBet, acceptBet, confirmResult, disputeResult
 * - Auto-polls open bets every 5 seconds, active bet every 3 seconds
 */
export function useBets({
  authFetch,
  gameId,
  isAuthenticated,
  onBalanceChange,
}: UseBetsOptions): UseBetsReturn {
  const [openBets, setOpenBets] = useState<BetData[]>([]);
  const [activeBet, setActiveBet] = useState<BetData | null>(null);
  const [recentBets, setRecentBets] = useState<BetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // ---- Data fetching ----

  const fetchOpenBets = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/v1/bets?gameId=${encodeURIComponent(gameId)}&status=OPEN&limit=20`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current) {
        setOpenBets(data.data || []);
      }
    } catch {
      // Silently fail on poll errors; we'll retry
    }
  }, [authFetch, gameId]);

  const prevActiveBetStatusRef = useRef<string | null>(null);

  const fetchActiveBet = useCallback(async () => {
    try {
      // Fetch bets in active states for this game
      const statuses = ["PENDING_CONSENT", "OPEN", "MATCHED", "RESULT_REPORTED"];
      for (const status of statuses) {
        const res = await authFetch(
          `/api/v1/bets?gameId=${encodeURIComponent(gameId)}&status=${status}&limit=1`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const bet = data.data[0];
          // Refresh balance when bet status changes (e.g. OPEN → MATCHED)
          if (prevActiveBetStatusRef.current && prevActiveBetStatusRef.current !== bet.status) {
            onBalanceChange();
          }
          prevActiveBetStatusRef.current = bet.status;
          if (mountedRef.current) setActiveBet(bet);
          return;
        }
      }
      // Bet disappeared (settled/cancelled) — refresh balance
      if (prevActiveBetStatusRef.current) {
        prevActiveBetStatusRef.current = null;
        onBalanceChange();
      }
      if (mountedRef.current) setActiveBet(null);
    } catch {
      // Silently fail
    }
  }, [authFetch, gameId, onBalanceChange]);

  const fetchRecentBets = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/v1/bets?gameId=${encodeURIComponent(gameId)}&status=SETTLED&limit=5`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current) {
        setRecentBets(data.data || []);
      }
    } catch {
      // Silently fail
    }
  }, [authFetch, gameId]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    await Promise.all([fetchOpenBets(), fetchActiveBet(), fetchRecentBets()]);
    if (mountedRef.current) {
      setLoading(false);
      setError(null);
    }
  }, [isAuthenticated, fetchOpenBets, fetchActiveBet, fetchRecentBets]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  // Auto-poll open bets every 5s
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(fetchOpenBets, 5000);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchOpenBets]);

  // Auto-poll active bet every 3s
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(fetchActiveBet, 3000);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchActiveBet]);

  // ---- Actions ----

  const createBet = useCallback(
    async (params: CreateBetParams): Promise<BetData | null> => {
      try {
        setError(null);
        const res = await authFetch("/api/v1/bets", {
          method: "POST",
          body: JSON.stringify({
            gameId,
            amount: params.amount,
            currency: "USD",
            opponentId: params.opponentId || undefined,
            gameMetadata: params.metadata || undefined,
            idempotencyKey: generateIdempotencyKey("bet_create"),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Failed to create bet" }));
          setError(body.error || "Failed to create bet");
          return null;
        }

        const bet: BetData = await res.json();
        await refresh();
        onBalanceChange();
        return bet;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [authFetch, gameId, refresh, onBalanceChange]
  );

  const consentBet = useCallback(
    async (betId: string): Promise<BetData | null> => {
      try {
        setError(null);
        const res = await authFetch(`/api/v1/bets/${betId}/consent`, {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: generateIdempotencyKey("consent"),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Failed to consent" }));
          setError(body.error || "Failed to consent to bet");
          return null;
        }

        const data = await res.json();
        await refresh();
        onBalanceChange();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [authFetch, refresh, onBalanceChange]
  );

  const acceptBet = useCallback(
    async (betId: string): Promise<BetData | null> => {
      try {
        setError(null);
        const res = await authFetch(`/api/v1/bets/${betId}/accept`, {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: generateIdempotencyKey("bet_accept"),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Failed to accept bet" }));
          if (res.status === 402) {
            setError("Insufficient balance to accept this bet");
          } else {
            setError(body.error || "Failed to accept bet");
          }
          return null;
        }

        const data = await res.json();
        await refresh();
        onBalanceChange();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [authFetch, refresh, onBalanceChange]
  );

  const confirmResult = useCallback(
    async (betId: string, outcome: BetOutcome): Promise<boolean> => {
      try {
        setError(null);
        const res = await authFetch(`/api/v1/bets/${betId}/widget-result`, {
          method: "POST",
          body: JSON.stringify({ outcome }),
        });

        if (!res.ok) {
          // 409 = other player already confirmed; treat as success
          if (res.status === 409) {
            await refresh();
            onBalanceChange();
            return true;
          }
          const body = await res.json().catch(() => ({ error: "Failed to confirm result" }));
          setError(body.error || "Failed to confirm result");
          return false;
        }

        await refresh();
        onBalanceChange();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return false;
      }
    },
    [authFetch, refresh, onBalanceChange]
  );

  const disputeResult = useCallback(
    async (betId: string, reason: string): Promise<boolean> => {
      try {
        setError(null);
        const res = await authFetch(`/api/bets/${betId}/dispute`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Failed to file dispute" }));
          setError(body.error || "Failed to file dispute");
          return false;
        }

        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return false;
      }
    },
    [authFetch, refresh]
  );

  return {
    openBets,
    activeBet,
    recentBets,
    loading,
    error,
    createBet,
    consentBet,
    acceptBet,
    confirmResult,
    disputeResult,
    refresh,
  };
}
