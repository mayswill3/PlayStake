import type { User, UserRole } from "../../../generated/prisma/client.js";
import { validateSession } from "../auth/session.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Authenticated session context attached to handlers by withSessionAuth.
 */
export interface SessionAuthContext {
  userId: string;
  user: User;
}

/**
 * Next.js App Router handler signature.
 * Handlers receive (Request, context) and return a Response.
 */
type RouteHandler = (
  req: Request,
  context?: { params?: Record<string, string> }
) => Promise<Response>;

/**
 * Authenticated handler receives the auth context as a third argument.
 */
type AuthenticatedHandler = (
  req: Request,
  context: { params?: Record<string, string> },
  auth: SessionAuthContext
) => Promise<Response>;

/**
 * Role-guarded handler receives the auth context as a third argument.
 */
type RoleGuardedHandler = AuthenticatedHandler;

// ---------------------------------------------------------------------------
// Cookie parsing
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = "playstake_session";

function getSessionTokenFromCookies(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  // Parse cookies manually (avoiding external dependency)
  const cookies = cookieHeader.split(";").reduce(
    (acc, pair) => {
      const [key, ...valueParts] = pair.trim().split("=");
      if (key) {
        acc[key.trim()] = valueParts.join("=").trim();
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return cookies[SESSION_COOKIE_NAME] ?? null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Wrap a Next.js App Router API route handler with session authentication.
 *
 * Reads the `playstake_session` cookie, validates the session, and passes
 * the authenticated user context to the handler. Returns 401 if the
 * session is missing or invalid.
 *
 * Usage:
 * ```ts
 * export const GET = withSessionAuth(async (req, context, auth) => {
 *   // auth.userId, auth.user are available
 *   return Response.json({ user: auth.user });
 * });
 * ```
 */
export function withSessionAuth(handler: AuthenticatedHandler): RouteHandler {
  return async (
    req: Request,
    context?: { params?: Record<string, string> }
  ): Promise<Response> => {
    const sessionToken = getSessionTokenFromCookies(req);

    if (!sessionToken) {
      return Response.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return Response.json(
        { error: "Invalid or expired session", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    return handler(req, context ?? {}, {
      userId: session.userId,
      user: session.user,
    });
  };
}

/**
 * Wrap a handler with session authentication AND role authorization.
 *
 * The user must have one of the specified roles. Returns 403 if the
 * user is authenticated but lacks the required role.
 *
 * Usage:
 * ```ts
 * export const POST = withRoleGuard(
 *   [UserRole.DEVELOPER, UserRole.ADMIN],
 *   async (req, context, auth) => {
 *     // Only DEVELOPER or ADMIN users reach here
 *     return Response.json({ ok: true });
 *   }
 * );
 * ```
 */
export function withRoleGuard(
  roles: UserRole[],
  handler: RoleGuardedHandler
): RouteHandler {
  return withSessionAuth(async (req, context, auth) => {
    if (!roles.includes(auth.user.role as UserRole)) {
      return Response.json(
        {
          error: "Insufficient permissions",
          code: "FORBIDDEN",
          requiredRoles: roles,
        },
        { status: 403 }
      );
    }

    return handler(req, context, auth);
  });
}
