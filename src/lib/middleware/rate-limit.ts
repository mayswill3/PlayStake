// ---------------------------------------------------------------------------
// In-memory sliding window rate limiter
// ---------------------------------------------------------------------------
//
// Tracks request timestamps per key in memory. Suitable for single-process
// deployments. Swap the store implementation to Redis for multi-server setups.
// ---------------------------------------------------------------------------

/**
 * Rate limit configuration.
 */
export interface RateLimitOptions {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Function to derive the rate limit key from a request. */
  keyFn: (req: Request) => string;
}

interface WindowRecord {
  timestamps: number[];
}

/**
 * Create a rate limiter middleware for Next.js App Router routes.
 *
 * Returns a function that takes a Request and returns either null
 * (request allowed) or a Response (rate limit exceeded, HTTP 429).
 *
 * Usage:
 * ```ts
 * const limiter = rateLimit({
 *   windowMs: 15 * 60 * 1000,
 *   maxRequests: 100,
 *   keyFn: (req) => getClientIp(req) ?? "unknown",
 * });
 *
 * export async function POST(req: Request) {
 *   const limited = limiter(req);
 *   if (limited) return limited;
 *   // proceed...
 * }
 * ```
 */
export function rateLimit(
  options: RateLimitOptions
): (req: Request) => Response | null {
  const store = new Map<string, WindowRecord>();

  // Periodic cleanup to prevent unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter(
        (ts) => now - ts < options.windowMs
      );
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      // No entries, but keep interval alive
    }
  }, Math.min(options.windowMs, 60_000));

  // Allow process to exit despite the interval
  if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
  }

  return (req: Request): Response | null => {
    const key = options.keyFn(req);
    const now = Date.now();

    let record = store.get(key);
    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    // Prune timestamps outside the window
    record.timestamps = record.timestamps.filter(
      (ts) => now - ts < options.windowMs
    );

    if (record.timestamps.length >= options.maxRequests) {
      // Find when the oldest relevant request will expire
      const oldestInWindow = record.timestamps[0];
      const retryAfterMs = options.windowMs - (now - oldestInWindow);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      return Response.json(
        {
          error: "Too many requests",
          code: "RATE_LIMITED",
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
          },
        }
      );
    }

    // Record this request
    record.timestamps.push(now);
    return null;
  };
}

// ---------------------------------------------------------------------------
// Helper to extract client IP from request
// ---------------------------------------------------------------------------

/**
 * Extract the client IP address from a request.
 *
 * Checks common forwarding headers, then falls back to "unknown".
 * In production behind a reverse proxy, X-Forwarded-For should be set.
 */
export function getClientIp(req: Request): string {
  // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

// ---------------------------------------------------------------------------
// Pre-configured rate limiters
// ---------------------------------------------------------------------------

/**
 * Login rate limiter: 100 requests per 15 minutes per IP (relaxed for local dev).
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyFn: (req) => `login:${getClientIp(req)}`,
});

/**
 * API rate limiter: 1000 requests per minute per API key.
 *
 * Falls back to IP-based limiting if no Authorization header is present.
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000,
  keyFn: (req) => {
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      return `api:${authHeader}`;
    }
    return `api:${getClientIp(req)}`;
  },
});

/**
 * Deposit rate limiter: 5 requests per hour per user IP.
 */
export const depositRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyFn: (req) => `deposit:${getClientIp(req)}`,
});
