'use client';

import { useEffect, useRef } from 'react';

/**
 * useLobbyStream — stub for SSE-backed lobby events.
 *
 * Backend exposes GET /api/lobby/stream but only when ENABLE_LOBBY_SSE=true.
 * Polling (useLobbyPlayersPolling / useLobbyStatusPolling) is the primary
 * mechanism; this hook exists so the rest of the UI can later be upgraded
 * to real-time updates without a refactor.
 *
 * If NEXT_PUBLIC_ENABLE_LOBBY_SSE !== 'true', this is a no-op.
 */
export function useLobbyStream(
  gameType: string | null,
  enabled: boolean,
  onEvent?: (event: Record<string, unknown>) => void
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !gameType) return;
    if (process.env.NEXT_PUBLIC_ENABLE_LOBBY_SSE !== 'true') return;

    const source = new EventSource(
      `/api/lobby/stream?gameType=${encodeURIComponent(gameType)}`
    );

    source.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as Record<string, unknown>;
        onEventRef.current?.(parsed);
      } catch {
        /* ignore malformed frames */
      }
    };

    source.onerror = () => {
      // Let polling carry the session; close on error to avoid retry storms.
      source.close();
    };

    return () => {
      source.close();
    };
  }, [enabled, gameType]);
}
