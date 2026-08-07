import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateBackupCodes,
  hashBackupCode,
} from '@/lib/auth/two-factor';

describe('two-factor security helpers', () => {
  const originalKey = process.env.AUTH_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AUTH_ENCRYPTION_KEY = '11'.repeat(32);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.AUTH_ENCRYPTION_KEY;
    else process.env.AUTH_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts and decrypts an authenticator secret', () => {
    const encrypted = encryptTwoFactorSecret('JBSWY3DPEHPK3PXP');
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptTwoFactorSecret(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('creates unique formatted backup codes with stable normalized hashes', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
      expect(hashBackupCode(code.toLowerCase())).toBe(hashBackupCode(code));
    }
  });
});
