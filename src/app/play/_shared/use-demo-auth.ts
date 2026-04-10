'use client';

import { useState, useCallback } from 'react';
import type { PlayerRole, GameType, DemoAuthState } from './types';

async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function useDemoAuth(gameType: GameType, onLog?: (msg: string, level: 'info' | 'success' | 'error') => void) {
  const [authState, setAuthState] = useState<DemoAuthState | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = onLog ?? (() => {});

  const setup = useCallback(async (_role: PlayerRole) => {
    setIsSettingUp(true);
    setError(null);

    try {
      log('Starting setup...', 'info');

      // Call the setup endpoint — uses the current session cookie
      const result = await apiPost('/api/demo/setup', { gameType });

      if (result.error) {
        // If not logged in, redirect to login
        if (result.code === 'UNAUTHORIZED') {
          window.location.href = '/login?redirect=/play';
          return null;
        }
        throw new Error(result.error);
      }

      log(`Logged in as ${result.displayName} (${result.playerId.slice(0, 8)}...)`, 'success');
      log(`API key: ${result.apiKey.slice(0, 16)}...`, 'success');
      log(`Game ID: ${result.gameId.slice(0, 8)}...`, 'success');
      log(`Widget token: ${result.widgetToken.slice(0, 16)}...`, 'success');

      // Cleanup stale bets
      log('Cleaning up stale bets...', 'info');
      const cleanup = await apiPost('/api/demo/cleanup-bets', {
        playerId: result.playerId,
        gameId: result.gameId,
      });
      if (cleanup.voidedCount > 0) {
        log(`Cleaned up ${cleanup.voidedCount} stale bet(s)`, 'success');
      }

      const state: DemoAuthState = {
        playerId: result.playerId,
        apiKey: result.apiKey,
        gameId: result.gameId,
        widgetToken: result.widgetToken,
      };
      setAuthState(state);
      setIsSettingUp(false);
      return state;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Setup failed: ${msg}`, 'error');
      setError(msg);
      setIsSettingUp(false);
      return null;
    }
  }, [gameType, log]);

  return { authState, isSettingUp, error, setup };
}
