// =============================================================================
// PlayStake — Game guides
// =============================================================================
// The public "how it works" page for each game in the catalogue (/games/<slug>).
// The standard settings here are what applies when two players don't agree
// their own on stream (Match Rules §02). Keep every claim true to how matches
// actually run: refereed, streamed on Kick, decided by what both streams show.
// =============================================================================

import type { FaqItem } from '@/lib/faq';
import type { StreamGameType } from './catalogue';

export interface GameGuide {
  gameType: StreamGameType;
  slug: string;
  name: string;
  /** Search title (the site name is appended). */
  title: string;
  description: string;
  eyebrow: string;
  summary: string;
  image: { src: string; alt: string };
  format: string;
  platforms: string;
  /** Used when the players don't agree their own settings on stream. */
  standardSettings: Array<{ label: string; value: string }>;
  /** Game-specific notes on how the referee reads the result. */
  howDecided: string[];
  /** What the referee usually does; they decide what's fair (Match Rules §04). */
  disconnects: string[];
  faqs: FaqItem[];
}

export const GAME_GUIDES: GameGuide[] = [
  {
    gameType: 'ea-sports-fc-27',
    slug: 'ea-sports-fc-27',
    name: 'EA SPORTS FC 27',
    title: 'EA SPORTS FC 27 Head-to-Head Matches with an Independent Referee',
    description:
      'How EA SPORTS FC 27 matches work on PlayStake: challenge another player, both stream on Kick, an independent referee watches and records the result. Settings, draws, disconnects and payouts explained.',
    eyebrow: 'Game guide',
    summary:
      'Play a one-against-one EA SPORTS FC 27 match against another player, both streaming on Kick, with an independent referee watching both streams and recording the result.',
    image: { src: '/home/photos/game-football.webp', alt: 'A football match on a big screen in a stadium' },
    format: 'One-against-one online friendly, streamed by both players',
    platforms: 'PlayStation 5, Xbox Series X|S and PC, wherever you can play the other player online',
    standardSettings: [
      { label: 'Mode', value: 'Online friendly (Kick-Off against your opponent)' },
      { label: 'Teams', value: 'Any club or national team; no custom or edited squads' },
      { label: 'Half length', value: '6 minutes' },
      { label: 'Draw at full time', value: 'Stays a draw, unless you agree extra time and penalties on stream first' },
      { label: 'Controls', value: 'Any; assisted settings allowed' },
      { label: 'Ultimate Team', value: 'Only if both players agree it on stream' },
    ],
    howDecided: [
      'The referee records the final score shown on both streams at full time, or after extra time and penalties if you agreed them.',
      'A draw means each player gets their stake back, less their share of the platform fee.',
      'Quitting the match, or leaving it before full time, counts as a loss unless it was a genuine disconnect (see below).',
    ],
    disconnects: [
      'If the match drops before half time, replay it from the start with the same settings.',
      'If it drops after half time, play the remaining minutes of a new match with the score carried over, or agree on stream to accept the score at the time.',
      "If a player hasn't returned within 10 minutes, the referee may award the match to the other player.",
    ],
    faqs: [
      {
        id: 'fc-which-mode',
        q: 'Which FC 27 mode do we play?',
        a: "An online friendly against each other, with 6-minute halves, unless you both agree something different on your streams before the referee starts the match. Ultimate Team is only allowed if you both agree it.",
      },
      {
        id: 'fc-draw',
        q: 'What happens if it ends in a draw?',
        a: 'It stays a draw and each player gets their stake back, less their share of the 5% platform fee. If you want a winner, agree extra time and penalties on stream before the match starts.',
      },
      {
        id: 'fc-ps-xbox',
        q: 'Can a PlayStation player play an Xbox or PC player?',
        a: 'Yes, as long as you can play each other online in FC 27 and both of you stream your own screen on Kick.',
      },
      {
        id: 'fc-who-decides',
        q: 'Who decides the result?',
        a: "An independent, approved referee who watches both of your Kick streams and records the final score. Neither player can enter or change the result. You have 15 minutes to dispute it before it's paid out.",
      },
    ],
  },
  {
    gameType: 'tekken-8',
    slug: 'tekken-8',
    name: 'Tekken 8',
    title: 'Tekken 8 Head-to-Head Sets with an Independent Referee',
    description:
      'How Tekken 8 sets work on PlayStake: challenge another player to a first-to-3 set, both stream on Kick, and an independent referee records the winner. Settings, character choice, disconnects and payouts explained.',
    eyebrow: 'Game guide',
    summary:
      'Play a Tekken 8 set against another player, both streaming on Kick, with an independent referee watching both streams and recording who wins.',
    image: { src: '/home/photos/game-fighting.webp', alt: 'A torch-lit fighting arena beneath snowy mountains' },
    format: 'One-against-one set in a private player match, streamed by both players',
    platforms: 'PlayStation 5, Xbox Series X|S and PC, wherever you can play the other player online',
    standardSettings: [
      { label: 'Mode', value: 'Online player match in a private room' },
      { label: 'Set length', value: 'First to 3 game wins (best of 5)' },
      { label: 'Each game', value: 'Best of 3 rounds, 60-second rounds' },
      { label: 'Characters', value: 'Any; you may change character between games' },
      { label: 'Stage', value: 'Random, or any stage you both agree' },
      { label: 'Controls', value: 'Any controller or arcade stick; Special Style allowed' },
    ],
    howDecided: [
      'The referee records the winner of the set: the first player to win 3 games, as shown on both streams.',
      "A set always has a winner, so there's no draw unless the referee can't tell what happened.",
      'Leaving the room or quitting before the set is decided counts as a loss unless it was a genuine disconnect (see below).',
    ],
    disconnects: [
      'Games already won still count. Rejoin the room and play the rest of the set.',
      'If a game drops part-way through, replay that game from the start.',
      "If a player hasn't returned within 10 minutes, the referee may award the match to the other player.",
    ],
    faqs: [
      {
        id: 'tekken-set',
        q: 'How long is a Tekken 8 set?',
        a: 'First to 3 game wins, each game best of 3 rounds, unless you both agree a different length on your streams before the referee starts the match.',
      },
      {
        id: 'tekken-characters',
        q: 'Can we change character during the set?',
        a: "Yes, between games. Say it on stream if you've agreed anything different, like a single character for the whole set.",
      },
      {
        id: 'tekken-crossplay',
        q: 'Can PlayStation, Xbox and PC players play each other?',
        a: 'Yes, as long as you can play each other online in Tekken 8 and both of you stream your own screen on Kick.',
      },
      {
        id: 'tekken-who-decides',
        q: 'Who decides the result?',
        a: "An independent, approved referee who watches both of your Kick streams and records who won the set. Neither player can enter or change the result. You have 15 minutes to dispute it before it's paid out.",
      },
    ],
  },
];

export function gameGuide(slug: string): GameGuide | undefined {
  return GAME_GUIDES.find((guide) => guide.slug === slug);
}

/** Steps every refereed match follows, whatever the game. */
export const MATCH_STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Get set up',
    body: 'Create an account, verify your identity (21+, living in England, Scotland or Wales), and connect your Kick channel. Both players need to stream their own screen.',
  },
  {
    title: 'Go live and pick the game',
    body: 'Go live on Kick and choose the game you are playing on PlayStake, so other players can find you and send a challenge.',
  },
  {
    title: 'Send or accept a challenge',
    body: "Choose a stake. Nothing leaves your balance until the other player accepts; then both stakes are locked for the match.",
  },
  {
    title: 'A referee joins',
    body: "An independent referee takes the match, checks both streams are live on the game, and starts it. If no referee joins within 10 minutes, it's cancelled and both stakes are returned in full.",
  },
  {
    title: 'Play the match',
    body: 'Agree any settings on stream, then play. Stay live on the game until the referee records the result.',
  },
  {
    title: 'Result and payout',
    body: 'The referee records the result from what both streams show. Either player can dispute it within 15 minutes; after that, the winner is paid the pot less a 5% platform fee.',
  },
];
