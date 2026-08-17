import { describe, expect, it } from 'vitest';
import {
  DEMO_BETA_SIGNUP_COUNT,
  buildDemoBetaSignups,
} from '../../../src/lib/beta/demo-signups.js';
import {
  BETA_APPLICANT_TYPES,
  BETA_FAVOURITE_GAMES,
} from '../../../src/lib/games/catalogue.js';

describe('buildDemoBetaSignups', () => {
  const now = new Date('2026-08-17T12:00:00.000Z');
  const signups = buildDemoBetaSignups(now);

  it('creates the advertised number of visibly synthetic profiles', () => {
    expect(signups).toHaveLength(DEMO_BETA_SIGNUP_COUNT);
    expect(signups).toHaveLength(30);
    expect(signups.every((signup) => signup.isDemo)).toBe(true);
    expect(
      signups.every((signup) => signup.email.endsWith('@example.test')),
    ).toBe(true);
  });

  it('uses unique, deterministic email addresses', () => {
    const emails = signups.map((signup) => signup.email);

    expect(new Set(emails).size).toBe(emails.length);
    expect(buildDemoBetaSignups(now).map((signup) => signup.email)).toEqual(
      emails,
    );
  });

  it('only uses valid public form choices', () => {
    for (const signup of signups) {
      expect(BETA_FAVOURITE_GAMES).toContain(signup.game);
      expect(BETA_APPLICANT_TYPES).toContain(signup.playerType);
    }
  });

  it('spreads joined dates across the configured launch period', () => {
    const joinedAt = signups.map((signup) => signup.createdAt.getTime());

    expect(Math.max(...joinedAt)).toBeLessThanOrEqual(now.getTime());
    expect(Math.min(...joinedAt)).toBeLessThan(
      now.getTime() - 50 * 24 * 60 * 60 * 1000,
    );
  });
});
