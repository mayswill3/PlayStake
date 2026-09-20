// Edge-runtime Sentry init. Loaded by src/instrumentation.ts on the edge
// runtime, which is where proxy.ts runs.
import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/observability/sentry-options";

Sentry.init(sentryBaseOptions());
