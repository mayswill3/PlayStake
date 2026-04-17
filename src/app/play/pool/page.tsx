'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { CircleDot } from 'lucide-react';
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
import type { BullRing, PoolGameState } from './pool-physics';
import { WIN_SCORE, SHOTS_PER_TURN } from './pool-physics';
import { PoolCanvas } from './PoolCanvas';

function initialState(): PoolGameState {
  return {
    scoreA: 0, scoreB: 0, turn: 'A',
    shotIndex: 0, globalShotIndex: 0,
    phase: 'place',
    cueBall: { x: 110, y: 220, pocketed: false },
    objBall: { x: 220, y: 88, pocketed: false },
    message: '', lastRing: null, lastPoints: 0, winner: null,
  };
}

export default function PoolDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  // Pool state
  const [gs, setGs] = useState<PoolGameState>(initialState);
  const [poolFinished, setPoolFinished] = useState(false);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('pool', log);
  const {
    sessionId, gameState, phase, setPhase,
    joinFromLobby, resolveGame, setGameData, setBetId, reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');

  /* ── Callbacks (identical to tictactoe pattern) ─────────────── */

  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: Player ${r === 'A' ? '1' : '2'}`, 'info');
    const result = await setup(r);
    if (result) setPhase('lobby');
  }, [setup, log, setPhase]);

  const handleMatched = useCallback(async (match: LobbyMatchResult) => {
    if (!authState) return;
    log(`Match locked in — bet ${match.betId.slice(0, 8)}...`, 'bet');
    betIdRef.current = match.betId;
    setBetAmountCents(match.stakeCents);
    await joinFromLobby({
      betId: match.betId, myRole: match.myRole,
      playerId: authState.playerId, playerAId: match.playerAUserId,
      gameType: 'pool',
    });
  }, [authState, joinFromLobby, log]);

  const handleBetCreated = useCallback(async (bet: { betId: string; amount: number }) => {
    log(`Bet created: ${bet.betId} ($${(bet.amount / 100).toFixed(2)})`, 'bet');
    betIdRef.current = bet.betId;
    setBetAmountCents(bet.amount);
    if (sessionId) await setBetId(bet.betId);
  }, [sessionId, setBetId, log]);

  const handleBetAccepted = useCallback((bet: { betId: string }) => {
    log('Bet accepted! Match is on!', 'bet');
    betIdRef.current = bet.betId;
  }, [log]);

  const handleBetSettled = useCallback((bet: { outcome: string }) => {
    log(`Bet settled: ${bet.outcome}`, 'bet');
  }, [log]);

  const handlePlayAgain = useCallback(() => window.location.reload(), []);

  /* ── Sync opponent state from polling ─────────────────────────── */

  useEffect(() => {
    if (!gameState?.gameData || !role) return;
    const gd = gameState.gameData as unknown as PoolGameState;
    if (gd.scoreA === undefined) return;
    setGs(gd);
    if (gd.winner) {
      setPoolFinished(true);
    }
  }, [gameState?.gameData, role]);

  /* ── Shot result handler (called by PoolCanvas) ───────────────── */

  const handleShotResult = useCallback(async (result: {
    objPocketed: boolean; cuePocketed: boolean;
    bullRing: BullRing; bullPoints: number;
    cueFinalX: number; cueFinalY: number;
  }) => {
    if (!role) return;

    let newScoreA = gs.scoreA;
    let newScoreB = gs.scoreB;
    let message = '';

    if (result.cuePocketed) {
      // Scratch — opponent +1
      if (role === 'A') newScoreB += 1; else newScoreA += 1;
      message = 'Scratch! Opponent gets +1 bonus.';
      log(message, 'error');
    } else if (!result.objPocketed) {
      message = 'Missed the pot — 0 points.';
      log(message, 'info');
    } else if (result.bullPoints > 0) {
      if (role === 'A') newScoreA += result.bullPoints; else newScoreB += result.bullPoints;
      message = `Potted! ${result.bullRing} bull — +${result.bullPoints} pts!`;
      log(message, 'success');
    } else {
      message = 'Potted, but cue ball off target — 0 pts.';
      log(message, 'info');
    }

    // Advance shot index
    const nextShotInTurn = gs.shotIndex + 1;
    const turnEnds = nextShotInTurn >= SHOTS_PER_TURN;
    const nextTurn: 'A' | 'B' = turnEnds ? (gs.turn === 'A' ? 'B' : 'A') : gs.turn;
    const nextShotIndex = turnEnds ? 0 : nextShotInTurn;
    const nextGlobalShot = gs.globalShotIndex + 1;

    // Check win
    let winner: 'A' | 'B' | null = null;
    if (newScoreA >= WIN_SCORE) { winner = 'A'; message = 'Player 1 reaches 21 — wins!'; log(message, 'success'); }
    else if (newScoreB >= WIN_SCORE) { winner = 'B'; message = 'Player 2 reaches 21 — wins!'; log(message, 'success'); }

    const updated: PoolGameState = {
      scoreA: newScoreA, scoreB: newScoreB,
      turn: winner ? gs.turn : nextTurn,
      shotIndex: nextShotIndex,
      globalShotIndex: nextGlobalShot,
      phase: winner ? 'finished' : 'place',
      cueBall: { x: result.cueFinalX, y: result.cueFinalY, pocketed: false },
      objBall: { x: gs.objBall.x, y: gs.objBall.y, pocketed: result.objPocketed },
      message,
      lastRing: result.bullRing,
      lastPoints: result.bullPoints,
      winner,
    };

    setGs(updated);

    // Auto-advance to next shot after delay
    if (!winner) {
      setTimeout(async () => {
        await setGameData(updated as unknown as Record<string, unknown>);
      }, 1500);
    } else {
      await setGameData(updated as unknown as Record<string, unknown>);
    }

    // Settlement
    if (winner && !settledRef.current) {
      setPoolFinished(true);
      settledRef.current = true;

      const resolved = await resolveGame(winner);
      if (resolved) {
        const activeBetId = resolved.betId || betIdRef.current;
        if (activeBetId && authState) {
          if (!resolved.betId && betIdRef.current) await setBetId(betIdRef.current);
          const settle = await reportAndSettle(authState.apiKey, activeBetId);
          if (settle) {
            setSettlementResult(settle as SettlementResult);
            widgetHandleRef.current?.refreshBalance();
          }
        }
      }
    }
  }, [role, gs, authState, setGameData, resolveGame, setBetId, reportAndSettle, log]);

  /* ── Derived state ────────────────────────────────────────────── */

  const isFinished = phase === 'finished' || gameState?.status === 'finished' || poolFinished;
  const isMyTurn = gs.turn === role && !isFinished;

  // Auto-settle for polling player
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

  let statusText = '';
  let statusColor = 'text-text-secondary';
  if (isFinished && gs.winner) {
    statusText = gs.winner === role ? 'You won!' : 'You lost!';
    statusColor = gs.winner === role ? 'text-brand-400' : 'text-danger-400';
  } else if (gs.message) {
    statusText = gs.message;
    statusColor = gs.message.includes('Scratch') || gs.message.includes('Missed') ? 'text-danger-400' : 'text-brand-400';
  } else if (isMyTurn) {
    statusText = 'Place cue ball in the kitchen, aim, and shoot';
    statusColor = 'text-brand-400';
  } else {
    statusText = "Opponent's turn...";
    statusColor = 'text-warning-400';
  }

  const isInGame = phase === 'playing' || phase === 'finished';

  if (!isInGame) {
    return (
      <GameLobbyLayout
        gameKey="pool"
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
          betStatus={isFinished ? 'settled' : 'in progress'}
          turnInfo={statusText}
          playerInfo={`Player 1${role === 'A' ? ' (You)' : ''} vs Player 2${role === 'B' ? ' (You)' : ''}`}
        >
          <PlayStakeWidget
            widgetToken={authState?.widgetToken ?? null}
            gameId={authState?.gameId ?? null}
          />
        </GameMobileFAB>
      )}

      {/* Header */}
      <div className="game-header mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <CircleDot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Bullseye Pool</h1>
          <p className="text-sm text-text-muted font-mono">
            Two-player wagered match — pot the object ball, land on the bullseye
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-4">
        {/* Game area */}
        <div className="game-area lg:col-span-3 space-y-4">
          {(phase === 'playing' || phase === 'finished') && role && (
            <>
              {/* Status */}
              {statusText && (
                <Card padding="sm" className="game-status-bar">
                  <p className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${statusColor}`}>
                    {statusText}
                  </p>
                </Card>
              )}

              {/* Canvas */}
              <PoolCanvas
                role={role}
                isMyTurn={isMyTurn}
                scoreA={gs.scoreA}
                scoreB={gs.scoreB}
                turn={gs.turn}
                shotIndex={gs.shotIndex}
                globalShotIndex={gs.globalShotIndex}
                finished={isFinished}
                p1Name={role === 'A' ? (authState?.displayName ?? 'You') : 'Opponent'}
                p2Name={role === 'B' ? (authState?.displayName ?? 'You') : 'Opponent'}
                opponentState={isMyTurn ? null : gs}
                onShotResult={handleShotResult}
              />

              {/* Result overlay */}
              {isFinished && gs.winner && (
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
                    scoreText={`${gs.scoreA} — ${gs.scoreB}`}
                  />
                ) : (
                  <Card padding="sm" className={gs.winner === role ? 'border-brand-400/30 bg-brand-400/5' : 'border-danger-400/30 bg-danger-400/5'}>
                    <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                      <span className={gs.winner === role ? 'text-brand-400' : 'text-danger-400'}>
                        {gs.winner === role ? `Victory! ${gs.scoreA}–${gs.scoreB}` : `Defeat. ${gs.scoreA}–${gs.scoreB}`}
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
