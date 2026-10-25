/**
 * Client-safe game catalogue shared by public forms and streaming setup.
 * Database lookups and challenge rules live in the lobby layer.
 */
export const STREAM_GAME_CATALOGUE = {
  "ea-sports-fc-27": {
    slug: "ea-sports-fc-27",
    name: "EA SPORTS FC 27",
    category: "Console & PC games",
    mode: "refereed",
  },
  "tekken-8": {
    slug: "tekken-8",
    name: "Tekken 8",
    category: "Console & PC games",
    mode: "refereed",
  },
} as const;

export type StreamGameType = keyof typeof STREAM_GAME_CATALOGUE;

export const STREAM_GAME_TYPES = [
  "ea-sports-fc-27",
  "tekken-8",
] as const satisfies readonly StreamGameType[];

export const BETA_FAVOURITE_GAMES = [
  "EA SPORTS FC 27",
  "Tekken 8",
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
