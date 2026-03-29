'use client';

import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Grid3x3 } from 'lucide-react';
import { useLandscapeLock } from '@/hooks/useLandscapeLock';
import { RotatePrompt } from '@/components/ui/RotatePrompt';
import { GameMobileFAB } from '@/components/ui/GameMobileFAB';
import { useEventLog } from '../_shared/use-event-log';
import { useDemoAuth } from '../_shared/use-demo-auth';
import { useGameSession } from '../_shared/use-game-session';
import { PlayStakeWidget, type PlayStakeWidgetHandle } from '../_shared/PlayStakeWidget';
import { GameResultOverlay, deriveOutcome, formatResultAmount, type SettlementResult } from '../_shared/GameResultOverlay';
import { RoleSelector } from '../_shared/RoleSelector';
import { LobbyPanel } from '../_shared/LobbyPanel';
import { EventLog } from '../_shared/EventLog';
import type { PlayerRole } from '../_shared/types';

type CellValue = 'X' | 'O' | null;

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getWinLine(board: (string | null)[]): number[] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

export default function TicTacToeDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('tictactoe', log);
  const {
    sessionId,
    gameState,
    phase,
    setPhase,
    createGame,
    joinGame,
    startPlayingPoll,
    makeMove,
    setBetId,
    reportAndSettle,
  } = useGameSession(log);
  useLandscapeLock(phase === 'playing' || phase === 'finished');

  const handleRoleSelect = useCallback(async (r: PlayerRole) => {
    setRole(r);
    log(`Selected role: Player ${r} (${r === 'A' ? 'X' : 'O'})`, 'info');
    const result = await setup(r);
    if (result) {
      setPhase('lobby');
    }
  }, [setup, log, setPhase]);

  const handleCreateGame = useCallback(async () => {
    if (!authState) return;
    setIsCreating(true);
    const id = await createGame(authState.playerId, 'tictactoe');
    setIsCreating(false);
    if (id) {
      log('Open the widget to create a bet, then consent to lock funds.', 'info');
    }
  }, [authState, createGame, log]);

  const handleJoinGame = useCallback(async (code: string) => {
    if (!authState) return 'Not authenticated';
    setIsJoining(true);
    const result = await joinGame(code, authState.playerId, 'tictactoe');
    setIsJoining(false);
    return result;
  }, [authState, joinGame]);

  const handleCellClick = useCallback(async (index: number) => {
    if (!role || !gameState) return;
    if (gameState.status !== 'playing') return;
    if (gameState.turn !== role) return;
    if (!gameState.board || gameState.board[index] !== null) return;

    log(`Placing ${role === 'A' ? 'X' : 'O'} on cell ${index}`, 'info');
    const result = await makeMove(index, role);

    if (result?.status === 'finished' && !settledRef.current) {
      settledRef.current = true;
      const activeBetId = result.betId || betIdRef.current;
      if (activeBetId && authState) {
        if (!result.betId && betIdRef.current) {
          await setBetId(betIdRef.current);
        }
        const settle = await reportAndSettle(authState.apiKey, activeBetId);
        if (settle) {
          setSettlementResult(settle as SettlementResult);
          widgetHandleRef.current?.refreshBalance();
        }
      }
    }
  }, [role, gameState, makeMove, authState, setBetId, reportAndSettle, log]);

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

  // Derive board state from polling
  const board: CellValue[] = (gameState?.board as CellValue[]) ?? Array(9).fill(null);
  const winLine = gameState?.status === 'finished' ? getWinLine(board) : null;
  const isMyTurn = gameState?.status === 'playing' && gameState?.turn === role;
  const isFinished = phase === 'finished' || gameState?.status === 'finished';

  // Auto-settle when we detect finish via polling (for the non-moving player)
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

  // Start playing poll for Player A when game transitions from lobby to playing
  if (phase === 'playing' && role === 'A' && sessionId && gameState?.status === 'playing') {
    // Player A's poll was for waiting; now start game state poll
    // This is handled inside useGameSession when status changes to 'playing'
  }

  // Status bar
  let statusText = '';
  let statusColor = 'text-text-secondary';
  if (gameState?.status === 'playing') {
    if (isMyTurn) {
      statusText = `Your Turn — Place ${role === 'A' ? 'X' : 'O'}`;
      statusColor = 'text-brand-400';
    } else {
      statusText = "Opponent's Turn...";
      statusColor = 'text-warning-400';
    }
  } else if (isFinished && gameState) {
    if (gameState.winner === role) {
      statusText = 'You Won!';
      statusColor = 'text-brand-400';
    } else if (gameState.winner === 'draw') {
      statusText = "It's a Draw!";
      statusColor = 'text-text-secondary';
    } else {
      statusText = 'You Lost!';
      statusColor = 'text-danger-400';
    }
  }

  // After Player A's game transitions to playing, start the playing poll
  const playingPollStarted = useRef(false);
  if (phase === 'playing' && role === 'A' && sessionId && !playingPollStarted.current) {
    playingPollStarted.current = true;
    startPlayingPoll(sessionId);
  }

  const isInGame = phase === 'playing' || phase === 'finished';

  return (
    <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${isInGame ? 'game-fullscreen-mobile' : ''}`}>
      <RotatePrompt isInGame={isInGame} />
      {isInGame && (
        <GameMobileFAB
          onExit={() => window.location.reload()}
          betAmount={betAmountCents || undefined}
          betStatus={gameState?.status === 'finished' ? 'settled' : 'in progress'}
          turnInfo={statusText}
          playerInfo={`Player A (X)${role === 'A' ? ' You' : ''} vs Player B (O)${role === 'B' ? ' You' : ''}`}
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
          <Grid3x3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Tic-Tac-Toe
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Two-player wagered match — three in a row wins
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {/* Role selection */}
          {phase === 'role-select' && (
            <RoleSelector onSelect={handleRoleSelect} disabled={isSettingUp} />
          )}

          {/* Setting up indicator */}
          {isSettingUp && (
            <Card padding="sm">
              <p className="font-mono text-xs text-text-muted text-center uppercase tracking-widest">
                Setting up authentication...
              </p>
            </Card>
          )}

          {/* Lobby */}
          {phase === 'lobby' && role && (
            <LobbyPanel
              role={role}
              gameCode={sessionId}
              onCreateGame={handleCreateGame}
              onJoinGame={handleJoinGame}
              isCreating={isCreating}
              isJoining={isJoining}
            />
          )}

          {/* Game board */}
          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Players bar */}
              <Card padding="sm" className="game-players-bar flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-blue-400">X</span>
                    <span className="font-mono text-xs text-text-secondary">
                      Player A{role === 'A' ? ' (You)' : ''}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-text-muted">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-pink-400">O</span>
                    <span className="font-mono text-xs text-text-secondary">
                      Player B{role === 'B' ? ' (You)' : ''}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Status bar */}
              {statusText && (
                <Card padding="sm" className="game-status-bar">
                  <p className={`font-display text-center text-sm font-semibold uppercase tracking-widest ${statusColor}`}>
                    {statusText}
                  </p>
                </Card>
              )}

              {/* Board */}
              <div className="game-board grid grid-cols-3 gap-2 max-w-[320px] mx-auto">
                {board.map((cell, i) => {
                  const isWinCell = winLine?.includes(i) ?? false;
                  const disabled = !isMyTurn || cell !== null || isFinished;

                  return (
                    <button
                      key={i}
                      onClick={() => handleCellClick(i)}
                      disabled={disabled}
                      className={`aspect-square flex items-center justify-center rounded-sm border transition-colors ${
                        isWinCell
                          ? 'border-brand-400 bg-brand-400/10'
                          : 'bg-surface-800 border-white/8'
                      } ${
                        disabled
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:border-brand-400/30 hover:bg-surface-850 cursor-pointer'
                      }`}
                    >
                      {cell === 'X' && (
                        <span className="text-blue-400 font-display text-4xl font-bold">X</span>
                      )}
                      {cell === 'O' && (
                        <span className="text-pink-400 font-display text-4xl font-bold">O</span>
                      )}
                    </button>
                  );
                })}
              </div>

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
                    className={`game-result-overlay ${
                      gameState.winner === role
                        ? 'border-brand-400/30 bg-brand-400/5'
                        : gameState.winner !== 'draw' && gameState.winner !== role
                          ? 'border-danger-400/30 bg-danger-400/5'
                          : ''
                    }`}
                  >
                    <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                      <span className={statusColor}>
                        {gameState.winner === role
                          ? 'Victory! You won the match.'
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

        {/* Sidebar: Widget + Event Log */}
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
