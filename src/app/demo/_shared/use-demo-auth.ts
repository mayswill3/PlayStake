'use client';

import { useState, useCallback } from 'react';
import type { PlayerRole, DemoAuthState } from './types';

const PLAYER_A_EMAIL = 'player@test.playstake.com';
const PLAYER_A_PASS = 'TestPlayer123!';
const PLAYER_B_EMAIL = 'player2@test.playstake.com';
const PLAYER_B_PASS = 'TestPlayer2!';
const DEV_EMAIL = 'developer@test.playstake.com';
const DEV_PASS = 'TestDev123!';

async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function useDemoAuth(onLog?: (msg: string, level: 'info' | 'success' | 'error') => void) {
  const [authState, setAuthState] = useState<DemoAuthState | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = onLog ?? (() => {});

  const setup = useCallback(async (role: PlayerRole) => {
    setIsSettingUp(true);
    setError(null);

    try {
      log('Starting setup...', 'info');

      // 1. Login as the chosen player
      const playerEmail = role === 'A' ? PLAYER_A_EMAIL : PLAYER_B_EMAIL;
      const playerPass = role === 'A' ? PLAYER_A_PASS : PLAYER_B_PASS;

      const playerLogin = await apiPost('/api/auth/login', {
        email: playerEmail,
        password: playerPass,
      });

      if (playerLogin.error) throw new Error('Player login failed: ' + playerLogin.error);
      const playerId = playerLogin.user.id;
      log(`Logged in as ${playerLogin.user.displayName} (${playerId.slice(0, 8)}...)`, 'success');

      // 2. Login as developer to get API key
      const devLogin = await apiPost('/api/auth/login', {
        email: DEV_EMAIL,
        password: DEV_PASS,
      });

      if (devLogin.error) throw new Error('Developer login failed: ' + devLogin.error);
      log('Developer session established', 'success');

      // 3. Create API key
      const newKey = await apiPost('/api/developer/api-keys', {
        label: 'demo-game',
        permissions: ['bet:create', 'bet:read', 'result:report', 'webhook:manage', 'widget:auth'],
      });
      const apiKey = newKey.key;
      log(`API key: ${apiKey.slice(0, 16)}...`, 'success');

      // 4. Get game ID
      const gamesRes = await fetch('/api/developer/games');
      const gamesData = await gamesRes.json();
      const gameId = gamesData.data?.[0]?.id || gamesData.games?.[0]?.id;
      if (!gameId) throw new Error('No games found');
      log(`Game ID: ${gameId.slice(0, 8)}...`, 'success');

      // 5. Cleanup stale bets
      log('Cleaning up stale bets...', 'info');
      const cleanup = await apiPost('/api/demo/cleanup-bets', { playerId, gameId });
      if (cleanup.voidedCount > 0) {
        log(`Cleaned up ${cleanup.voidedCount} stale bet(s)`, 'success');
      }

      // 6. Generate widget token
      const tokenRes = await fetch('/api/v1/widget/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          playerId,
          gameId,
          idempotencyKey: `wt_${role}_${Date.now()}`,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) throw new Error('Widget token failed: ' + tokenData.error);
      const widgetToken = tokenData.widgetToken;
      log(`Widget token: ${widgetToken.slice(0, 16)}...`, 'success');

      const state: DemoAuthState = { playerId, apiKey, gameId, widgetToken };
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
  }, [log]);

  return { authState, isSettingUp, error, setup };
}
