// =============================================================================
// PlayStake — Match Rules and Referee Code of Conduct: versions and summaries
// =============================================================================
// The full text lives on /match-rules. Players accept the Match Rules before
// their first stream challenge, and referees accept the Code of Conduct when
// they apply; the version each person accepted is stored, so a disputed match
// can be judged against the rules that applied at the time.
//
// Bump a version when a rule changes in substance. Everyone is then asked to
// accept again before their next challenge or claim. Typo fixes don't need a
// new version.
// =============================================================================

export const MATCH_RULES_VERSION = '2026-10-01';
export const REFEREE_CODE_VERSION = '2026-10-01';

/** Shown in challenge dialogs. Each must match a rule on /match-rules. */
export const KEY_PLAYER_RULES = [
  'Stay live on Kick, playing the declared game, for the whole match.',
  'Play the match yourself — no cheats, mods, macros or bots, and no agreeing results.',
  "The referee decides from what both streams show. You have 15 minutes to dispute.",
  'Be respectful to your opponent and the referee.',
] as const;

/** Shown in the Referee Hub. Each must match a rule on /match-rules#referees. */
export const KEY_REFEREE_RULES = [
  "Never officiate a match you're in, or one involving anyone you know or have a stake with.",
  'Go live on Kick and watch both streams for the whole match.',
  "Decide only from what the streams show, and write clear notes. If you can't tell, record a draw.",
  "Stay neutral: don't coach, don't take gifts, and don't bet on matches you officiate.",
  'Keep players’ details and disputes private.',
] as const;
