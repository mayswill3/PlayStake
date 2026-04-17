import type { LucideIcon } from 'lucide-react';
import { Grid3x3, Layers, Target, CircleDot } from 'lucide-react';
import { TicTacToePreview } from './previews/tictactoe-preview';
import { CardsPreview } from './previews/cards-preview';
import { DartsPreview } from './previews/darts-preview';
import { PoolPreview } from './previews/pool-preview';

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
    name: 'Darts 501',
    description: 'Classic 501 darts — first to check out wins.',
    icon: Target,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Both players start at 501 — subtract your score each turn',
      'Throw 3 darts per turn, aiming the wobbling reticle',
      'Must finish on exactly 0 with a double or bullseye (50)',
      'Bust resets your score to the pre-turn total',
    ],
    preview: DartsPreview,
    roleA: {
      title: 'Thrower 1',
      subtitle: 'Sets the stake',
      description: 'Throw first and set the pace of the match',
    },
    roleB: {
      title: 'Thrower 2',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept a thrower invite',
    },
  },
  pool: {
    key: 'pool',
    name: 'Bullseye Pool',
    description: 'Pot the object ball, land the cue on the bullseye.',
    icon: CircleDot,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Each shot: pot the object ball, then score where the cue ball rests on the bullseye',
      'Inner bull = 5 pts, mid ring = 3 pts, outer ring = 1 pt',
      'Miss the pot = 0 pts. Scratch = opponent gets +1 bonus',
      '3 shots per turn, object ball position rotates each shot',
      'First to 21 points wins',
    ],
    preview: PoolPreview,
    roleA: {
      title: 'Player 1',
      subtitle: 'Sets the stake',
      description: 'Shoot first and set the pace of the match',
    },
    roleB: {
      title: 'Player 2',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept a player invite',
    },
  },
};
