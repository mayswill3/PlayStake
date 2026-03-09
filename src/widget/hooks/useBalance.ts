import { useState, useEffect, useCallback, useRef } from "react";
import type { BalanceData } from "../types";

/**
 * Fetches and caches the player's wallet balance.
 * Exposes a `refresh` function that other hooks call after bet actions.
 */
export function useBalance(
  authFetch: (path: string, init?: RequestInit) => Promise<Response>,
  isAuthenticated: boolean
) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const res = await authFetch("/api/wallet/balance");

      if (!mountedRef.current) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(body.error || `Failed (${res.status})`);
        return;
      }

      const data: BalanceData = await res.json();
      setBalance(data);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return { balance, loading, error, refresh };
}
