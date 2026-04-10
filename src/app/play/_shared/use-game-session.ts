'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DemoPhase, GameType } from './types';

export interface GameSessionState {
  id: string;
  betId: string | null;
  board?: (string | null)[];
  turn?: 'A' | 'B';
  playerAId: string;
  playerBId: string | null;
  status: 'waiting' | 'playing' | 'finished';
  winner: 'A' | 'B' | 'draw' | null;
  gameType?: GameType;
  gameData?: Record<string, unknown>;
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiPatch(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path: string) {
  const res = await fetch(path);
  return res.json();
}

export function useGameSession(
  onLog?: (msg: string, level: 'info' | 'success' | 'error' | 'bet') => void
) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameSessionState | null>(null);
  const [phase, setPhase] = useState<DemoPhase>('role-select');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const log = onLog ?? (() => {});

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const createGame = useCallback(async (playerId: string, gameType: GameType) => {
    log('Creating game session...', 'info');
    const session = await apiPost('/api/demo/game', { playerAId: playerId, gameType });
    if (session.error) {
      log(`Failed to create game: ${session.error}`, 'error');
      return null;
    }
    setSessionId(session.id);
    setGameState(session);
    setPhase('lobby');
    log(`Game session: ${session.id}`, 'success');

    // Poll for opponent
    pollRef.current = setInterval(async () => {
      const state = await apiGet(`/api/demo/game/${session.id}`);
      if (state.status === 'playing') {
        log('Opponent joined! Game starting...', 'success');
        stopPolling();
        setGameState(state);
        setPhase('playing');
      }
    }, 1500);

    return session.id as string;
  }, [log, stopPolling]);

  const joinGame = useCallback(async (code: string, playerId: string, gameType?: GameType): Promise<true | string> => {
    const session = await apiGet(`/api/demo/game/${code}`);
    if (session.error) {
      log(`Failed to find game: ${session.error}`, 'error');
      return session.error as string;
    }
    if (session.status !== 'waiting') {
      log('Game already started', 'error');
      return 'Game already started';
    }

    setSessionId(code);
    log(`Found game ${code}, joining...`, 'info');

    const joined = await apiPatch(`/api/demo/game/${code}`, {
      action: 'join',
      playerBId: playerId,
      gameType,
    });

    if (joined.error) {
      log(`Failed to join: ${joined.error}`, 'error');
      return joined.error as string;
    }

    log('Joined! Accept the bet in the widget.', 'info');
    setGameState(joined);
    setPhase('playing');

    // Start polling for game state updates
    pollRef.current = setInterval(async () => {
      const state = await apiGet(`/api/demo/game/${code}`);
      if (state.error) return;
      setGameState(state);
      if (state.status === 'finished') {
        stopPolling();
        setPhase('finished');
      }
    }, 1000);

    return true;
  }, [log, stopPolling]);

  const startPlayingPoll = useCallback((id: string) => {
    // Start polling for game state (used by Player A after transition to playing)
    stopPolling();
    pollRef.current = setInterval(async () => {
      const state = await apiGet(`/api/demo/game/${id}`);
      if (state.error) return;
      setGameState(state);
      if (state.status === 'finished') {
        stopPolling();
        setPhase('finished');
      }
    }, 1000);
  }, [stopPolling]);

  const makeMove = useCallback(async (cell: number, player: 'A' | 'B') => {
    if (!sessionId) return null;
    const result = await apiPatch(`/api/demo/game/${sessionId}`, {
      action: 'move',
      cell,
      player,
    });
    if (result.error) {
      log(`Move failed: ${result.error}`, 'error');
      return null;
    }
    setGameState(result);
    if (result.status === 'finished') {
      stopPolling();
      setPhase('finished');
    }
    return result;
  }, [sessionId, log, stopPolling]);

  const resolveGame = useCallback(async (winner: 'A' | 'B' | 'draw') => {
    if (!sessionId) return null;
    const result = await apiPatch(`/api/demo/game/${sessionId}`, {
      action: 'resolve',
      winner,
    });
    if (result.error) {
      log(`Resolve failed: ${result.error}`, 'error');
      return null;
    }
    setGameState(result);
    stopPolling();
    setPhase('finished');
    return result;
  }, [sessionId, log, stopPolling]);

  const setGameData = useCallback(async (data: Record<string, unknown>) => {
    if (!sessionId) return null;
    return apiPatch(`/api/demo/game/${sessionId}`, {
      action: 'setGameData',
      data,
    });
  }, [sessionId]);

  const setBetId = useCallback(async (betId: string) => {
    if (!sessionId) return;
    await apiPatch(`/api/demo/game/${sessionId}`, {
      action: 'setBetId',
      betId,
    });
    log('Bet linked to game session', 'success');
  }, [sessionId, log]);

  const reportAndSettle = useCallback(async (apiKey: string, betId: string): Promise<{ outcome: string; winnerPayout: number } | null> => {
    if (!sessionId) return null;

    // Step 1: Try to report result (may fail if already reported — that's fine)
    log('Reporting result to PlayStake...', 'bet');
    try {
      const res = await apiPost(`/api/demo/game/${sessionId}/result`, { apiKey });
      if (res.success) {
        log('Result reported! Settling bet...', 'bet');
      } else {
        log('Result already handled by opponent, proceeding...', 'info');
      }
    } catch {
      log('Result report skipped, proceeding to settlement...', 'info');
    }

    // Step 2: Try to settle (pass sessionId so settle can self-heal if result wasn't reported)
    try {
      const settle = await apiPost('/api/demo/settle-bet', { betId, apiKey, sessionId });
      if (settle.success) {
        const payoutDisplay = settle.winnerPayout.toFixed(2);
        const outcomeLabel = settle.outcome === 'DRAW'
          ? 'Draw — both refunded'
          : `Winner receives $${payoutDisplay}`;
        log(`Bet settled! ${outcomeLabel}`, 'success');
        return { outcome: settle.outcome, winnerPayout: settle.winnerPayout };
      } else {
        log(`Settlement response: ${settle.error || 'unknown'}`, 'error');
      }
    } catch (err) {
      console.error('[SETTLE] Settlement API failed:', err);
      log('Settlement failed — will retry on next attempt', 'error');
    }

    // Step 3: Bet was already settled by opponent — fetch the result
    log('Fetching bet result...', 'info');
    try {
      const betData = await apiGet(`/api/demo/bet-result/${betId}`);
      if (betData.outcome) {
        log(`Bet result: ${betData.outcome}`, 'success');
        return { outcome: betData.outcome, winnerPayout: betData.winnerPayout ?? 0 };
      }
    } catch {
      log('Could not fetch bet result', 'error');
    }

    return null;
  }, [sessionId, log]);

  return {
    sessionId,
    gameState,
    phase,
    setPhase,
    createGame,
    joinGame,
    startPlayingPoll,
    makeMove,
    resolveGame,
    setGameData,
    setBetId,
    reportAndSettle,
    stopPolling,
  };
}
