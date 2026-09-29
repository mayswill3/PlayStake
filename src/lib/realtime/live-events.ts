// =============================================================================
// PlayStake — Live-status events
// =============================================================================
// Site-wide nudge that someone's live state changed: a Kick channel went live
// or offline, or a streamer changed their declared game. The payload carries
// no data — clients refetch the endpoints they already use, so nothing
// private flows over the stream and permissions stay with those endpoints.
// =============================================================================

import { publishLobbyEvent } from "../lobby/pubsub";

export const LIVE_STATUS_CHANNEL = "live:status";

/** Never throws and never blocks for long — see `publishLobbyEvent`. */
export function publishLiveStatusChanged(): Promise<void> {
  return publishLobbyEvent(LIVE_STATUS_CHANNEL, { type: "live-status" });
}
