// Browser-side Sentry init. Next.js loads this automatically on the client.
import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/observability/sentry-options";

Sentry.init({
  ...sentryBaseOptions(),
  // No session replay: it records what the user sees, which on this product
  // includes balances, deposits and identity documents.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
