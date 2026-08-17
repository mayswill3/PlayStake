import { describe, expect, it } from 'vitest';
import { adminBetaSignupListQuerySchema } from '../../../src/lib/validation/schemas.js';

describe('adminBetaSignupListQuerySchema', () => {
  it('applies pagination defaults', () => {
    expect(adminBetaSignupListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('accepts supported filters', () => {
    const result = adminBetaSignupListQuerySchema.parse({
      page: '2',
      limit: '50',
      playerType: 'Streamer',
      game: 'Tekken 8',
      search: 'player@example.com',
    });

    expect(result).toEqual({
      page: 2,
      limit: 50,
      playerType: 'Streamer',
      game: 'Tekken 8',
      search: 'player@example.com',
    });
  });

  it('rejects unsupported filter values', () => {
    const result = adminBetaSignupListQuerySchema.safeParse({
      playerType: 'Unknown type',
      game: 'Unknown game',
    });

    expect(result.success).toBe(false);
  });
});
