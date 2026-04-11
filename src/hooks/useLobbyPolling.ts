'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Shared types — mirror the backend DTOs in src/lib/lobby/service.ts
// ---------------------------------------------------------------------------

export type LobbyRoleApi = 'PLAYER_A' | 'PLAYER_B';
export type LobbyStatusApi =
  | 'WAITING'
  | 'INVITED'
  | 'MATCHED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface LobbyPlayer {
  lobbyEntryId: string;
  userId: string;
  displayName: string;
  avatarInitials: string;
  stakeAmount: number;
  waitingSince: string;
  status: 'WAITING';
}

export interface LobbyPlayersResponse {
  players: LobbyPlayer[];
  totalWaiting: number;
}

export interface LobbyInvitedBy {
  userId: string;
  displayName: string;
  stakeAmount: number;
  gameType: string;
  fromLobbyEntryId: string;
}

export interface LobbyStatusResponse {
  lobbyEntryId: string;
  status: LobbyStatusApi;
  gameType: string;
  role: LobbyRoleApi;
  betId: string | null;
  expiresAt: string;
  inviteExpiresAt: string | null;
  invitedBy: LobbyInvitedBy | null;
}

// ---------------------------------------------------------------------------
// useLobbyPlayersPolling — Player A's view of waiting Player Bs
// ---------------------------------------------------------------------------

export interface UseLobbyPlayersPollingResult {
  data: LobbyPlayersResponse | null;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLobbyPlayersPolling(
  gameType: string | null,
  oppositeRole: LobbyRoleApi,
  enabled: boolean,
  intervalMs = 3000
): UseLobbyPlayersPollingResult {
  const [data, setData] = useState<LobbyPlayersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!gameType) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(
        `/api/lobby/players?gameType=${encodeURIComponent(gameType)}&role=${oppositeRole}`,
        { signal: ac.signal, cache: 'no-store' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load lobby (${res.status})`);
      }
      const json = (await res.json()) as LobbyPlayersResponse;
      setData(json);
      setError(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
    }
  }, [gameType, oppositeRole]);

  useEffect(() => {
    if (!enabled || !gameType) return;
    void fetchOnce();
    const id = setInterval(() => {
      void fetchOnce();
    }, intervalMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [enabled, gameType, fetchOnce, intervalMs]);

  return { data, error, refetch: fetchOnce };
}

// ---------------------------------------------------------------------------
// useLobbyStatusPolling — caller's own entry status (used by both roles)
// ---------------------------------------------------------------------------

export interface UseLobbyStatusPollingResult {
  data: LobbyStatusResponse | null;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLobbyStatusPolling(
  lobbyEntryId: string | null,
  enabled: boolean,
  intervalMs = 2000
): UseLobbyStatusPollingResult {
  const [data, setData] = useState<LobbyStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!lobbyEntryId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(
        `/api/lobby/status?lobbyEntryId=${encodeURIComponent(lobbyEntryId)}`,
        { signal: ac.signal, cache: 'no-store' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to fetch status (${res.status})`);
      }
      const json = (await res.json()) as LobbyStatusResponse;
      setData(json);
      setError(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
    }
  }, [lobbyEntryId]);

  useEffect(() => {
    if (!enabled || !lobbyEntryId) return;
    void fetchOnce();
    const id = setInterval(() => {
      void fetchOnce();
    }, intervalMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [enabled, lobbyEntryId, fetchOnce, intervalMs]);

  return { data, error, refetch: fetchOnce };
}
