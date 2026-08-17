import {
  BETA_APPLICANT_TYPES,
  BETA_FAVOURITE_GAMES,
} from '@/lib/games/catalogue';

type DemoProfileSeed = {
  name: string;
  game: (typeof BETA_FAVOURITE_GAMES)[number];
  playerType: (typeof BETA_APPLICANT_TYPES)[number];
  daysAgo: number;
};

const DEMO_PROFILE_SEEDS = [
  { name: 'NeonRival', game: 'Tekken 8', playerType: 'Player', daysAgo: 0 },
  { name: 'FinalRound', game: 'Call of Duty', playerType: 'Streamer', daysAgo: 1 },
  { name: 'PixelAce', game: 'EA SPORTS FC 26', playerType: 'Player', daysAgo: 1 },
  { name: 'ComboTheory', game: 'Tekken 8', playerType: 'Player', daysAgo: 2 },
  { name: 'NovaStrike', game: 'Fortnite', playerType: 'Streamer', daysAgo: 3 },
  { name: 'CueMaster', game: 'Pool / Snooker', playerType: 'Player', daysAgo: 4 },
  { name: 'OvertimeKing', game: 'NBA 2K26', playerType: 'Player', daysAgo: 5 },
  { name: 'RocketMuse', game: 'Rocket League', playerType: 'Player', daysAgo: 6 },
  { name: 'ApexPulse', game: 'Apex Legends', playerType: 'Streamer', daysAgo: 7 },
  { name: 'NightShiftGG', game: 'Grand Theft Auto V / GTA Online', playerType: 'Player', daysAgo: 9 },
  { name: 'BullseyeByte', game: 'Darts', playerType: 'Player', daysAgo: 10 },
  { name: 'BlockCrafter', game: 'Minecraft', playerType: 'Player', daysAgo: 11 },
  { name: 'FramePerfect', game: 'Tekken 8', playerType: 'Developer', daysAgo: 13 },
  { name: 'ClutchOrbit', game: 'Call of Duty', playerType: 'Player', daysAgo: 15 },
  { name: 'TopBinsOnly', game: 'EA SPORTS FC 26', playerType: 'Streamer', daysAgo: 16 },
  { name: 'StormLobby', game: 'Fortnite', playerType: 'Player', daysAgo: 18 },
  { name: 'GreenFelt', game: 'Pool / Snooker', playerType: 'Partner', daysAgo: 20 },
  { name: 'FourthQuarter', game: 'NBA 2K26', playerType: 'Player', daysAgo: 22 },
  { name: 'BoostBandit', game: 'Rocket League', playerType: 'Player', daysAgo: 24 },
  { name: 'DropZoneTV', game: 'Apex Legends', playerType: 'Streamer', daysAgo: 26 },
  { name: 'VinewoodPro', game: 'Grand Theft Auto V / GTA Online', playerType: 'Player', daysAgo: 28 },
  { name: 'TripleTwenty', game: 'Darts', playerType: 'Player', daysAgo: 30 },
  { name: 'RedstoneRival', game: 'Minecraft', playerType: 'Developer', daysAgo: 32 },
  { name: 'IronFistLive', game: 'Tekken 8', playerType: 'Streamer', daysAgo: 35 },
  { name: 'ObjectiveFirst', game: 'Call of Duty', playerType: 'Player', daysAgo: 37 },
  { name: 'WeekendLeague', game: 'EA SPORTS FC 26', playerType: 'Player', daysAgo: 40 },
  { name: 'VictoryBus', game: 'Fortnite', playerType: 'Player', daysAgo: 43 },
  { name: 'BreakBuilder', game: 'Pool / Snooker', playerType: 'Investor', daysAgo: 46 },
  { name: 'BuzzerBeater', game: 'NBA 2K26', playerType: 'Partner', daysAgo: 50 },
  { name: 'SuddenDeath', game: 'Penalty Shootout', playerType: 'Player', daysAgo: 55 },
] as const satisfies readonly DemoProfileSeed[];

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
      email: `playstake-demo-${String(index + 1).padStart(2, '0')}@example.test`,
      game: profile.game,
      playerType: profile.playerType,
      isDemo: true,
      consentedAt: createdAt,
      createdAt,
    };
  });
}
