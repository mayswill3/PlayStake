import { validateWidgetToken } from "../auth/widget-token";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Context attached to handlers by withWidgetAuth.
 */
export interface WidgetAuthContext {
  userId: string;
  gameId: string;
}

type RouteHandler = (
  req: Request,
  context?: { params?: Record<string, string> }
) => Promise<Response>;

type WidgetAuthenticatedHandler = (
  req: Request,
  context: { params?: Record<string, string> },
  auth: WidgetAuthContext
) => Promise<Response>;

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

const WIDGET_TOKEN_PREFIX = "WidgetToken ";

function getWidgetTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith(WIDGET_TOKEN_PREFIX)) {
    return null;
  }
  return authHeader.slice(WIDGET_TOKEN_PREFIX.length).trim();
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Wrap a Next.js App Router API route handler with widget token authentication.
 *
 * Reads the `Authorization: WidgetToken wt_...` header, validates the token,
 * and passes the player + game context to the handler. Returns 401 if the
 * token is missing or invalid.
 *
 * Usage:
 * ```ts
 * export const POST = withWidgetAuth(async (req, context, auth) => {
 *   // auth.userId (player) and auth.gameId are available
 *   return Response.json({ ok: true });
 * });
 * ```
 */
export function withWidgetAuth(
  handler: WidgetAuthenticatedHandler
): RouteHandler {
  return async (
    req: Request,
    context?: { params?: Record<string, string> }
  ): Promise<Response> => {
    const rawToken = getWidgetTokenFromHeader(req);

    if (!rawToken) {
      return Response.json(
        { error: "Widget token required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Quick format check
    if (!rawToken.startsWith("wt_")) {
      return Response.json(
        { error: "Invalid widget token format", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const tokenData = await validateWidgetToken(rawToken);

    if (!tokenData) {
      return Response.json(
        { error: "Invalid or expired widget token", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    return handler(req, context ?? {}, {
      userId: tokenData.userId,
      gameId: tokenData.gameId,
    });
  };
}
