import {
  BETA_APPLICANT_TYPES,
  BETA_FAVOURITE_GAMES,
} from '@/lib/games/catalogue';

type DemoProfileSeed = {
  name: string;
  username: string;
  game: (typeof BETA_FAVOURITE_GAMES)[number];
  playerType: (typeof BETA_APPLICANT_TYPES)[number];
  daysAgo: number;
};

const DEMO_PROFILE_SEEDS = [
  { name: 'vexaro', username: 'vexaro', game: 'Tekken 8', playerType: 'Player', daysAgo: 0 },
  { name: 'Miloza', username: 'miloza', game: 'Tekken 8', playerType: 'Streamer', daysAgo: 1 },
  { name: 'kiyoto_', username: 'kiyoto_', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 1 },
  { name: 'Ryzenn', username: 'ryzenn', game: 'Tekken 8', playerType: 'Player', daysAgo: 2 },
  { name: 'itsNaya', username: 'itsnaya', game: 'Tekken 8', playerType: 'Streamer', daysAgo: 3 },
  { name: 'JunoQT', username: 'junoqt', game: 'Other', playerType: 'Player', daysAgo: 4 },
  { name: 'rexxy', username: 'rexxy', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 5 },
  { name: 'Cazlo', username: 'cazlo', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 6 },
  { name: 'nyra', username: 'nyra', game: 'Tekken 8', playerType: 'Streamer', daysAgo: 7 },
  { name: 'ZayFlux', username: 'zayflux', game: 'Other', playerType: 'Player', daysAgo: 9 },
  { name: 'lilacfps', username: 'lilacfps', game: 'Other', playerType: 'Player', daysAgo: 10 },
  { name: 'KarimLive', username: 'karimlive', game: 'Other', playerType: 'Player', daysAgo: 11 },
  { name: 'tobi2k', username: 'tobi2k', game: 'Tekken 8', playerType: 'Developer', daysAgo: 13 },
  { name: 'Amaari', username: 'amaari', game: 'Tekken 8', playerType: 'Player', daysAgo: 15 },
  { name: 'ZoeyByte', username: 'zoeybyte', game: 'EA SPORTS FC 27', playerType: 'Streamer', daysAgo: 16 },
  { name: 'snipzy', username: 'snipzy', game: 'Tekken 8', playerType: 'Player', daysAgo: 18 },
  { name: 'M4xwell', username: 'm4xwell', game: 'Other', playerType: 'Partner', daysAgo: 20 },
  { name: 'notKoda', username: 'notkoda', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 22 },
  { name: 'HarperGG', username: 'harpergg', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 24 },
  { name: 'jexi', username: 'jexi', game: 'Tekken 8', playerType: 'Streamer', daysAgo: 26 },
  { name: 'RamiLive', username: 'ramilive', game: 'Other', playerType: 'Player', daysAgo: 28 },
  { name: 'aimeeLive', username: 'aimeelive', game: 'Other', playerType: 'Player', daysAgo: 30 },
  { name: 'LukeFN', username: 'lukefn', game: 'Other', playerType: 'Developer', daysAgo: 32 },
  { name: 'sydnie_', username: 'sydnie_', game: 'Tekken 8', playerType: 'Streamer', daysAgo: 35 },
  { name: 'Drezzo', username: 'drezzo', game: 'Tekken 8', playerType: 'Player', daysAgo: 37 },
  { name: 'noxxi', username: 'noxxi', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 40 },
  { name: 'FayePlays', username: 'fayeplays', game: 'Tekken 8', playerType: 'Player', daysAgo: 43 },
  { name: 'KyroHD', username: 'kyrohd', game: 'Other', playerType: 'Investor', daysAgo: 46 },
  { name: 'evanTV', username: 'evantv', game: 'EA SPORTS FC 27', playerType: 'Partner', daysAgo: 50 },
  { name: 'mintyy', username: 'mintyy', game: 'EA SPORTS FC 27', playerType: 'Player', daysAgo: 55 },
] as const satisfies readonly DemoProfileSeed[];

const DEMO_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
] as const;

export const DEMO_BETA_SIGNUP_COUNT = DEMO_PROFILE_SEEDS.length;

export function buildDemoBetaSignups(now = new Date()) {
  return DEMO_PROFILE_SEEDS.map((profile, index) => {
    const createdAt = new Date(
      now.getTime() -
        profile.daysAgo * 24 * 60 * 60 * 1000 -
        (index % 12) * 37 * 60 * 1000,
    );

    return {
      name: profile.name,
      email: `${profile.username}@${
        DEMO_EMAIL_DOMAINS[index % DEMO_EMAIL_DOMAINS.length]
      }`,
      game: profile.game,
      playerType: profile.playerType,
      isDemo: true,
      consentedAt: createdAt,
      createdAt,
    };
  });
}
