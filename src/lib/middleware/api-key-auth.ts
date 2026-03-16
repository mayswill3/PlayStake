import { validateApiKey } from "../auth/api-key";
import { prisma } from "../db/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Context attached to handlers by withApiKeyAuth.
 */
export interface ApiKeyAuthContext {
  developerProfileId: string;
  permissions: string[];
  keyId: string;
}

type RouteHandler = (
  req: Request,
  context?: { params?: Record<string, string> }
) => Promise<Response>;

type ApiKeyAuthenticatedHandler = (
  req: Request,
  context: { params?: Record<string, string> },
  auth: ApiKeyAuthContext
) => Promise<Response>;

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

const BEARER_PREFIX = "Bearer ";

function getApiKeyFromHeader(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return authHeader.slice(BEARER_PREFIX.length).trim();
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Wrap a Next.js App Router API route handler with API key authentication.
 *
 * Reads the `Authorization: Bearer ps_live_...` header, validates the key,
 * and checks that the key has all required permissions. Returns 401 if the
 * key is missing or invalid, 403 if it lacks the required permissions.
 *
 * Usage:
 * ```ts
 * export const POST = withApiKeyAuth(
 *   ["bet:create"],
 *   async (req, context, auth) => {
 *     // auth.developerProfileId, auth.permissions, auth.keyId are available
 *     return Response.json({ ok: true });
 *   }
 * );
 * ```
 */
export function withApiKeyAuth(
  requiredPermissions: string[],
  handler: ApiKeyAuthenticatedHandler
): RouteHandler {
  return async (
    req: Request,
    context?: { params?: Record<string, string> }
  ): Promise<Response> => {
    const rawKey = getApiKeyFromHeader(req);

    if (!rawKey) {
      return Response.json(
        { error: "API key required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Quick format check
    if (!rawKey.startsWith("ps_live_")) {
      return Response.json(
        { error: "Invalid API key format", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const keyData = await validateApiKey(rawKey);

    if (!keyData) {
      return Response.json(
        { error: "Invalid or revoked API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Check required permissions
    const missingPermissions = requiredPermissions.filter(
      (perm) => !keyData.permissions.includes(perm)
    );

    if (missingPermissions.length > 0) {
      return Response.json(
        {
          error: "Insufficient API key permissions",
          code: "FORBIDDEN",
          missingPermissions,
        },
        { status: 403 }
      );
    }

    return handler(req, context ?? {}, {
      developerProfileId: keyData.developerProfileId,
      permissions: keyData.permissions,
      keyId: keyData.keyId,
    });
  };
}

// ---------------------------------------------------------------------------
// Cross-developer ownership check
// ---------------------------------------------------------------------------

/**
 * Assert that a game belongs to the given developer profile.
 *
 * This is the critical cross-developer authorization check that prevents
 * Developer B from operating on Developer A's games/bets.
 *
 * @throws Error with a descriptive message if ownership check fails.
 */
export async function assertDeveloperOwnsGame(
  developerProfileId: string,
  gameId: string
): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { developerProfileId: true },
  });

  if (!game) {
    throw new GameNotFoundError(gameId);
  }

  if (game.developerProfileId !== developerProfileId) {
    throw new GameOwnershipError(gameId, developerProfileId);
  }
}

/**
 * Error thrown when a game is not found.
 */
export class GameNotFoundError extends Error {
  public readonly gameId: string;

  constructor(gameId: string) {
    super(`Game ${gameId} not found`);
    this.name = "GameNotFoundError";
    this.gameId = gameId;
  }
}

/**
 * Error thrown when a developer does not own a game.
 */
export class GameOwnershipError extends Error {
  public readonly gameId: string;
  public readonly developerProfileId: string;

  constructor(gameId: string, developerProfileId: string) {
    super(
      `Developer ${developerProfileId} does not own game ${gameId}`
    );
    this.name = "GameOwnershipError";
    this.gameId = gameId;
    this.developerProfileId = developerProfileId;
  }
}
