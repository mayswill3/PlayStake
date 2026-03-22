'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import {
  Layers,
  ChevronUp,
  ChevronDown,
  DollarSign,
  User,
  Zap,
  Trophy,
  RotateCcw,
} from 'lucide-react';

type BetStatus =
  | 'IDLE'
  | 'PENDING_CONSENT'
  | 'OPEN'
  | 'MATCHED'
  | 'RESULT_REPORTED'
  | 'SETTLED';

type Outcome = 'WON' | 'LOST' | null;

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

export default function CardsDemoPage() {
  const [betStatus, setBetStatus] = useState<BetStatus>('IDLE');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [currentCard, setCurrentCard] = useState(() => randomCard());
  const [nextCard, setNextCard] = useState<ReturnType<typeof randomCard> | null>(null);
  const [roundResult, setRoundResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState({ wins: 0, losses: 0 });
  const [hasPlayed, setHasPlayed] = useState(false);

  // Bet state machine
  const startWager = useCallback(() => {
    setBetStatus('PENDING_CONSENT');
    setOutcome(null);
    setNextCard(null);
    setRoundResult(null);
    setHasPlayed(false);
  }, []);

  const acceptWager = useCallback(() => {
    setBetStatus('OPEN');
  }, []);

  const findMatch = useCallback(() => {
    setBetStatus('MATCHED');
  }, []);

  // Game mechanic
  const guess = useCallback(
    (direction: 'higher' | 'lower') => {
      const next = randomCard();
      setNextCard(next);
      setHasPlayed(true);

      const isHigher = next.numericValue > currentCard.numericValue;
      const isCorrect =
        (direction === 'higher' && isHigher) ||
        (direction === 'lower' && !isHigher);

      // Tie counts as wrong for simplicity
      const result = next.numericValue === currentCard.numericValue ? 'wrong' : isCorrect ? 'correct' : 'wrong';
      setRoundResult(result);

      const betOutcome: Outcome = result === 'correct' ? 'WON' : 'LOST';
      setOutcome(betOutcome);
      setBetStatus('RESULT_REPORTED');

      setScore((prev) => ({
        wins: prev.wins + (betOutcome === 'WON' ? 1 : 0),
        losses: prev.losses + (betOutcome === 'LOST' ? 1 : 0),
      }));
    },
    [currentCard],
  );

  const settle = useCallback(() => {
    setBetStatus('SETTLED');
  }, []);

  const playAgain = useCallback(() => {
    setCurrentCard(nextCard ?? randomCard());
    setNextCard(null);
    setRoundResult(null);
    setOutcome(null);
    setBetStatus('IDLE');
    setHasPlayed(false);
  }, [nextCard]);

  const displayStatus =
    betStatus === 'SETTLED' && outcome
      ? outcome
      : betStatus === 'IDLE'
        ? 'PENDING'
        : betStatus;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Higher / Lower
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Guess whether the next card is higher or lower
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Game area -- spans 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          {/* Score bar */}
          <Card padding="sm" className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-brand-400" />
                <span className="font-mono text-sm tabular-nums text-text-primary">
                  {score.wins}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                  W
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm tabular-nums text-text-primary">
                  {score.losses}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                  L
                </span>
              </div>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Round {score.wins + score.losses + (hasPlayed ? 0 : 1)}
            </span>
          </Card>

          {/* Card display */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Current card */}
            <PlayingCard
              label="Current Card"
              value={currentCard.value}
              suit={currentCard.suit}
            />

            {/* Next card (or placeholder) */}
            {nextCard ? (
              <PlayingCard
                label="Next Card"
                value={nextCard.value}
                suit={nextCard.suit}
                highlight={roundResult}
              />
            ) : (
              <Card className="flex flex-col items-center justify-center min-h-[220px]">
                <div className="h-24 w-16 rounded-sm border-2 border-dashed border-white/10 flex items-center justify-center mb-3">
                  <span className="font-mono text-2xl text-text-muted">?</span>
                </div>
                <p className="font-mono text-xs text-text-muted uppercase tracking-widest">
                  Make your guess
                </p>
              </Card>
            )}
          </div>

          {/* Result message */}
          {roundResult && (
            <Card
              padding="sm"
              className={
                roundResult === 'correct'
                  ? 'border-brand-400/30 bg-brand-400/5'
                  : 'border-danger-400/30 bg-danger-400/5'
              }
            >
              <p className="font-display text-center text-sm font-semibold uppercase tracking-widest">
                <span
                  className={
                    roundResult === 'correct'
                      ? 'text-brand-400'
                      : 'text-danger-400'
                  }
                >
                  {roundResult === 'correct'
                    ? 'Correct! You win this round.'
                    : 'Wrong! You lose this round.'}
                </span>
              </p>
            </Card>
          )}

          {/* Game action buttons */}
          {betStatus === 'MATCHED' && !hasPlayed && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="w-full"
                onClick={() => guess('higher')}
              >
                <ChevronUp className="h-5 w-5" />
                Higher
              </Button>
              <Button
                size="lg"
                variant="danger"
                className="w-full"
                onClick={() => guess('lower')}
              >
                <ChevronDown className="h-5 w-5" />
                Lower
              </Button>
            </div>
          )}
        </div>

        {/* PlayStake Widget */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-primary">
                PlayStake Wager
              </h2>
              <StatusBadge status={displayStatus} />
            </div>

            {/* Bet details */}
            <div className="space-y-3 mb-6">
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Wager"
                value="$10.00"
              />
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label="Opponent"
                value="CardShark99"
              />
              <DetailRow
                icon={<Zap className="h-4 w-4" />}
                label="Game"
                value="Higher/Lower"
              />
              {outcome && (
                <DetailRow
                  icon={<Trophy className="h-4 w-4" />}
                  label="Payout"
                  value={outcome === 'WON' ? '+$9.00' : '-$10.00'}
                  valueClass={
                    outcome === 'WON' ? 'text-brand-400' : 'text-danger-400'
                  }
                />
              )}
            </div>

            {/* State machine progress */}
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-2">
                Lifecycle
              </p>
              <div className="flex gap-1">
                {(
                  [
                    'PENDING_CONSENT',
                    'OPEN',
                    'MATCHED',
                    'RESULT_REPORTED',
                    'SETTLED',
                  ] as BetStatus[]
                ).map((step) => {
                  const steps: BetStatus[] = [
                    'PENDING_CONSENT',
                    'OPEN',
                    'MATCHED',
                    'RESULT_REPORTED',
                    'SETTLED',
                  ];
                  const currentIdx = steps.indexOf(betStatus);
                  const stepIdx = steps.indexOf(step);
                  const active = betStatus !== 'IDLE' && stepIdx <= currentIdx;
                  return (
                    <div
                      key={step}
                      className={`h-1.5 flex-1 rounded-sm transition-colors ${
                        active ? 'bg-brand-400' : 'bg-surface-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              {betStatus === 'IDLE' && (
                <Button className="w-full" onClick={startWager}>
                  Place Bet
                </Button>
              )}

              {betStatus === 'PENDING_CONSENT' && (
                <Button className="w-full" onClick={acceptWager}>
                  Accept & Open
                </Button>
              )}

              {betStatus === 'OPEN' && (
                <Button className="w-full" onClick={findMatch}>
                  Find Opponent
                </Button>
              )}

              {betStatus === 'MATCHED' && !hasPlayed && (
                <p className="text-center font-mono text-xs text-text-muted uppercase tracking-widest">
                  Choose Higher or Lower to play
                </p>
              )}

              {betStatus === 'RESULT_REPORTED' && (
                <Button className="w-full" onClick={settle}>
                  Settle Wager
                </Button>
              )}

              {betStatus === 'SETTLED' && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={playAgain}
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </Button>
              )}
            </div>
          </Card>

          {/* How to play */}
          <Card padding="sm">
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-2">
              How to Play
            </p>
            <ol className="list-decimal list-inside space-y-1 font-mono text-xs text-text-secondary">
              <li>Place your bet and accept the wager</li>
              <li>Wait for an opponent to match</li>
              <li>Guess if the next card is higher or lower</li>
              <li>Settle the wager to collect your payout</li>
            </ol>
          </Card>
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

function DetailRow({
  icon,
  label,
  value,
  valueClass = 'text-text-primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="font-mono text-xs uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className={`font-mono text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}
