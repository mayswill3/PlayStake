import { WidgetSessionStatus } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { generateRandomToken, sha256Hash } from "../utils/crypto";

const WIDGET_TOKEN_PREFIX = "wt_";
const WIDGET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a widget token for a specific game + player combination.
 *
 * - Validates that the game belongs to the developer (via apiKeyDeveloperProfileId).
 * - Revokes any existing active widget token for the same game + player.
 * - Creates a new token with 1-hour TTL.
 *
 * The raw token is returned to be passed to the game client.
 * Only the SHA-256 hash is stored in the database.
 *
 * @throws Error if the game does not belong to the developer.
 * @throws Error if the player does not exist.
 */
export async function generateWidgetToken(
  gameId: string,
  playerId: string,
  apiKeyDeveloperProfileId: string
): Promise<{ widgetToken: string; expiresAt: Date }> {
  // Validate that the game belongs to the developer
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { developerProfileId: true },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.developerProfileId !== apiKeyDeveloperProfileId) {
    throw new Error("Game does not belong to this developer");
  }

  // Validate player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, deletedAt: true },
  });

  if (!player || player.deletedAt !== null) {
    throw new Error("Player not found");
  }

  // Revoke any existing active tokens for this game + player
  await prisma.widgetSession.updateMany({
    where: {
      userId: playerId,
      gameId,
      status: WidgetSessionStatus.ACTIVE,
    },
    data: {
      status: WidgetSessionStatus.REVOKED,
    },
  });

  // Generate the new token
  const randomPart = generateRandomToken(32);
  const rawToken = WIDGET_TOKEN_PREFIX + randomPart;
  const tokenHash = sha256Hash(rawToken);
  const expiresAt = new Date(Date.now() + WIDGET_TOKEN_TTL_MS);

  await prisma.widgetSession.create({
    data: {
      userId: playerId,
      gameId,
      tokenHash,
      status: WidgetSessionStatus.ACTIVE,
      expiresAt,
    },
  });

  return { widgetToken: rawToken, expiresAt };
}

/**
 * Validate a widget token.
 *
 * Hashes the raw token, looks it up, checks it is ACTIVE and not expired.
 * Returns the userId (player) and gameId if valid, or null if invalid.
 */
export async function validateWidgetToken(
  rawToken: string
): Promise<{ userId: string; gameId: string } | null> {
  const tokenHash = sha256Hash(rawToken);

  const session = await prisma.widgetSession.findUnique({
    where: { tokenHash },
  });

  if (!session) {
    return null;
  }

  if (session.status !== WidgetSessionStatus.ACTIVE) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Mark as expired for cleanup
    await prisma.widgetSession
      .update({
        where: { id: session.id },
        data: { status: WidgetSessionStatus.EXPIRED },
      })
      .catch(() => {});
    return null;
  }

  return { userId: session.userId, gameId: session.gameId };
}

/**
 * Revoke a widget token by its hash.
 */
export async function revokeWidgetToken(tokenHash: string): Promise<void> {
  await prisma.widgetSession
    .update({
      where: { tokenHash },
      data: { status: WidgetSessionStatus.REVOKED },
    })
    .catch(() => {
      // Ignore if the session doesn't exist
    });
}
