'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { DartboardCanvas, hitTest, applyDeviation, type DartsState, type DartThrow } from './DartboardCanvas';
import { DartsAudio } from './darts-audio';

const STARTING_SCORE = 301;

const INITIAL: DartsState = {
  scoreA: STARTING_SCORE,
  scoreB: STARTING_SCORE,
  currentTurn: 'A',
  dartsThrown: 0,
  turnStartScore: STARTING_SCORE,
  currentDarts: [],
  lastTurnResult: null,
  turnHistory: [],
  phase: 'aiming',
  winner: null,
  message: '',
};

export default function DartsDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const [gs, setGs] = useState<DartsState>(INITIAL);
  const gsRef = useRef(gs); gsRef.current = gs;
  const [playerNames, setPlayerNames] = useState<{ A: string; B: string }>({ A: '', B: '' });

  const audio = useMemo(() => new DartsAudio(), []);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('darts', log);
  const { sessionId, gameState, phase, setPhase, joinFromLobby, resolveGame, setGameData, setBetId, reportAndSettle } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');

  // ── Standard lobby callbacks ───────────────────────────────────────────────
  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: ${r === 'A' ? 'Home' : 'Away'}`, 'info');
    const result = await setup(r);
    if (result) setPhase('lobby');
  }, [setup, log, setPhase]);

  const handleMatched = useCallback(async (match: LobbyMatchResult) => {
    if (!authState) return;
    log(`Match locked in — bet ${match.betId.slice(0, 8)}...`, 'bet');
    betIdRef.current = match.betId;
    setBetAmountCents(match.stakeCents);
    setPlayerNames({ A: match.playerAName, B: match.playerBName });
    await joinFromLobby({ betId: match.betId, myRole: match.myRole, playerId: authState.playerId, playerAId: match.playerAUserId, gameType: 'darts' });
  }, [authState, joinFromLobby, log]);

  const handleBetCreated = useCallback(async (bet: { betId: string; amount: number }) => {
    log(`Bet created: ${bet.betId} ($${(bet.amount / 100).toFixed(2)})`, 'bet');
    betIdRef.current = bet.betId; setBetAmountCents(bet.amount);
    if (sessionId) await setBetId(bet.betId);
  }, [sessionId, setBetId, log]);
  const handleBetAccepted = useCallback((bet: { betId: string }) => { log('Bet accepted!', 'bet'); betIdRef.current = bet.betId; }, [log]);
  const handleBetSettled = useCallback((bet: { outcome: string }) => { log(`Bet settled: ${bet.outcome}`, 'bet'); }, [log]);
  const handlePlayAgain = useCallback(() => window.location.reload(), []);

  // ── Sync from polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState?.gameData || !role) return;
    const gd = gameState.gameData as unknown as DartsState;
    if (gd.scoreA === undefined) return;
    setGs(gd);
    if (gd.winner && !settledRef.current && gameState.betId && authState) {
      settledRef.current = true;
      const bid = gameState.betId || betIdRef.current;
      if (bid) {
        reportAndSettle(authState.apiKey, bid).then(s => {
          if (s) { setSettlementResult(s as SettlementResult); widgetHandleRef.current?.refreshBalance(); }
        });
      }
    }
  }, [gameState?.gameData, role, authState, reportAndSettle]);

  // ── Throw handler ─────────────────────────────────────────────────────────
  const handleThrow = useCallback(async (landX: number, landY: number) => {
    audio.ensureContext();
    const cur = gsRef.current;
    if (!role || cur.currentTurn !== role || cur.phase === 'finished') return;

    const hit = hitTest(450, 275, landX, landY); // BOARD_CX=450, BOARD_CY=275

    // Play audio
    if (hit.score === 0) {
      // miss — play softer impact
      audio.playDartImpact(0);
    } else if (hit.segment === 0) {
      // bull / bullseye
      audio.playBullseye();
    } else if (hit.multiplier > 1) {
      audio.playDouble();
    } else {
      audio.playDartImpact(1 - Math.min(Math.sqrt((landX - 450) ** 2 + (landY - 275) ** 2) / 170, 1));
    }

    const newDart: DartThrow = {
      segment: hit.segment,
      multiplier: hit.multiplier,
      score: hit.score,
      x: landX,
      y: landY,
    };

    const currentScore = cur.currentTurn === 'A' ? cur.scoreA : cur.scoreB;
    const newScore = currentScore - hit.score;
    const newDartsThrown = cur.dartsThrown + 1;
    const newCurrentDarts = [...cur.currentDarts, newDart];

    // Log throw
    const label = hit.score === 0 ? 'Miss!'
      : hit.segment === 0 && hit.multiplier === 2 ? 'BULLSEYE! (50)'
      : hit.segment === 0 ? 'Bull! (25)'
      : hit.multiplier === 3 ? `Treble ${hit.segment} (${hit.score})`
      : hit.multiplier === 2 ? `Double ${hit.segment} (${hit.score})`
      : `${hit.segment} (${hit.score})`;
    log(`Dart ${newDartsThrown}: ${label}`, 'info');

    // Bust check
    if (newScore < 0) {
      audio.playBust();
      const bustResult = { player: cur.currentTurn, total: hit.score, wasBust: true };
      const revertedScore = cur.turnStartScore;

      const next: DartsState = {
        ...cur,
        ...(cur.currentTurn === 'A' ? { scoreA: revertedScore } : { scoreB: revertedScore }),
        currentDarts: newCurrentDarts,
        lastTurnResult: bustResult,
        turnHistory: [...cur.turnHistory, { ...bustResult, scoreAfter: revertedScore }],
        phase: 'bust',
        message: 'BUST! Score reverted.',
        dartsThrown: newDartsThrown,
      };
      setGs(next);
      await setGameData(next as unknown as Record<string, unknown>);
      log('BUST! Score reverted.', 'error');

      // Advance turn after delay
      setTimeout(async () => {
        const nextTurn = cur.currentTurn === 'A' ? 'B' : 'A';
        const nextState: DartsState = {
          ...next,
          currentTurn: nextTurn,
          dartsThrown: 0,
          turnStartScore: next.currentTurn === 'A' ? next.scoreB : next.scoreA,
          currentDarts: [],
          phase: 'aiming',
          message: '',
        };
        // Correct turnStartScore after bust revert
        const correctedStartScore = nextTurn === 'A' ? next.scoreA : next.scoreB;
        nextState.turnStartScore = correctedStartScore;
        audio.playTurnChange();
        setGs(nextState);
        await setGameData(nextState as unknown as Record<string, unknown>);
      }, 1400);
      return;
    }

    // Win check
    if (newScore === 0) {
      audio.playWin();
      const winResult = { player: cur.currentTurn, total: hit.score, wasBust: false };
      const next: DartsState = {
        ...cur,
        ...(cur.currentTurn === 'A' ? { scoreA: 0 } : { scoreB: 0 }),
        currentDarts: newCurrentDarts,
        dartsThrown: newDartsThrown,
        lastTurnResult: winResult,
        turnHistory: [...cur.turnHistory, { ...winResult, scoreAfter: 0 }],
        phase: 'finished',
        winner: cur.currentTurn,
        message: `${cur.currentTurn === role ? 'You win' : `${cur.currentTurn === 'A' ? 'Home' : 'Away'} wins`}! 🎯`,
      };
      setGs(next);
      await setGameData(next as unknown as Record<string, unknown>);
      log(`${cur.currentTurn === 'A' ? 'Home' : 'Away'} wins!`, 'success');

      if (!settledRef.current) {
        settledRef.current = true;
        const resolved = await resolveGame(cur.currentTurn);
        if (resolved) {
          const bid = resolved.betId || betIdRef.current;
          if (bid && authState) {
            if (!resolved.betId && betIdRef.current) await setBetId(betIdRef.current);
            const s = await reportAndSettle(authState.apiKey, bid);
            if (s) { setSettlementResult(s as SettlementResult); widgetHandleRef.current?.refreshBalance(); }
          }
        }
      }
      return;
    }

    // Normal dart — check if last dart of turn
    const isLastDart = newDartsThrown >= 3;
    const turnTotal = (cur.turnStartScore - currentScore) + hit.score; // scored this turn so far
    // Actually: total scored this turn = turn start - new remaining
    const totalThisTurn = cur.turnStartScore - newScore;

    if (isLastDart) {
      const turnResult = { player: cur.currentTurn, total: totalThisTurn, wasBust: false };
      const nextTurn = cur.currentTurn === 'A' ? 'B' : 'A';
      const correctedStartScore = nextTurn === 'A' ? (cur.currentTurn === 'A' ? newScore : cur.scoreA) : (cur.currentTurn === 'B' ? newScore : cur.scoreB);

      const showing: DartsState = {
        ...cur,
        ...(cur.currentTurn === 'A' ? { scoreA: newScore } : { scoreB: newScore }),
        currentDarts: newCurrentDarts,
        dartsThrown: newDartsThrown,
        lastTurnResult: turnResult,
        turnHistory: [...cur.turnHistory, { ...turnResult, scoreAfter: newScore }],
        phase: 'showing',
        message: `Turn: −${totalThisTurn}`,
      };
      setGs(showing);
      await setGameData(showing as unknown as Record<string, unknown>);
      log(`Turn ended — scored ${totalThisTurn}, remaining: ${newScore}`, 'info');

      setTimeout(async () => {
        audio.playTurnChange();
        const nextState: DartsState = {
          ...showing,
          currentTurn: nextTurn,
          dartsThrown: 0,
          turnStartScore: correctedStartScore,
          currentDarts: [],
          phase: 'aiming',
          message: '',
        };
        setGs(nextState);
        await setGameData(nextState as unknown as Record<string, unknown>);
      }, 1400);
    } else {
      const next: DartsState = {
        ...cur,
        ...(cur.currentTurn === 'A' ? { scoreA: newScore } : { scoreB: newScore }),
        currentDarts: newCurrentDarts,
        dartsThrown: newDartsThrown,
        phase: 'aiming',
        message: '',
      };
      setGs(next);
      await setGameData(next as unknown as Record<string, unknown>);
    }
  }, [role, audio, authState, setGameData, resolveGame, setBetId, reportAndSettle, log]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isFinished = phase === 'finished' || gameState?.status === 'finished' || gs.phase === 'finished';
  const isInGame = phase === 'playing' || phase === 'finished';
  const isMyTurn = gs.currentTurn === role && gs.phase !== 'finished' && gs.phase !== 'showing' && gs.phase !== 'bust';

  const displayNameA = playerNames.A || (gameState?.playerAId === authState?.playerId ? authState?.displayName : null) || 'Player A';
  const displayNameB = playerNames.B || (gameState?.playerBId === authState?.playerId ? authState?.displayName : null) || 'Player B';

  let statusText = '';
  let statusColor = 'text-text-secondary';
  if (gs.phase === 'finished') {
    statusText = gs.winner === role ? 'You win! 🎯' : 'Opponent wins!';
    statusColor = gs.winner === role ? 'text-brand-400' : 'text-danger-400';
  } else if (gs.message) {
    statusText = gs.message;
    statusColor = gs.phase === 'bust' ? 'text-danger-400' : 'text-text-secondary';
  } else if (isMyTurn) {
    statusText = `Your turn — ${3 - gs.dartsThrown} dart${3 - gs.dartsThrown !== 1 ? 's' : ''} remaining`;
    statusColor = 'text-brand-400';
  } else if (gs.currentTurn !== role) {
    statusText = 'Opponent is throwing...';
  }

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
        <GameMobileFAB onExit={() => window.location.reload()} betAmount={betAmountCents || undefined} betStatus={isFinished ? 'settled' : 'in progress'}>
          <PlayStakeWidget widgetToken={authState?.widgetToken ?? null} gameId={authState?.gameId ?? null} />
        </GameMobileFAB>
      )}

      {/* Header */}
      <div className="game-header mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Darts 301</h1>
          <p className="text-sm text-text-muted font-mono">Aim the crosshair — click to throw</p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        <div className="game-area lg:col-span-2 space-y-4">
          {(phase === 'playing' || phase === 'finished') && role && (
            <>
              {/* Scoreboard bar */}
              <Card padding="sm" className="game-players-bar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${gs.currentTurn === 'A' && gs.phase !== 'finished' ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-400/30' : 'bg-white/5 text-text-muted'}`}>
                      🎯
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">{displayNameA}{role === 'A' ? ' (You)' : ''}</p>
                      <p className="text-2xl font-bold text-text-primary font-mono tabular-nums">{gs.scoreA}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Remaining</p>
                    <p className="text-sm text-text-muted font-mono">vs</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-text-muted">{displayNameB}{role === 'B' ? ' (You)' : ''}</p>
                      <p className="text-2xl font-bold text-text-primary font-mono tabular-nums">{gs.scoreB}</p>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${gs.currentTurn === 'B' && gs.phase !== 'finished' ? 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-400/30' : 'bg-white/5 text-text-muted'}`}>
                      🎯
                    </div>
                  </div>
                </div>
              </Card>

              {/* Status */}
              <Card padding="sm" className="game-status-bar">
                <p className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${statusColor}`}>
                  {statusText}
                </p>
              </Card>

              {/* Canvas */}
              <DartboardCanvas
                gs={gs}
                role={role}
                isMyTurn={isMyTurn}
                onThrow={handleThrow}
                displayNameA={displayNameA}
                displayNameB={displayNameB}
              />

              {/* Turn history */}
              <Card padding="sm" className="game-history">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted mb-3">Turn History</p>

                {gs.turnHistory.length === 0 ? (
                  <p className="text-text-muted text-xs text-center py-2">No turns yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {gs.turnHistory.slice(-8).reverse().map((t, i) => {
                      const name = t.player === 'A' ? displayNameA : displayNameB;
                      const isYou = t.player === role;
                      return (
                        <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${t.wasBust ? 'bg-danger-400/8 border border-danger-400/20' : 'bg-white/4 border border-white/8'}`}>
                          {/* Fixed-width player badge */}
                          <span className={`w-14 flex-shrink-0 text-center text-[10px] font-bold rounded px-1.5 py-0.5 truncate ${t.player === 'A' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                            {isYou ? 'You' : name.slice(0, 6)}
                          </span>
                          {/* Score */}
                          <span className={`w-12 flex-shrink-0 text-center text-xs font-bold font-mono ${t.wasBust ? 'text-danger-400' : 'text-brand-400'}`}>
                            {t.wasBust ? 'BUST' : `−${t.total}`}
                          </span>
                          {/* Remaining */}
                          <span className="flex-1 text-right text-[10px] text-text-muted font-mono tabular-nums">
                            → {t.scoreAfter}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Result overlay */}
              {isFinished && gs.winner && (
                settlementResult && role ? (
                  <GameResultOverlay
                    outcome={deriveOutcome(settlementResult, role)}
                    amount={formatResultAmount(deriveOutcome(settlementResult, role), settlementResult.winnerPayout, betAmountCents)}
                    visible
                    onPlayAgain={handlePlayAgain}
                    scoreText={`${STARTING_SCORE - gs.scoreA} — ${STARTING_SCORE - gs.scoreB}`}
                  />
                ) : (
                  <Card padding="sm" className={gs.winner === role ? 'border-brand-400/30 bg-brand-400/5' : 'border-danger-400/30 bg-danger-400/5'}>
                    <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                      <span className={gs.winner === role ? 'text-brand-400' : 'text-danger-400'}>
                        {gs.winner === role ? 'Victory! 🎯' : 'Defeat.'}
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
