import { NextRequest } from "next/server";
import { validateApiKey } from "./api-key";
import { validateWidgetToken } from "./widget-token";
import { prisma } from "../db/client";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../errors/index";

// ---------------------------------------------------------------------------
// API Key authentication helper
// ---------------------------------------------------------------------------

/**
 * Extract and validate the API key from the Authorization header.
 *
 * Reads `Authorization: Bearer ps_live_...`, validates the key, checks
 * required permissions, and fires off a lastUsedAt update.
 *
 * @throws AuthenticationError if the key is missing, malformed, or invalid.
 * @throws AuthorizationError if the key lacks required permissions.
 */
export async function authenticateApiKey(
  request: NextRequest,
  requiredPermissions: string[]
): Promise<{ developerProfileId: string; keyId: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("API key required");
  }

  const rawKey = authHeader.slice("Bearer ".length).trim();

  if (!rawKey.startsWith("ps_live_")) {
    throw new AuthenticationError("Invalid API key format");
  }

  const keyData = await validateApiKey(rawKey);
  if (!keyData) {
    throw new AuthenticationError("Invalid or revoked API key");
  }

  // Check required permissions
  const missingPermissions = requiredPermissions.filter(
    (perm) => !keyData.permissions.includes(perm)
  );

  if (missingPermissions.length > 0) {
    throw new AuthorizationError(
      `Insufficient API key permissions. Missing: ${missingPermissions.join(", ")}`
    );
  }

  return {
    developerProfileId: keyData.developerProfileId,
    keyId: keyData.keyId,
  };
}

// ---------------------------------------------------------------------------
// Widget token authentication helper
// ---------------------------------------------------------------------------

/**
 * Extract and validate the widget token from the Authorization header.
 *
 * Reads `Authorization: WidgetToken wt_...`, validates the token, and
 * returns the authenticated player and game context.
 *
 * @throws AuthenticationError if the token is missing, malformed, or invalid.
 */
export async function authenticateWidget(
  request: NextRequest
): Promise<{ userId: string; gameId: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("WidgetToken ")) {
    throw new AuthenticationError("Widget token required");
  }

  const rawToken = authHeader.slice("WidgetToken ".length).trim();

  if (!rawToken.startsWith("wt_")) {
    throw new AuthenticationError("Invalid widget token format");
  }

  const tokenData = await validateWidgetToken(rawToken);
  if (!tokenData) {
    throw new AuthenticationError("Invalid or expired widget token");
  }

  return {
    userId: tokenData.userId,
    gameId: tokenData.gameId,
  };
}

// ---------------------------------------------------------------------------
// Developer ownership verification helpers
// ---------------------------------------------------------------------------

/**
 * Verify that a developer profile owns a game.
 *
 * @throws NotFoundError if the game does not exist.
 * @throws AuthorizationError if the developer does not own the game.
 */
export async function verifyDeveloperOwnsGame(
  developerProfileId: string,
  gameId: string
): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { developerProfileId: true },
  });

  if (!game) {
    throw new NotFoundError(`Game ${gameId} not found`);
  }

  if (game.developerProfileId !== developerProfileId) {
    throw new AuthorizationError(
      "Game does not belong to this developer"
    );
  }
}

/**
 * Verify that a developer profile owns the game associated with a bet.
 *
 * Returns the bet and game data for further processing.
 *
 * @throws NotFoundError if the bet does not exist.
 * @throws AuthorizationError if the developer does not own the bet's game.
 */
export async function verifyDeveloperOwnsBet(
  developerProfileId: string,
  betId: string
): Promise<{
  bet: Awaited<ReturnType<typeof prisma.bet.findUniqueOrThrow>> & {
    game: Awaited<ReturnType<typeof prisma.game.findUniqueOrThrow>>;
  };
}> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      game: true,
      playerA: {
        select: { id: true, displayName: true },
      },
      playerB: {
        select: { id: true, displayName: true },
      },
    },
  });

  if (!bet) {
    throw new NotFoundError(`Bet ${betId} not found`);
  }

  if (bet.game.developerProfileId !== developerProfileId) {
    throw new AuthorizationError(
      "Bet does not belong to a game owned by this developer"
    );
  }

  return { bet: bet as any };
}
