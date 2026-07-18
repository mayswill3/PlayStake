'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LobbyMatchResult } from '@/components/lobby/LobbyContainer';

/**
 * Accept->play handoff on the game page. When the page is opened as
 * /play/<game>?bet=<betId> (routed there by the challenge accept flow), this
 * looks the bet up among the caller's joinable matches and hands it to
 * `onResume`, which drives setup + joinFromLobby exactly like a normal match.
 *
 * Runs once. If the bet isn't a joinable match (already played, voided, or not
 * ours) it no-ops and the page falls back to the normal lobby UI.
 */
export function useResumeMatch(
  onResume: (match: LobbyMatchResult) => void | Promise<void>,
): void {
  const searchParams = useSearchParams();
  const betId = searchParams.get('bet');
  const startedRef = useRef(false);
  const cbRef = useRef(onResume);
  cbRef.current = onResume;

  useEffect(() => {
    if (!betId || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch('/api/lobby/invites');
        if (!res.ok) return;
        const data = await res.json();
        const m = (data.matches ?? []).find(
          (x: { betId: string }) => x.betId === betId,
        );
        if (!m) return; // not joinable — fall back to the normal lobby flow
        await cbRef.current({
          betId: m.betId,
          gameType: m.gameType,
          stakeCents: m.stakeAmount,
          playerAUserId: m.playerAId,
          playerBUserId: m.playerBId,
          playerAName: m.playerAName,
          playerBName: m.playerBName,
          myRole: m.myRole,
        });
      } catch {
        /* ignore — page stays on the normal lobby UI */
      }
    })();
  }, [betId]);
}
