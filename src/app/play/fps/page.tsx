'use client';

import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Crosshair,
  Shield,
  Skull,
  Timer,
} from 'lucide-react';
import { useLandscapeLock } from '@/hooks/useLandscapeLock';
import { RotatePrompt } from '@/components/ui/RotatePrompt';
import { GameMobileFAB } from '@/components/ui/GameMobileFAB';
import { useEventLog } from '../_shared/use-event-log';
import { useDemoAuth } from '../_shared/use-demo-auth';
import { useGameSession } from '../_shared/use-game-session';
import { PlayStakeWidget, type PlayStakeWidgetHandle } from '../_shared/PlayStakeWidget';
import { GameResultOverlay, deriveOutcome, formatResultAmount, type SettlementResult } from '../_shared/GameResultOverlay';
import { EventLog } from '../_shared/EventLog';
import { GameLobbyLayout } from '@/components/games/game-lobby-layout';
import type { LobbyMatchResult } from '@/components/lobby/LobbyContainer';
import type { PlayerRole } from '../_shared/types';

interface Player {
  name: string;
  kills: number;
  deaths: number;
  assists: number;
}

const TEAM_ALPHA: Player[] = [
  { name: 'xNova', kills: 14, deaths: 5, assists: 3 },
  { name: 'PhantomAce', kills: 11, deaths: 7, assists: 6 },
  { name: 'GhostRider', kills: 9, deaths: 8, assists: 4 },
  { name: 'VortexKing', kills: 8, deaths: 6, assists: 7 },
  { name: 'IronSight', kills: 6, deaths: 9, assists: 2 },
];

const TEAM_BRAVO: Player[] = [
  { name: 'ShadowByte', kills: 12, deaths: 6, assists: 5 },
  { name: 'BlazeFury', kills: 10, deaths: 8, assists: 3 },
  { name: 'CrypticFox', kills: 8, deaths: 10, assists: 8 },
  { name: 'NightOwl', kills: 7, deaths: 11, assists: 4 },
  { name: 'StormPilot', kills: 5, deaths: 13, assists: 2 },
];

function teamScore(team: Player[]): number {
  return team.reduce((sum, p) => sum + p.kills, 0);
}

function randomizeScores(team: Player[]): Player[] {
  return team.map((p) => ({
    ...p,
    kills: p.kills + Math.floor(Math.random() * 8) - 2,
    deaths: p.deaths + Math.floor(Math.random() * 6) - 1,
    assists: p.assists + Math.floor(Math.random() * 4),
  }));
}

export default function FPSDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [finalAlpha, setFinalAlpha] = useState(TEAM_ALPHA);
  const [finalBravo, setFinalBravo] = useState(TEAM_BRAVO);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('fps', log);
  const {
    sessionId,
    gameState,
    phase,
    setPhase,
    joinFromLobby,
    resolveGame,
    setBetId,
    reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');

  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: Player ${r}`, 'info');
    const result = await setup(r);
    if (result) {
      setPhase('lobby');
    }
  }, [setup, log, setPhase]);

  const handleMatched = useCallback(async (match: LobbyMatchResult) => {
    if (!authState) return;
    log(`Match locked in — bet ${match.betId.slice(0, 8)}...`, 'bet');
    betIdRef.current = match.betId;
    setBetAmountCents(match.stakeCents);
    await joinFromLobby({
      betId: match.betId,
      myRole: match.myRole,
      playerId: authState.playerId,
      playerAId: match.playerAUserId,
      gameType: 'fps',
    });
  }, [authState, joinFromLobby, log]);

  const handleSimulateMatch = useCallback(async () => {
    if (simulated || !authState) return;

    // Randomize final scores
    const alpha = randomizeScores(TEAM_ALPHA);
    const bravo = randomizeScores(TEAM_BRAVO);
    setFinalAlpha(alpha);
    setFinalBravo(bravo);
    setSimulated(true);

    const alphaScore = teamScore(alpha);
    const bravoScore = teamScore(bravo);
    const winner = alphaScore > bravoScore ? 'A' : alphaScore < bravoScore ? 'B' : 'draw';

    log(`Match simulated! Alpha: ${alphaScore} — Bravo: ${bravoScore}`, 'info');
    log(`Winner: ${winner === 'draw' ? 'Draw' : `Team ${winner === 'A' ? 'Alpha' : 'Bravo'}`}`, 'success');

    const result = await resolveGame(winner as 'A' | 'B' | 'draw');
    if (result && !settledRef.current) {
      settledRef.current = true;
      const activeBetId = result.betId || betIdRef.current;
      if (activeBetId) {
        const settle = await reportAndSettle(authState.apiKey, activeBetId);
        if (settle) {
          setSettlementResult(settle as SettlementResult);
          widgetHandleRef.current?.refreshBalance();
        }
      }
    }
  }, [simulated, authState, resolveGame, reportAndSettle, log]);

  const handleBetCreated = useCallback(async (bet: { betId: string; amount: number }) => {
    log(`Bet created: ${bet.betId} ($${(bet.amount / 100).toFixed(2)})`, 'bet');
    betIdRef.current = bet.betId;
    setBetAmountCents(bet.amount);
    if (sessionId) {
      await setBetId(bet.betId);
    }
  }, [sessionId, setBetId, log]);

  const handleBetAccepted = useCallback((bet: { betId: string }) => {
    log('Bet accepted! Match is on!', 'bet');
    betIdRef.current = bet.betId;
  }, [log]);

  const handleBetSettled = useCallback((bet: { outcome: string }) => {
    log(`Bet settled: ${bet.outcome}`, 'bet');
  }, [log]);

  const handlePlayAgain = useCallback(() => {
    window.location.reload();
  }, []);

  const isFinished = phase === 'finished' || gameState?.status === 'finished';
  const displayAlpha = simulated ? finalAlpha : TEAM_ALPHA;
  const displayBravo = simulated ? finalBravo : TEAM_BRAVO;

  // Auto-settle when we detect finish via polling (opponent simulated)
  if (isFinished && !settledRef.current && gameState?.betId && authState) {
    settledRef.current = true;
    const activeBetId = gameState.betId || betIdRef.current;
    if (activeBetId) {
      reportAndSettle(authState.apiKey, activeBetId).then((settle) => {
        if (settle) {
          setSettlementResult(settle as SettlementResult);
          widgetHandleRef.current?.refreshBalance();
        }
      });
    }
  }

  // joinFromLobby already starts the game-state poll for both roles.

  const isInGame = phase === 'playing' || phase === 'finished';

  if (!isInGame) {
    return (
      <GameLobbyLayout
        gameKey="fps"
        phase={phase === 'role-select' || phase === 'lobby' ? phase : 'role-select'}
        role={role}
        isSettingUp={isSettingUp}
        onRoleSelect={handleRoleSelect}
        myUserId={authState?.playerId ?? ''}
        myDisplayName={authState?.displayName ?? 'Player'}
        onMatched={handleMatched}
        events={entries}
      />
    );
  }

  return (
    <div className={`mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 ${isInGame ? 'game-fullscreen-mobile' : ''}`}>
      <RotatePrompt isInGame={isInGame} />
      {isInGame && (
        <GameMobileFAB
          onExit={() => window.location.reload()}
          betAmount={betAmountCents || undefined}
          betStatus={gameState?.status === 'finished' ? 'settled' : 'in progress'}
          turnInfo={isFinished ? 'Match Over' : 'Awaiting Simulation'}
          playerInfo={`Alpha${role === 'A' ? ' (You)' : ''} vs Bravo${role === 'B' ? ' (You)' : ''}`}
        >
          <PlayStakeWidget
            widgetToken={authState?.widgetToken ?? null}
            gameId={authState?.gameId ?? null}
          />
        </GameMobileFAB>
      )}
      {/* Header */}
      <div className="game-header mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <Crosshair className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Tactical Ops
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Two-player wagered match — team scoreboard
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {/* Scoreboard */}
          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Timer bar */}
              <Card padding="sm" className="game-players-bar flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Timer className="h-4 w-4" />
                  <span className="font-mono text-xs uppercase tracking-widest">
                    {isFinished ? 'Match Over' : 'Awaiting Simulation'}
                  </span>
                </div>
                <span className="font-mono text-xl font-semibold tabular-nums text-text-primary">
                  {isFinished ? '0:00' : '5:00'}
                </span>
              </Card>

              {/* Score summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card padding="sm" className="text-center">
                  <p className="font-display text-xs uppercase tracking-widest text-brand-400 mb-1">
                    Alpha
                  </p>
                  <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
                    {teamScore(displayAlpha)}
                  </p>
                </Card>
                <Card padding="sm" className="flex items-center justify-center">
                  <span className="font-display text-lg font-bold tracking-widest text-text-muted">
                    VS
                  </span>
                </Card>
                <Card padding="sm" className="text-center">
                  <p className="font-display text-xs uppercase tracking-widest text-danger-400 mb-1">
                    Bravo
                  </p>
                  <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
                    {teamScore(displayBravo)}
                  </p>
                </Card>
              </div>

              {/* Team tables */}
              <div className="grid gap-4 md:grid-cols-2">
                <TeamTable label="Team Alpha" color="text-brand-400" players={displayAlpha} />
                <TeamTable label="Team Bravo" color="text-danger-400" players={displayBravo} />
              </div>

              {/* Simulate button */}
              {gameState?.status === 'playing' && !simulated && (
                <Button className="w-full" size="lg" onClick={handleSimulateMatch}>
                  Simulate Match
                </Button>
              )}

              {/* Result overlay */}
              {isFinished && gameState && (
                settlementResult && role ? (
                  <GameResultOverlay
                    outcome={deriveOutcome(settlementResult, role)}
                    amount={formatResultAmount(
                      deriveOutcome(settlementResult, role),
                      settlementResult.winnerPayout,
                      betAmountCents
                    )}
                    visible
                    onPlayAgain={handlePlayAgain}
                  />
                ) : (
                  <Card
                    padding="sm"
                    className={`game-status-bar ${
                      gameState.winner === role
                        ? 'border-brand-400/30 bg-brand-400/5'
                        : gameState.winner !== 'draw' && gameState.winner !== role
                          ? 'border-danger-400/30 bg-danger-400/5'
                          : ''
                    }`}
                  >
                    <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                      <span className={gameState.winner === role ? 'text-brand-400' : gameState.winner === 'draw' ? 'text-text-secondary' : 'text-danger-400'}>
                        {gameState.winner === role
                          ? 'Victory! Your team won!'
                          : gameState.winner === 'draw'
                            ? "It's a draw! Bets returned."
                            : 'Defeat! Better luck next time.'}
                      </span>
                    </p>
                  </Card>
                )
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="game-sidebar space-y-4">
          <PlayStakeWidget
            ref={widgetHandleRef}
            widgetToken={authState?.widgetToken ?? null}
            gameId={authState?.gameId ?? null}
            onBetCreated={handleBetCreated}
            onBetAccepted={handleBetAccepted}
            onBetSettled={handleBetSettled}
            onError={(err) => log(`Widget error: ${err.message}`, 'error')}
          />
          <EventLog entries={entries} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function TeamTable({
  label,
  color,
  players,
}: {
  label: string;
  color: string;
  players: Player[];
}) {
  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-white/8">
        <h3 className={`font-display text-xs font-semibold uppercase tracking-widest ${color}`}>
          {label}
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <span>Player</span>
          <span className="text-right">
            <Skull className="inline h-3 w-3" />
          </span>
          <span className="text-right">
            <Shield className="inline h-3 w-3" />
          </span>
          <span className="text-right">A</span>
        </div>
        {players.map((p) => (
          <div
            key={p.name}
            className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 px-4 py-2 text-sm"
          >
            <span className="font-mono text-text-primary truncate">{p.name}</span>
            <span className="font-mono tabular-nums text-right text-text-primary">{p.kills}</span>
            <span className="font-mono tabular-nums text-right text-text-secondary">{p.deaths}</span>
            <span className="font-mono tabular-nums text-right text-text-secondary">{p.assists}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
