'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { PlayerRole } from '@/app/play/_shared/types';
import {
  useLobbyPlayersPolling,
  useLobbyStatusPolling,
  type LobbyRoleApi,
  type LobbyStatusResponse,
} from '@/hooks/useLobbyPolling';
import { StakePicker } from './StakePicker';
import { PlayerALobby } from './PlayerALobby';
import { PlayerBWaiting } from './PlayerBWaiting';
import { InviteReceived } from './InviteReceived';
import { InviteSent } from './InviteSent';
import { MatchFound } from './MatchFound';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContainerStatus =
  | 'stake-picker'
  | 'joining'
  | 'waiting'
  | 'invite-sent'
  | 'invite-received'
  | 'matched'
  | 'leaving';

export interface LobbyMatchResult {
  betId: string;
  gameType: string;
  stakeCents: number;
  playerAUserId: string;
  playerBUserId: string;
  playerAName: string;
  playerBName: string;
  myRole: PlayerRole;
}

interface LobbyContainerProps {
  role: PlayerRole; // 'A' | 'B'
  gameType: string; // lowercase lobby game type
  gameName: string;
  myUserId: string;
  myDisplayName: string;
  onMatched: (result: LobbyMatchResult) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toApiRole(role: PlayerRole): LobbyRoleApi {
  return role === 'A' ? 'PLAYER_A' : 'PLAYER_B';
}

function oppositeApiRole(role: PlayerRole): LobbyRoleApi {
  return role === 'A' ? 'PLAYER_B' : 'PLAYER_A';
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LobbyContainer({
  role,
  gameType,
  gameName,
  myUserId,
  myDisplayName,
  onMatched,
}: LobbyContainerProps) {
  const { toast } = useToast();

  const [status, setStatus] = useState<ContainerStatus>('stake-picker');
  const [stakeCents, setStakeCents] = useState<number>(500);
  const [lobbyEntryId, setLobbyEntryId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitedTarget, setInvitedTarget] = useState<{
    targetEntryId: string;
    targetUserId: string;
    targetName: string;
    inviteExpiresAt: string;
  } | null>(null);
  const [matchSnapshot, setMatchSnapshot] = useState<LobbyMatchResult | null>(null);

  // Refs for lifecycle effects that shouldn't re-run when state flips
  const lobbyEntryIdRef = useRef<string | null>(null);
  const statusRef = useRef<ContainerStatus>('stake-picker');
  const prevPlayerCountRef = useRef(0);
  const twoMinWarningFiredRef = useRef(false);
  // Snapshot the most recent `invitedBy` payload — Player B's perspective
  // only. Needed at match time because the MATCHED status response clears
  // `invitedBy`.
  const lastInvitedByRef = useRef<{ userId: string; displayName: string } | null>(null);
  // Flips true once Player A has observed the invited target actually
  // drop out of the waiting-players list (meaning the server flipped them
  // to INVITED). Until that happens, any cached list that still contains
  // the target is stale from before the invite landed — ignore it.
  const inviteVanishConfirmedRef = useRef(false);

  useEffect(() => {
    lobbyEntryIdRef.current = lobbyEntryId;
  }, [lobbyEntryId]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------

  const playersEnabled = role === 'A' && (status === 'waiting' || status === 'invite-sent');
  const {
    data: playersData,
    error: playersError,
  } = useLobbyPlayersPolling(gameType, oppositeApiRole(role), playersEnabled, 3000);

  const statusPollInterval = status === 'invite-sent' ? 1500 : 2000;
  const statusEnabled =
    !!lobbyEntryId && status !== 'stake-picker' && status !== 'matched' && status !== 'leaving';
  const { data: lobbyStatus } = useLobbyStatusPolling(
    lobbyEntryId,
    statusEnabled,
    statusPollInterval
  );

  // -------------------------------------------------------------------------
  // New-player toast (Player A only)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (role !== 'A' || status !== 'waiting') {
      prevPlayerCountRef.current = playersData?.players.length ?? 0;
      return;
    }
    const count = playersData?.players.length ?? 0;
    if (count > prevPlayerCountRef.current) {
      toast('success', 'New opponent available!');
    }
    prevPlayerCountRef.current = count;
  }, [playersData, role, status, toast]);

  // -------------------------------------------------------------------------
  // Invite decline / expiry detection (Player A only)
  //
  // Player A's own lobby entry never changes state — only the target's entry
  // transitions WAITING → INVITED → (WAITING | MATCHED). We can't read the
  // target's entry directly via /api/lobby/status (auth-scoped to caller),
  // so we watch the players list instead. The sequence we look for:
  //   1. After sending the invite, a poll returns a list WITHOUT the target
  //      (they've been flipped to INVITED server-side). Set the "vanish
  //      confirmed" flag.
  //   2. After that, a poll returns a list WITH the target again — that
  //      means B declined or the server-side expiry worker flipped them
  //      back to WAITING. Toast and revert.
  //
  // Gating on the vanish confirmation prevents a false-positive on the very
  // first render after invite-sent, where the cached playersData still
  // reflects the state from BEFORE the invite hit the server.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (role !== 'A' || status !== 'invite-sent' || !invitedTarget) return;
    if (!playersData) return;
    const targetInList = playersData.players.some(
      (p) => p.lobbyEntryId === invitedTarget.targetEntryId
    );
    if (!targetInList) {
      // Target has transitioned to INVITED — any subsequent reappearance
      // is now a real decline/expiry signal.
      if (!inviteVanishConfirmedRef.current) {
        inviteVanishConfirmedRef.current = true;
      }
      return;
    }
    // Target is in the list. Only treat this as a decline if we've already
    // confirmed they vanished at some point during this invite.
    if (inviteVanishConfirmedRef.current) {
      toast('info', `${invitedTarget.targetName} didn't accept — choose another player.`);
      setInvitedTarget(null);
      setStatus('waiting');
    }
  }, [playersData, role, status, invitedTarget, toast]);

  // -------------------------------------------------------------------------
  // 2-minute expiry warning
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!expiresAt || twoMinWarningFiredRef.current) return;
    const check = () => {
      const remaining = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (remaining > 0 && remaining <= 120 && !twoMinWarningFiredRef.current) {
        twoMinWarningFiredRef.current = true;
        toast('info', 'Lobby expires in 2 minutes');
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [expiresAt, toast]);

  // -------------------------------------------------------------------------
  // Status poll reactions (invite received / match / expired)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!lobbyStatus) return;

    if (lobbyStatus.expiresAt !== expiresAt) {
      setExpiresAt(lobbyStatus.expiresAt);
    }

    handleStatusPoll(lobbyStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyStatus]);

  const handleStatusPoll = (statusResp: LobbyStatusResponse) => {
    // Match confirmed from either direction
    if (statusResp.status === 'MATCHED' && statusResp.betId) {
      if (statusRef.current === 'matched') return;
      // Resolve both user ids depending on perspective. We prefer snapshots
      // we captured mid-flow because getLobbyStatus only returns `invitedBy`
      // while the entry is in INVITED state — once MATCHED it's null.
      const capturedInviter = lastInvitedByRef.current;
      const playerAUserId =
        role === 'A' ? myUserId : capturedInviter?.userId ?? '';
      const playerBUserId =
        role === 'B' ? myUserId : invitedTarget?.targetUserId ?? '';
      const finalMatch: LobbyMatchResult = {
        betId: statusResp.betId,
        gameType: statusResp.gameType,
        stakeCents,
        playerAUserId,
        playerBUserId,
        playerAName:
          role === 'A' ? myDisplayName : capturedInviter?.displayName ?? 'Player A',
        playerBName: role === 'B' ? myDisplayName : invitedTarget?.targetName ?? 'Player B',
        myRole: role,
      };
      setMatchSnapshot(finalMatch);
      setStatus('matched');
      // Slight delay so both players actually see the match screen
      setTimeout(() => onMatched(finalMatch), 1500);
      return;
    }

    // Expired from server side
    if (statusResp.status === 'EXPIRED' || statusResp.status === 'CANCELLED') {
      toast('error', 'Lobby expired. Please try again.');
      setLobbyEntryId(null);
      setExpiresAt(null);
      setStatus('stake-picker');
      return;
    }

    // Player B: invite came in
    if (role === 'B' && statusResp.status === 'INVITED' && statusResp.invitedBy) {
      lastInvitedByRef.current = {
        userId: statusResp.invitedBy.userId,
        displayName: statusResp.invitedBy.displayName,
      };
      if (statusRef.current !== 'invite-received') {
        setStatus('invite-received');
      }
      // Keep stake in sync with inviter
      if (statusResp.invitedBy.stakeAmount !== stakeCents) {
        setStakeCents(statusResp.invitedBy.stakeAmount);
      }
      return;
    }

    // Player B: invite expired or declined on our side — back to waiting
    if (role === 'B' && statusResp.status === 'WAITING') {
      if (statusRef.current === 'invite-received') {
        toast('info', 'Invite expired — still in lobby');
        setStatus('waiting');
      }
      return;
    }

    // Player A's own lobby entry is always WAITING — the INVITED state lives
    // on the target's entry, not ours. Decline / invite-expiry detection
    // happens via the separate players-list polling effect below.
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleJoin = useCallback(async () => {
    setError(null);
    setStatus('joining');
    try {
      const res = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType,
          role: toApiRole(role),
          stakeAmount: stakeCents,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to join lobby');
      }
      setLobbyEntryId(body.lobbyEntryId);
      setExpiresAt(body.expiresAt);
      twoMinWarningFiredRef.current = false;
      setStatus('waiting');
    } catch (err) {
      setStatus('stake-picker');
      const msg = err instanceof Error ? err.message : 'Failed to join lobby';
      setError(msg);
      toast('error', msg);
    }
  }, [gameType, role, stakeCents, toast]);

  const handleInvite = useCallback(
    async (targetEntryId: string) => {
      if (!lobbyEntryId) return;
      const target = playersData?.players.find((p) => p.lobbyEntryId === targetEntryId);
      try {
        const res = await fetch('/api/lobby/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyEntryId, targetEntryId }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to send invite');
        }
        // Reset the vanish-confirmation flag so the decline detector can
        // prove absence → presence for THIS invite specifically.
        inviteVanishConfirmedRef.current = false;
        setInvitedTarget({
          targetEntryId,
          targetUserId: target?.userId ?? '',
          targetName: target?.displayName ?? 'Opponent',
          inviteExpiresAt: body.expiresAt,
        });
        setStatus('invite-sent');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send invite';
        toast('error', msg);
      }
    },
    [lobbyEntryId, playersData, toast]
  );

  const handleRespond = useCallback(
    async (response: 'ACCEPT' | 'DECLINE') => {
      if (!lobbyEntryId) return;
      try {
        const res = await fetch('/api/lobby/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyEntryId, response }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to respond');
        }
        if (response === 'DECLINE') {
          setStatus('waiting');
          return;
        }
        // ACCEPT → MATCHED response shape { status, betId, gameType }
        if (body?.status === 'MATCHED' && body?.betId) {
          const inviter =
            lastInvitedByRef.current ?? {
              userId: lobbyStatus?.invitedBy?.userId ?? '',
              displayName: lobbyStatus?.invitedBy?.displayName ?? 'Player A',
            };
          const finalMatch: LobbyMatchResult = {
            betId: body.betId,
            gameType: body.gameType,
            stakeCents,
            playerAUserId: inviter.userId,
            playerBUserId: myUserId,
            playerAName: inviter.displayName,
            playerBName: myDisplayName,
            myRole: role,
          };
          setMatchSnapshot(finalMatch);
          setStatus('matched');
          setTimeout(() => onMatched(finalMatch), 1500);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to respond';
        toast('error', msg);
      }
    },
    [lobbyEntryId, lobbyStatus, myDisplayName, onMatched, role, stakeCents, toast]
  );

  const handleLeave = useCallback(async () => {
    if (!lobbyEntryId) {
      setStatus('stake-picker');
      return;
    }
    setStatus('leaving');
    try {
      await fetch(`/api/lobby/leave?lobbyEntryId=${encodeURIComponent(lobbyEntryId)}`, {
        method: 'DELETE',
      });
    } catch {
      /* ignore — we're leaving anyway */
    }
    setLobbyEntryId(null);
    setExpiresAt(null);
    setInvitedTarget(null);
    setStatus('stake-picker');
    setError(null);
  }, [lobbyEntryId]);

  // -------------------------------------------------------------------------
  // Leave lobby on unmount — covers both "component unmount" (e.g. user
  // switches role on the page) and "page close/navigate" via `keepalive`.
  // We use fetch instead of sendBeacon because the leave endpoint is DELETE
  // and sendBeacon only issues POST. If the request doesn't reach the server
  // (hard kill), the 30-second expiry worker will still clean up stale
  // entries.
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      const id = lobbyEntryIdRef.current;
      const s = statusRef.current;
      if (!id) return;
      if (s === 'matched') return;
      try {
        void fetch(`/api/lobby/leave?lobbyEntryId=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (status === 'stake-picker' || status === 'joining') {
    return (
      <StakePicker
        value={stakeCents}
        onChange={setStakeCents}
        onJoin={handleJoin}
        isJoining={status === 'joining'}
        role={toApiRole(role)}
      />
    );
  }

  if (status === 'matched' && matchSnapshot) {
    return (
      <MatchFound
        playerAName={matchSnapshot.playerAName}
        playerBName={matchSnapshot.playerBName}
        stakeCents={matchSnapshot.stakeCents}
        gameName={gameName}
      />
    );
  }

  if (role === 'B' && status === 'invite-received' && lobbyStatus?.invitedBy && lobbyStatus.inviteExpiresAt) {
    return (
      <InviteReceived
        fromName={lobbyStatus.invitedBy.displayName}
        fromInitials={initialsFromName(lobbyStatus.invitedBy.displayName)}
        stakeCents={lobbyStatus.invitedBy.stakeAmount}
        gameName={gameName}
        inviteExpiresAt={lobbyStatus.inviteExpiresAt}
        onAccept={() => handleRespond('ACCEPT')}
        onDecline={() => handleRespond('DECLINE')}
      />
    );
  }

  if (role === 'A' && status === 'invite-sent' && invitedTarget) {
    return (
      <InviteSent
        targetName={invitedTarget.targetName}
        inviteExpiresAt={invitedTarget.inviteExpiresAt}
      />
    );
  }

  if (role === 'A') {
    return (
      <PlayerALobby
        players={playersData?.players ?? []}
        stakeCents={stakeCents}
        gameName={gameName}
        onInvite={handleInvite}
        invitePending={false}
        expiresAt={expiresAt}
        onLeave={handleLeave}
        isLeaving={status === 'leaving'}
        error={playersError ?? error}
      />
    );
  }

  // role === 'B' && waiting
  return (
    <PlayerBWaiting
      gameName={gameName}
      expiresAt={expiresAt}
      onLeave={handleLeave}
      isLeaving={status === 'leaving'}
    />
  );
}
