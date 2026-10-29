// =============================================================================
// PlayStake — Match voice chat settings (LiveKit)
// =============================================================================
// Real-time voice for the two players and the referee of a match, through
// LiveKit Cloud. Kick streams run seconds behind; this is live. The room is
// recorded (audio only) straight to the match-recordings R2 bucket and kept
// like the stream recording (Document 18).
//
// On when VOICE_CHAT_ENABLED=true and LIVEKIT_URL, LIVEKIT_API_KEY and
// LIVEKIT_API_SECRET are set. Recording also needs the R2_* settings.
// =============================================================================

export interface LiveKitConfig {
  /** wss://… for browsers. */
  url: string;
  /** https://… for the server API. */
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
}

export function liveKitConfig(): LiveKitConfig | null {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;
  return {
    url: LIVEKIT_URL,
    apiUrl: LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
  };
}

export function isVoiceEnabled(): boolean {
  return process.env.VOICE_CHAT_ENABLED === "true" && liveKitConfig() !== null;
}

const ROOM_PREFIX = "match-";

export function voiceRoomName(betId: string): string {
  return `${ROOM_PREFIX}${betId}`;
}

export function betIdFromRoom(roomName: string | undefined | null): string | null {
  return roomName?.startsWith(ROOM_PREFIX) ? roomName.slice(ROOM_PREFIX.length) : null;
}

/** Tokens are short; the page asks for a new one if it reconnects later. */
export const VOICE_TOKEN_TTL = "2h";
/** Keep the room (and its single recording) open through short drop-outs. */
export const VOICE_ROOM_DEPARTURE_TIMEOUT_S = 15 * 60;
