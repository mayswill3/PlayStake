'use client';

import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Layers,
  ChevronUp,
  ChevronDown,
  Trophy,
} from 'lucide-react';
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

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as const;
const VALUES = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
] as const;

function suitSymbol(suit: string) {
  const map: Record<string, string> = {
    Spades: '\u2660',
    Hearts: '\u2665',
    Diamonds: '\u2666',
    Clubs: '\u2663',
  };
  return map[suit] ?? suit;
}

function suitColor(suit: string) {
  return suit === 'Hearts' || suit === 'Diamonds'
    ? 'text-danger-400'
    : 'text-text-primary';
}

function randomCard() {
  const value = VALUES[Math.floor(Math.random() * VALUES.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { value, suit, numericValue: VALUES.indexOf(value) };
}

type CardData = ReturnType<typeof randomCard>;

export default function CardsDemoPage() {
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [currentCard, setCurrentCard] = useState<CardData>(() => randomCard());
  const [nextCard, setNextCard] = useState<CardData | null>(null);
  const [roundResult, setRoundResult] = useState<'correct' | 'wrong' | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [betAmountCents, setBetAmountCents] = useState(0);
  const betIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const widgetHandleRef = useRef<PlayStakeWidgetHandle>(null);

  const { entries, log } = useEventLog();
  const { authState, isSettingUp, setup } = useDemoAuth('cards', log);
  const {
    sessionId,
    gameState,
    phase,
    setPhase,
    createGame,
    joinGame,
    startPlayingPoll,
    resolveGame,
    setGameData,
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

  const handleCreateGame = useCallback(async () => {
    if (!authState) return;
    setIsCreating(true);
    const id = await createGame(authState.playerId, 'cards');
    setIsCreating(false);
    if (id) {
      log('Open the widget to create a bet, then consent to lock funds.', 'info');
    }
  }, [authState, createGame, log]);

  const handleJoinGame = useCallback(async (code: string) => {
    if (!authState) return 'Not authenticated';
    setIsJoining(true);
    const result = await joinGame(code, authState.playerId, 'cards');
    setIsJoining(false);
    return result;
  }, [authState, joinGame]);

  const handleGuess = useCallback(async (direction: 'higher' | 'lower') => {
    if (role !== 'A' || !authState) return; // Only Player A guesses

    const next = randomCard();
    setNextCard(next);

    const isHigher = next.numericValue > currentCard.numericValue;
    const isCorrect =
      (direction === 'higher' && isHigher) ||
      (direction === 'lower' && !isHigher);
    const result = next.numericValue === currentCard.numericValue ? 'wrong' : isCorrect ? 'correct' : 'wrong';
    setRoundResult(result);

    const winner: 'A' | 'B' = result === 'correct' ? 'A' : 'B';

    log(`Guessed ${direction} — next card is ${next.value} of ${next.suit}`, 'info');
    log(result === 'correct' ? 'Correct!' : 'Wrong!', result === 'correct' ? 'success' : 'error');

    // Sync card state to server for Player B to see
    await setGameData({
      currentCard: { value: currentCard.value, suit: currentCard.suit },
      nextCard: { value: next.value, suit: next.suit },
      guess: direction,
      result,
    });

    const resolved = await resolveGame(winner);
    if (resolved && !settledRef.current) {
      settledRef.current = true;
      const activeBetId = resolved.betId || betIdRef.current;
      if (activeBetId) {
        const settle = await reportAndSettle(authState.apiKey, activeBetId);
        if (settle) {
          setSettlementResult(settle as SettlementResult);
          widgetHandleRef.current?.refreshBalance();
        }
      }
    }
  }, [role, authState, currentCard, resolveGame, setGameData, reportAndSettle, log]);

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

  // Player B reads card state from gameData via polling
  const gameData = gameState?.gameData as {
    currentCard?: { value: string; suit: string };
    nextCard?: { value: string; suit: string };
    guess?: string;
    result?: string;
  } | undefined;

  // Sync card display for Player B
  const displayCurrent = role === 'B' && gameData?.currentCard
    ? gameData.currentCard
    : currentCard;
  const displayNext = role === 'B' && gameData?.nextCard
    ? gameData.nextCard
    : nextCard;
  const displayResult = role === 'B' && gameData?.result
    ? (gameData.result as 'correct' | 'wrong')
    : roundResult;

  // Auto-settle when we detect finish via polling (for Player B)
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

  // Start playing poll for Player A
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
          turnInfo={isFinished ? (displayResult === 'correct' ? 'Correct!' : 'Wrong!') : role === 'A' ? 'Your guess' : "Waiting for guess..."}
          playerInfo={`Guesser${role === 'A' ? ' (You)' : ''} vs Watcher${role === 'B' ? ' (You)' : ''}`}
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
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Higher / Lower
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Two-player wagered match — guess the next card
          </p>
        </div>
      </div>

      <div className="game-grid grid gap-6 lg:grid-cols-3">
        {/* Game area */}
        <div className="game-area lg:col-span-2 space-y-4">
          {/* Role selection */}
          {phase === 'role-select' && (
            <RoleSelector
              onSelect={handleRoleSelect}
              disabled={isSettingUp}
              gameLabel={{ a: 'Guesser', b: 'Watcher' }}
            />
          )}

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

          {/* Card game area */}
          {(phase === 'playing' || phase === 'finished') && (
            <>
              {/* Score bar */}
              <Card padding="sm" className="game-players-bar flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-brand-400" />
                    <span className="font-mono text-xs text-text-secondary">
                      Player A (Guesser){role === 'A' ? ' — You' : ''}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-text-muted">vs</span>
                  <span className="font-mono text-xs text-text-secondary">
                    Player B (Watcher){role === 'B' ? ' — You' : ''}
                  </span>
                </div>
              </Card>

              {/* Card display */}
              <div className="grid gap-4 md:grid-cols-2">
                <PlayingCard
                  label="Current Card"
                  value={displayCurrent.value}
                  suit={displayCurrent.suit}
                />

                {displayNext ? (
                  <PlayingCard
                    label="Next Card"
                    value={displayNext.value}
                    suit={displayNext.suit}
                    highlight={displayResult}
                  />
                ) : (
                  <Card className="flex flex-col items-center justify-center min-h-[220px]">
                    <div className="h-24 w-16 rounded-sm border-2 border-dashed border-white/10 flex items-center justify-center mb-3">
                      <span className="font-mono text-2xl text-text-muted">?</span>
                    </div>
                    <p className="font-mono text-xs text-text-muted uppercase tracking-widest">
                      {role === 'A' ? 'Make your guess' : 'Waiting for Player A to guess...'}
                    </p>
                  </Card>
                )}
              </div>

              {/* Result overlay */}
              {isFinished && settlementResult && role ? (
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
              ) : displayResult && (
                <Card
                  padding="sm"
                  className={`game-status-bar ${
                    displayResult === 'correct'
                      ? 'border-brand-400/30 bg-brand-400/5'
                      : 'border-danger-400/30 bg-danger-400/5'
                  }`}
                >
                  <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                    <span
                      className={
                        displayResult === 'correct'
                          ? 'text-brand-400'
                          : 'text-danger-400'
                      }
                    >
                      {displayResult === 'correct'
                        ? role === 'A' ? 'Correct! You win!' : 'Correct guess — Player A wins!'
                        : role === 'A' ? 'Wrong! You lose!' : 'Wrong guess — Player B wins!'}
                    </span>
                  </p>
                </Card>
              )}

              {/* Guess buttons (Player A only, while game is in progress) */}
              {role === 'A' && gameState?.status === 'playing' && !nextCard && (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => handleGuess('higher')}
                  >
                    <ChevronUp className="h-5 w-5" />
                    Higher
                  </Button>
                  <Button
                    size="lg"
                    variant="danger"
                    className="w-full"
                    onClick={() => handleGuess('lower')}
                  >
                    <ChevronDown className="h-5 w-5" />
                    Lower
                  </Button>
                </div>
              )}

              {/* Waiting indicator for Player B */}
              {role === 'B' && gameState?.status === 'playing' && !displayNext && (
                <Card padding="sm">
                  <p className="font-mono text-xs text-text-muted text-center uppercase tracking-widest">
                    Waiting for Player A to make their guess...
                  </p>
                </Card>
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

function PlayingCard({
  label,
  value,
  suit,
  highlight,
}: {
  label: string;
  value: string;
  suit: string;
  highlight?: 'correct' | 'wrong' | null;
}) {
  const borderClass =
    highlight === 'correct'
      ? 'border-brand-400/40'
      : highlight === 'wrong'
        ? 'border-danger-400/40'
        : '';

  return (
    <Card className={`flex flex-col items-center justify-center min-h-[220px] ${borderClass}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-4">
        {label}
      </p>
      <div className="flex flex-col items-center">
        <span
          className={`text-5xl font-mono font-bold tabular-nums ${suitColor(suit)}`}
        >
          {value}
        </span>
        <span className={`text-3xl mt-1 ${suitColor(suit)}`}>
          {suitSymbol(suit)}
        </span>
        <span className="font-mono text-xs text-text-secondary mt-2">
          of {suit}
        </span>
      </div>
    </Card>
  );
}
