import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import { prisma } from '@/lib/db/client';
import { sha256Hash } from '@/lib/utils/crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = 'v1';

function getEncryptionKey() {
  const raw = process.env.AUTH_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('AUTH_ENCRYPTION_KEY environment variable is not set');
  }

  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`AUTH_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes`);
  }

  return key;
}

export function encryptTwoFactorSecret(secret: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptTwoFactorSecret(payload: string) {
  if (!payload.startsWith(`${ENCRYPTED_PREFIX}.`)) {
    // Backwards compatibility for secrets created before encryption was added.
    return payload;
  }

  const [, ivValue, tagValue, ciphertextValue] = payload.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Invalid encrypted 2FA secret');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const compact = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
  });
}

export function hashBackupCode(code: string) {
  return sha256Hash(code.replace(/-/g, '').trim().toUpperCase());
}

export async function verifySecondFactor(
  userId: string,
  encryptedSecret: string,
  token: string,
) {
  const normalized = token.trim().toUpperCase();

  if (!/^\d{6}$/.test(normalized)) {
    const result = await prisma.twoFactorBackupCode.updateMany({
      where: {
        userId,
        codeHash: hashBackupCode(normalized),
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  }

  const secret = decryptTwoFactorSecret(encryptedSecret);
  const totp = new OTPAuth.TOTP({
    issuer: 'PlayStake',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token: normalized, window: 1 });
  if (delta === null) return false;

  const acceptedStep = Math.floor(Date.now() / 30_000) + delta;
  const replayGuard = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { twoFactorLastUsedStep: null },
        { twoFactorLastUsedStep: { lt: acceptedStep } },
      ],
    },
    data: { twoFactorLastUsedStep: acceptedStep },
  });

  return replayGuard.count === 1;
}
