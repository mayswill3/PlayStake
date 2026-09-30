// =============================================================================
// PlayStake — Higher / Lower rules
// =============================================================================
// One standard 52-card deck, shuffled on the server when the match starts.
// The first card is shown to both players. Player A calls whether the next
// card will be higher or lower. Aces are high, suits don't rank.
//
//   - A correct call wins for Player A.
//   - A wrong call wins for Player B.
//   - A card of the same rank is a wrong call (Player B wins).
// =============================================================================

import { shuffle } from "./rng";

export const SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"] as const;
export const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

export interface PlayingCard {
  value: (typeof VALUES)[number];
  suit: (typeof SUITS)[number];
}

export type Guess = "higher" | "lower";

export interface CardsPublicState {
  currentCard: PlayingCard | null;
  nextCard: PlayingCard | null;
  guess: Guess | null;
  result: "correct" | "wrong" | null;
}

export interface CardsSecretState {
  deck: PlayingCard[];
}

export function rank(card: PlayingCard): number {
  return VALUES.indexOf(card.value);
}

export function newDeck(): PlayingCard[] {
  return SUITS.flatMap((suit) => VALUES.map((value) => ({ value, suit })));
}

export function initialCards(): { publicState: CardsPublicState; secretState: CardsSecretState } {
  return {
    publicState: { currentCard: null, nextCard: null, guess: null, result: null },
    secretState: { deck: [] },
  };
}

/** Shuffle and turn the first card face up. Called when both players are in. */
export function dealCards(): { publicState: CardsPublicState; secretState: CardsSecretState } {
  const [currentCard, ...deck] = shuffle(newDeck());
  return {
    publicState: { currentCard, nextCard: null, guess: null, result: null },
    secretState: { deck },
  };
}

export function isGuess(value: unknown): value is Guess {
  return value === "higher" || value === "lower";
}

/** Reveal the next card against Player A's call and decide the match. */
export function resolveGuess(
  state: CardsPublicState,
  secret: CardsSecretState,
  guess: Guess,
): { publicState: CardsPublicState; secretState: CardsSecretState; winner: "A" | "B" } {
  if (!state.currentCard || state.nextCard) throw new Error("No card to guess against");
  const [nextCard, ...deck] = secret.deck;
  if (!nextCard) throw new Error("Deck is empty");

  const diff = rank(nextCard) - rank(state.currentCard);
  const correct = (guess === "higher" && diff > 0) || (guess === "lower" && diff < 0);
  return {
    publicState: { ...state, nextCard, guess, result: correct ? "correct" : "wrong" },
    secretState: { deck },
    winner: correct ? "A" : "B",
  };
}
