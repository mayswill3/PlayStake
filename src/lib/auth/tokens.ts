import { AuthTokenType } from '../../../generated/prisma/client';
import { prisma, type TxClient } from '@/lib/db/client';
import { generateRandomToken, sha256Hash } from '@/lib/utils/crypto';

const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  [AuthTokenType.EMAIL_VERIFICATION]: 24 * 60 * 60 * 1000,
  [AuthTokenType.PASSWORD_RESET]: 60 * 60 * 1000,
};

export async function issueAuthToken(userId: string, type: AuthTokenType) {
  const rawToken = generateRandomToken(48);
  const tokenHash = sha256Hash(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[type]);

  const token = await prisma.$transaction(async (tx) => {
    await tx.authToken.deleteMany({
      where: { userId, type, usedAt: null },
    });

    return tx.authToken.create({
      data: { userId, type, tokenHash, expiresAt },
      select: { id: true, expiresAt: true },
    });
  });

  return { ...token, rawToken };
}

export async function consumeAuthToken(
  tx: TxClient,
  rawToken: string,
  type: AuthTokenType,
  options?: { allowAlreadyUsed?: boolean },
) {
  const tokenHash = sha256Hash(rawToken);
  const now = new Date();

  const token = await tx.authToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, type: true, usedAt: true, expiresAt: true },
  });

  if (
    !token ||
    token.type !== type ||
    token.expiresAt <= now
  ) {
    return null;
  }

  if (token.usedAt !== null) {
    return options?.allowAlreadyUsed ? token : null;
  }

  const consumed = await tx.authToken.updateMany({
    where: {
      id: token.id,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  return consumed.count === 1 ? token : null;
}
