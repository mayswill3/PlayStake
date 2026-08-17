/**
 * Client-safe game catalogue shared by public forms and streaming setup.
 * Database lookups and challenge rules live in the lobby layer.
 */
export const STREAM_GAME_CATALOGUE = {
  cards: {
    slug: "higher-lower",
    name: "Higher / Lower",
    category: "PlayStake games",
    mode: "integrated",
  },
  tictactoe: {
    slug: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    category: "PlayStake games",
    mode: "integrated",
  },
  darts: {
    slug: "darts-301",
    name: "Darts 301",
    category: "PlayStake games",
    mode: "integrated",
  },
  "call-of-duty": {
    slug: "call-of-duty",
    name: "Call of Duty",
    category: "Console & PC games",
    mode: "refereed",
  },
  "grand-theft-auto-v": {
    slug: "grand-theft-auto-v",
    name: "Grand Theft Auto V / GTA Online",
    category: "Console & PC games",
    mode: "refereed",
  },
  "ea-sports-fc-26": {
    slug: "ea-sports-fc-26",
    name: "EA SPORTS FC 26",
    category: "Console & PC games",
    mode: "refereed",
  },
  fortnite: {
    slug: "fortnite",
    name: "Fortnite",
    category: "Console & PC games",
    mode: "refereed",
  },
  "nba-2k26": {
    slug: "nba-2k26",
    name: "NBA 2K26",
    category: "Console & PC games",
    mode: "refereed",
  },
  minecraft: {
    slug: "minecraft",
    name: "Minecraft",
    category: "Console & PC games",
    mode: "refereed",
  },
  "rocket-league": {
    slug: "rocket-league",
    name: "Rocket League",
    category: "Console & PC games",
    mode: "refereed",
  },
  "apex-legends": {
    slug: "apex-legends",
    name: "Apex Legends",
    category: "Console & PC games",
    mode: "refereed",
  },
} as const;

export type StreamGameType = keyof typeof STREAM_GAME_CATALOGUE;

export const STREAM_GAME_TYPES = [
  "cards",
  "tictactoe",
  "darts",
  "call-of-duty",
  "grand-theft-auto-v",
  "ea-sports-fc-26",
  "fortnite",
  "nba-2k26",
  "minecraft",
  "rocket-league",
  "apex-legends",
] as const satisfies readonly StreamGameType[];

export const BETA_FAVOURITE_GAMES = [
  "Call of Duty",
  "Grand Theft Auto V / GTA Online",
  "EA SPORTS FC 26",
  "Fortnite",
  "Tekken 8",
  "NBA 2K26",
  "Minecraft",
  "Rocket League",
  "Apex Legends",
  "Pool / Snooker",
  "Darts",
  "Penalty Shootout",
  "Other",
] as const;

export const BETA_APPLICANT_TYPES = [
  "Player",
  "Streamer",
  "Investor",
  "Developer",
  "Partner",
] as const;

export function isStreamGameType(value: unknown): value is StreamGameType {
  return (
    typeof value === "string" &&
    (STREAM_GAME_TYPES as readonly string[]).includes(value)
  );
}

export function streamGameTypeForSlug(slug: string): StreamGameType | null {
  for (const gameType of STREAM_GAME_TYPES) {
    if (STREAM_GAME_CATALOGUE[gameType].slug === slug) return gameType;
  }
  return null;
}

export function isRefereedStreamGame(gameType: StreamGameType): boolean {
  return STREAM_GAME_CATALOGUE[gameType].mode === "refereed";
}
