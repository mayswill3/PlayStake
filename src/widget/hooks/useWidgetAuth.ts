import { useState, useEffect, useCallback, useRef } from "react";
import type { WidgetConfig, WidgetAuthState, ApiError } from "../types";

/**
 * Manages widget token validation and provides an authenticated fetch wrapper.
 *
 * On mount, validates the widget token against the PlayStake API.
 * Provides `authFetch` — a wrapper around fetch that injects the
 * WidgetToken authorization header on every request.
 */
export function useWidgetAuth(config: WidgetConfig) {
  const [authState, setAuthState] = useState<WidgetAuthState>({
    status: "loading",
    playerId: null,
    gameId: null,
    error: null,
  });

  const tokenRef = useRef(config.token);
  tokenRef.current = config.token;

  // Authenticated fetch — injects the WidgetToken header
  const authFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const url = config.apiBaseUrl + path;
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `WidgetToken ${tokenRef.current}`);
      headers.set("Content-Type", "application/json");

      return fetch(url, { ...init, headers });
    },
    [config.apiBaseUrl]
  );

  // Validate token on mount
  useEffect(() => {
    let cancelled = false;

    async function validate() {
      try {
        // Use the balance endpoint as a lightweight token validation check.
        // If the token is valid, the server returns balance data.
        // If invalid/expired, it returns 401.
        const res = await authFetch("/api/wallet/balance");

        if (cancelled) return;

        if (res.status === 401) {
          const body: ApiError = await res.json().catch(() => ({
            error: "Invalid or expired widget token",
          }));
          setAuthState({
            status: "error",
            playerId: null,
            gameId: null,
            error: body.error || "Authentication failed",
          });
          return;
        }

        if (!res.ok) {
          setAuthState({
            status: "error",
            playerId: null,
            gameId: null,
            error: `Unexpected error (${res.status})`,
          });
          return;
        }

        // Token is valid
        const balanceData = await res.json();
        setAuthState({
          status: "authenticated",
          playerId: balanceData.userId || null,
          gameId: config.gameId,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setAuthState({
          status: "error",
          playerId: null,
          gameId: null,
          error:
            err instanceof Error
              ? err.message
              : "Network error — unable to connect",
        });
      }
    }

    validate();

    return () => {
      cancelled = true;
    };
  }, [config.token, config.gameId, authFetch]);

  return { authState, authFetch };
}
