// Server-side Sentry init. Loaded by src/instrumentation.ts on the Node runtime.
import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/observability/sentry-options";

Sentry.init(sentryBaseOptions());
