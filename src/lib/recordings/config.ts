// =============================================================================
// PlayStake — Match recording settings
// =============================================================================
// PlayStake records every refereed match itself: a recorder opens the
// recording view (/recorder/<betId>), which shows both players' and the
// referee's Kick streams through Kick's embedded player with a live match
// clock and events panel, and captures that screen and its sound into one
// synced 1080p video. Files are kept privately in Cloudflare R2.
//
// Switched on by RECORDING_ENABLED=true, with R2_* and RECORDER_SECRET set.
// =============================================================================

export const RECORDING_SEGMENT_SECONDS = 300;
/** Matches must finish within 2 hours (Match Rules); stop a little after. */
export const RECORDING_MAX_MS = 2 * 60 * 60 * 1000 + 5 * 60 * 1000;
/** Undisputed recordings are deleted this long after the match ends. */
export const UNDISPUTED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** How long a reviewer's playback link works. */
export const PLAYBACK_URL_TTL_SECONDS = 15 * 60;

export interface R2Config {
  accountId: string;
  /** Overrides the R2 endpoint, e.g. a local MinIO for development. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function r2Config(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    endpoint: process.env.R2_ENDPOINT || undefined,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  };
}

export function isRecordingEnabled(): boolean {
  return process.env.RECORDING_ENABLED === "true" && Boolean(r2Config()) && Boolean(process.env.RECORDER_SECRET);
}

/** Object key for a recording; segments sit beside the final file. */
export function recordingKey(betId: string, name: string): string {
  return `matches/${betId}/${name}`;
}
