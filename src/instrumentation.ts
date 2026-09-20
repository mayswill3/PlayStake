// =============================================================================
// PlayStake — Next.js instrumentation hook
// =============================================================================
// Runs once per server process, before the app handles a request. Loads the
// runtime-appropriate Sentry init and wires Next's server-error hook.
// =============================================================================

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Reports errors thrown inside server components and route handlers. */
export const onRequestError = Sentry.captureRequestError;
