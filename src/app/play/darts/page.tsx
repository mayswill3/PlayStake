'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Target } from 'lucide-react';
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
import { Dartboard, type DartThrow } from './Dartboard';
import { CHECKOUT_TABLE } from './checkout';

// ── Darts game-data shape (synced via setGameData / polling) ───────────
interface DartsGameData {
  scoreA: number;
  scoreB: number;
  turn: 'A' | 'B';
  dartsThisRound: number;            // 0-3
  dartsA: DartThrow[];               // all darts thrown by A (for render)
  dartsB: DartThrow[];               // all darts thrown by B
  roundDartsA: DartThrow[];          // current-round darts for A
  roundDartsB: DartThrow[];          // current-round darts for B
  bust: boolean;
  message: string;
  finished: boolean;
  winner: 'A' | 'B' | null;
}

function initialGameData(): DartsGameData {
  return {
    scoreA: 501,
    scoreB: 501,
    turn: 'A',
    dartsThisRound: 0,
    dartsA: [],
    dartsB: [],
    roundDartsA: [],
    roundDartsB: [],
    bust: false,
    message: '',
    finished: false,
    winner: null,
  };
}

export default function DartsDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  // Darts-specific state
  const [dartsData, setDartsData] = useState<DartsGameData>(initialGameData);
  const [bustFlash, setBustFlash] = useState(false);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('darts', log);
  const {
    sessionId,
    gameState,
    phase,
    setPhase,
    joinFromLobby,
    resolveGame,
    setGameData,
    setBetId,
    reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');

  /* ── Callbacks mirrored exactly from tictactoe ── */

  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: Thrower ${r === 'A' ? '1' : '2'}`, 'info');
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
      gameType: 'darts',
    });
  }, [authState, joinFromLobby, log]);

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

  /* ── Sync opponent state from polling ─────────────────────────── */

  useEffect(() => {
    if (!gameState?.gameData || !role) return;
    const gd = gameState.gameData as unknown as DartsGameData;
    if (gd.scoreA === undefined) return; // not initialised yet
    setDartsData(gd);
    if (gd.bust) {
      setBustFlash(true);
      setTimeout(() => setBustFlash(false), 800);
    }
  }, [gameState?.gameData, role]);

  /* ── Dart throw handler ───────────────────────────────────────── */

  const handleThrow = useCallback(async (dart: DartThrow) => {
    if (!role || dartsData.finished) return;
    if (dartsData.turn !== role) return;

    const myScore = role === 'A' ? dartsData.scoreA : dartsData.scoreB;
    const preTurnScore = myScore; // score before this round (for bust reset)
    const dartNum = dartsData.dartsThisRound + 1;

    // Calculate new score
    let newScore = myScore - dart.points;
    let bust = false;
    let finished = false;
    let winner: 'A' | 'B' | null = null;

    // Checkout: must land on exactly 0 via a double or bullseye
    if (newScore === 0 && (dart.multiplier === 2 || dart.segment === 25)) {
      finished = true;
      winner = role;
    } else if (newScore <= 1 || (newScore === 0 && dart.multiplier !== 2 && dart.segment !== 25)) {
      // Bust: below 0, hit 1 (can't finish on a double), or 0 without double
      bust = true;
      newScore = myScore; // we'll reset fully at end of round
    }

    const newDartsAll = role === 'A'
      ? [...dartsData.dartsA, dart]
      : [...dartsData.dartsB, dart];
    const newRoundDarts = role === 'A'
      ? [...dartsData.roundDartsA, dart]
      : [...dartsData.roundDartsB, dart];

    const turnEnds = bust || finished || dartNum >= 3;
    const nextTurn: 'A' | 'B' = turnEnds ? (role === 'A' ? 'B' : 'A') : role;

    // If bust, revert score to what it was at start of THIS round (before any darts this round)
    // preTurnScore already includes darts 1 & 2 of this round, so we need the score at round start
    const roundStartScore = role === 'A'
      ? dartsData.scoreA + dartsData.roundDartsA.reduce((s, d) => s + d.points, 0)
      : dartsData.scoreB + dartsData.roundDartsB.reduce((s, d) => s + d.points, 0);
    const resolvedScore = bust ? roundStartScore : newScore;

    let message = '';
    if (finished) {
      message = `${role === 'A' ? 'Thrower 1' : 'Thrower 2'} checks out! Game over!`;
    } else if (bust) {
      message = `BUST! Score resets to ${roundStartScore}.`;
    } else {
      message = `${dart.label} — ${dart.points} points (${resolvedScore} remaining)`;
    }

    log(message, bust ? 'error' : finished ? 'success' : 'info');

    if (bust) {
      setBustFlash(true);
      setTimeout(() => setBustFlash(false), 800);
    }

    const updated: DartsGameData = {
      scoreA: role === 'A' ? resolvedScore : dartsData.scoreA,
      scoreB: role === 'B' ? resolvedScore : dartsData.scoreB,
      turn: finished ? role : nextTurn,
      dartsThisRound: turnEnds ? 0 : dartNum,
      dartsA: role === 'A' ? newDartsAll : dartsData.dartsA,
      dartsB: role === 'B' ? newDartsAll : dartsData.dartsB,
      roundDartsA: turnEnds ? (role === 'A' ? [] : dartsData.roundDartsA) : (role === 'A' ? newRoundDarts : dartsData.roundDartsA),
      roundDartsB: turnEnds ? (role === 'B' ? [] : dartsData.roundDartsB) : (role === 'B' ? newRoundDarts : dartsData.roundDartsB),
      bust,
      message,
      finished,
      winner,
    };

    setDartsData(updated);
    await setGameData(updated as unknown as Record<string, unknown>);

    // Settlement on game over
    if (finished && winner && !settledRef.current) {
      settledRef.current = true;
      const resolved = await resolveGame(winner);
      if (resolved) {
        const activeBetId = resolved.betId || betIdRef.current;
        if (activeBetId && authState) {
          if (!resolved.betId && betIdRef.current) {
            await setBetId(betIdRef.current);
          }
          const settle = await reportAndSettle(authState.apiKey, activeBetId);
          if (settle) {
            setSettlementResult(settle as SettlementResult);
            widgetHandleRef.current?.refreshBalance();
          }
        }
      }
    }
  }, [role, dartsData, setGameData, resolveGame, authState, setBetId, reportAndSettle, log]);

  /* ── Derived state ────────────────────────────────────────────── */

  const isFinished = phase === 'finished' || gameState?.status === 'finished' || dartsData.finished;
  const isMyTurn = dartsData.turn === role && !isFinished;
  const myScore = role === 'A' ? dartsData.scoreA : dartsData.scoreB;
  const checkoutHint = isMyTurn && myScore <= 170 ? CHECKOUT_TABLE[myScore] : null;

  // Auto-settle when we detect finish via polling (for the non-throwing player)
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

  /* ── Status bar ───────────────────────────────────────────────── */

  let statusText = '';
  let statusColor = 'text-text-secondary';
  if (isFinished && dartsData.winner) {
    if (dartsData.winner === role) {
      statusText = 'You checked out — Victory!';
      statusColor = 'text-brand-400';
    } else {
      statusText = 'Opponent checked out — Defeat!';
      statusColor = 'text-danger-400';
    }
  } else if (dartsData.message && dartsData.bust) {
    statusText = dartsData.message;
    statusColor = 'text-danger-400';
  } else if (isMyTurn) {
    statusText = `Your throw (dart ${dartsData.dartsThisRound + 1}/3)`;
    statusColor = 'text-brand-400';
  } else {
    statusText = "Opponent's turn...";
    statusColor = 'text-warning-400';
  }

  const isInGame = phase === 'playing' || phase === 'finished';

  // Pre-game: lobby layout (identical to tictactoe)
  if (!isInGame) {
    return (
      <GameLobbyLayout
        gameKey="darts"
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
    <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${isInGame ? 'game-fullscreen-mobile' : ''}`}>
      <RotatePrompt isInGame={isInGame} />
      {isInGame && (
        <GameMobileFAB
          onExit={() => window.location.reload()}
          betAmount={betAmountCents || undefined}
          betStatus={isFinished ? 'settled' : 'in progress'}
          turnInfo={statusText}
          playerInfo={`Thrower 1${role === 'A' ? ' (You)' : ''} vs Thrower 2${role === 'B' ? ' (You)' : ''}`}
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
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Darts 501
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Two-player wagered match — first to check out wins
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Scoreboard */}
              <Card padding="sm" className="game-players-bar flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dartsData.turn === 'A' && !isFinished ? 'bg-brand-400 animate-pulse' : 'bg-text-muted'}`} />
                    <span className="font-mono text-sm font-semibold text-yellow-400">{dartsData.scoreA}</span>
                    <span className="font-mono text-xs text-text-secondary">
                      Thrower 1{role === 'A' ? ' (You)' : ''}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-text-muted">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dartsData.turn === 'B' && !isFinished ? 'bg-brand-400 animate-pulse' : 'bg-text-muted'}`} />
                    <span className="font-mono text-sm font-semibold text-cyan-400">{dartsData.scoreB}</span>
                    <span className="font-mono text-xs text-text-secondary">
                      Thrower 2{role === 'B' ? ' (You)' : ''}
                    </span>
                  </div>
                </div>
                {dartsData.dartsThisRound > 0 && !isFinished && (
                  <span className="font-mono text-[11px] text-text-muted">
                    Dart {dartsData.dartsThisRound}/3
                  </span>
                )}
              </Card>

              {/* Status bar */}
              {statusText && (
                <Card padding="sm" className="game-status-bar">
                  <p className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${statusColor}`}>
                    {statusText}
                  </p>
                </Card>
              )}

              {/* Checkout hint */}
              {checkoutHint && (
                <Card padding="sm" className="border-brand-400/20 bg-brand-400/5">
                  <p className="font-mono text-center text-xs text-brand-400">
                    Checkout: {checkoutHint}
                  </p>
                </Card>
              )}

              {/* Bust flash overlay */}
              {bustFlash && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
                  <div className="rounded-lg bg-danger-400/20 border border-danger-400/50 px-12 py-6 backdrop-blur-sm animate-pulse">
                    <span className="font-display text-4xl font-bold text-danger-400 uppercase tracking-widest">
                      BUST!
                    </span>
                  </div>
                </div>
              )}

              {/* Dartboard canvas */}
              <Dartboard
                isMyTurn={isMyTurn}
                onThrow={handleThrow}
                myDarts={role === 'A' ? dartsData.roundDartsA : dartsData.roundDartsB}
                opponentDarts={role === 'A' ? dartsData.roundDartsB : dartsData.roundDartsA}
                myColor={role === 'A' ? '#f5c842' : '#22d3ee'}
                opponentColor={role === 'A' ? '#22d3ee' : '#f5c842'}
              />

              {/* Result overlay */}
              {isFinished && dartsData.winner && (
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
                    className={`game-result-overlay ${
                      dartsData.winner === role
                        ? 'border-brand-400/30 bg-brand-400/5'
                        : 'border-danger-400/30 bg-danger-400/5'
                    }`}
                  >
                    <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                      <span className={dartsData.winner === role ? 'text-brand-400' : 'text-danger-400'}>
                        {dartsData.winner === role
                          ? 'Checkout! You won the match.'
                          : 'Opponent checked out. Better luck next time.'}
                      </span>
                    </p>
                  </Card>
                )
              )}
            </>
          )}
        </div>

        {/* Sidebar: Widget + Event Log (identical to tictactoe) */}
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
