import type { LucideIcon } from 'lucide-react';
import { Grid3x3, Layers, Target } from 'lucide-react';
import { TicTacToePreview } from './previews/tictactoe-preview';
import { CardsPreview } from './previews/cards-preview';
import { DartsPreview } from './previews/darts-preview';

export interface RoleMeta {
  title: string;
  subtitle: string;
  description: string;
}

export interface GameConfig {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind class fragment used for accent bg (e.g. 'bg-brand-600/10 text-brand-600') */
  accentBg: string;
  accentText: string;
  rules: string[];
  preview: React.ComponentType;
  roleA: RoleMeta;
  roleB: RoleMeta;
}

export const GAME_CONFIG: Record<string, GameConfig> = {
  tictactoe: {
    key: 'tictactoe',
    name: 'Tic-Tac-Toe',
    description: 'Three in a row wins. Simple and fast.',
    icon: Grid3x3,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'X (the player who set the stake) moves first, then you take turns',
      'Get three in a row: horizontal, vertical, or diagonal',
      'First to connect three wins the match',
      'A full board with no line is a draw: the pot, less the fee, is split equally',
    ],
    preview: TicTacToePreview,
    roleA: {
      title: 'Player X',
      subtitle: 'Sets the stake',
      description: 'Pick your wager and invite a waiting opponent',
    },
    roleB: {
      title: 'Player O',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept the first invite you like',
    },
  },
  cards: {
    key: 'cards',
    name: 'Higher / Lower',
    description: 'One call: is the next card higher or lower?',
    icon: Layers,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'A fresh 52-card deck is shuffled by PlayStake and the first card is shown to both players',
      'The Guesser makes one call: will the next card be higher or lower?',
      'Aces are high; suits do not count',
      'A correct call wins for the Guesser. A wrong call wins for the Watcher',
      'If the next card is the same rank, the call is wrong and the Watcher wins',
    ],
    preview: CardsPreview,
    roleA: {
      title: 'Guesser',
      subtitle: 'Sets the stake',
      description: 'Pick your wager and invite a waiting watcher',
    },
    roleB: {
      title: 'Watcher',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept a guesser invite',
    },
  },
  darts: {
    key: 'darts',
    name: 'Darts 301',
    description: 'Three rounds from 301. Hit exactly zero, or finish lowest, to win.',
    icon: Target,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Both players start at 301. Home throws first; 3 darts per turn, 3 rounds each',
      'Drag to aim and hold to steady: a steadier, more central aim lands closer, but every dart lands with some random scatter drawn by PlayStake',
      'Treble = 3×, Double = 2×, Bull = 25, Bullseye = 50. Each dart is taken off your score',
      'Going below 0 is a BUST: your score goes back to where the turn started and the turn ends',
      'Reach exactly 0 to win at once. Otherwise, after 3 rounds the lower score wins',
      'Equal scores after 3 rounds are a draw: the pot, less the fee, is split equally',
    ],
    preview: DartsPreview,
    roleA: {
      title: 'Home',
      subtitle: 'Sets the stake',
      description: 'Throw first and put the pressure on',
    },
    roleB: {
      title: 'Away',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept a match invite',
    },
  },
};
