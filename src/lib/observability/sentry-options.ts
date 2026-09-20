// =============================================================================
// PlayStake — Shared Sentry options
// =============================================================================
// One place to decide what we send, because this application handles money and
// identity documents and the default for an error reporter is to be generous
// with context.
//
// Everything here is inert until SENTRY_DSN is set: the SDK disables itself
// when the DSN is undefined, so an unconfigured environment pays nothing and
// reports nothing.
// =============================================================================

export const SENTRY_DSN =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Sample rate for performance traces. Errors are always captured; traces are
 * the expensive part, so keep this low and raise it deliberately.
 */
const TRACES_SAMPLE_RATE = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

export function sentryBaseOptions() {
  return {
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",

    // Never attach cookies, headers, or request bodies automatically. A session
    // cookie is a credential and a KYC upload is the most sensitive data we
    // hold; neither belongs in a third-party error report.
    sendDefaultPii: false,

    tracesSampleRate: Number.isFinite(TRACES_SAMPLE_RATE) ? TRACES_SAMPLE_RATE : 0.1,

    // Local runs shouldn't post to a shared project even if a DSN leaks into
    // a developer's .env.
    enabled: Boolean(SENTRY_DSN) && process.env.NODE_ENV === "production",
  };
}
