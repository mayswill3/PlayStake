// =============================================================================
// PlayStake — Background job failure reporting
// =============================================================================
// BullMQ catches whatever a job throws, marks the job failed and retries it.
// That is the right runtime behaviour and the wrong observability story: every
// worker logged the failure and told nobody, so a settlement job failing on a
// loop looked identical to a quiet night.
//
// Only job-level failures are reported here. Connection-level trouble (the
// worker's own "error" event) stays in the logs, because a Redis outage fires
// it continuously and /api/health already answers that question.
// =============================================================================

import * as Sentry from "@sentry/node";

interface FailedJob {
  id?: string;
  name?: string;
  attemptsMade?: number;
  data?: unknown;
}

/**
 * Report a failed background job.
 *
 * @param worker  Queue name, so Sentry groups by which worker is unhealthy.
 * @param job     The BullMQ job, if the failure happened with one in hand.
 * @param err     What the job threw.
 */
export function reportJobFailure(
  worker: string,
  job: FailedJob | undefined,
  err: unknown,
): void {
  Sentry.captureException(err, {
    tags: {
      worker,
      job_name: job?.name,
      // The last attempt is the one that matters: earlier ones get retried and
      // often succeed, so this separates "blipped" from "genuinely stuck".
      final_attempt: String(Boolean(job?.attemptsMade && job.attemptsMade > 1)),
    },
    extra: {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    },
  });
}
