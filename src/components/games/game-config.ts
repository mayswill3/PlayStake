import type { LucideIcon } from 'lucide-react';
import { Crosshair, Circle, Target, Grid3x3, Layers, Zap } from 'lucide-react';
import { BullseyePreview } from './previews/bullseye-preview';
import { PoolPreview } from './previews/pool-preview';
import { ThreeShotPreview } from './previews/three-shot-preview';
import { TicTacToePreview } from './previews/tictactoe-preview';
import { CardsPreview } from './previews/cards-preview';
import { FpsPreview } from './previews/fps-preview';

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
  bullseye: {
    key: 'bullseye',
    name: 'Bullseye Pool',
    description: 'Land closest to the target. Win the round.',
    icon: Crosshair,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Aim your shot using the angle guide',
      'Land as close to the centre target as possible',
      'Closest ball after all rounds wins',
    ],
    preview: BullseyePreview,
    roleA: {
      title: 'Player A',
      subtitle: 'Sets the stake',
      description: 'Pick your wager and invite a waiting opponent',
    },
    roleB: {
      title: 'Player B',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept the first invite you like',
    },
  },
  pool: {
    key: 'pool',
    name: '8-Ball Pool',
    description: 'Classic 8-ball pool with realistic physics.',
    icon: Circle,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Break the rack to start the match',
      'Pot all your group (solids or stripes) first',
      'Sink the 8-ball in a called pocket to win',
    ],
    preview: PoolPreview,
    roleA: {
      title: 'Player A',
      subtitle: 'Sets the stake',
      description: 'Pick your wager and invite a waiting opponent',
    },
    roleB: {
      title: 'Player B',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept the first invite you like',
    },
  },
  '3shot': {
    key: '3shot',
    name: '3-Shot Pool',
    description: '3 shots each. Most balls potted wins.',
    icon: Target,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Take 3 shots per turn to pot as many balls as possible',
      'Each potted ball counts toward your score',
      'Most balls potted after both players shoot wins',
    ],
    preview: ThreeShotPreview,
    roleA: {
      title: 'Player A',
      subtitle: 'Sets the stake',
      description: 'Pick your wager and invite a waiting opponent',
    },
    roleB: {
      title: 'Player B',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept the first invite you like',
    },
  },
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
  fps: {
    key: 'fps',
    name: 'Tactical Ops',
    description: 'Team scoreboard FPS demo.',
    icon: Zap,
    accentBg: 'bg-brand-600/10',
    accentText: 'text-brand-600 dark:text-brand-400',
    rules: [
      'Two teams face off: Alpha vs Bravo',
      'Match is simulated with per-player K/D stats',
      'Team with the highest combined score wins',
    ],
    preview: FpsPreview,
    roleA: {
      title: 'Team Alpha',
      subtitle: 'Sets the stake',
      description: 'Pick your wager and invite a waiting opponent',
    },
    roleB: {
      title: 'Team Bravo',
      subtitle: 'Waits for an invite',
      description: 'Join the lobby and accept an Alpha invite',
    },
  },
};
