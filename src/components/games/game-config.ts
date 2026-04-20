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
      'Take turns placing your mark (X or O)',
      'Get three in a row: horizontal, vertical, or diagonal',
      'First to connect three wins the round',
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
    description: 'Guess whether the next card is higher or lower.',
    icon: Layers,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'A card is dealt — guess if the next one is higher or lower',
      'Correct guesses score a point',
      'Most points after both players guess wins',
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
    description: 'Start at 301, subtract your score each turn — first to zero wins.',
    icon: Target,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Start at 301 — subtract your score each turn',
      'Aim the moving crosshair and click to throw (3 darts per turn)',
      'Treble = 3×, Double = 2×, Bull = 25, Bullseye = 50',
      'Going below 0 is a BUST — score reverts, turn ends',
      'First to reach exactly 0 wins',
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
