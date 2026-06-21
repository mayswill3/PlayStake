import * as crypto from "crypto";
import { generateRandomToken } from "../utils/crypto";

const KICK_AUTH_URL = "https://id.kick.com/oauth/authorize";
const KICK_TOKEN_URL = "https://id.kick.com/oauth/token";

// Scopes requested for the streamer link flow. Adjust per integration surface:
//   - user:read        — basic profile (sub, email, slug)
//   - channel:read     — broadcaster channel info
//   - chat:read        — subscribe to chat events
//   - events:subscribe — webhook event subscriptions (follows, subs, etc.)
const DEFAULT_SCOPES = [
  "user:read",
  "channel:read",
  "chat:read",
  "events:subscribe",
];

function getConfig() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing KICK_CLIENT_ID or KICK_CLIENT_SECRET environment variables",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/kick/callback`,
  };
}

export function generateOAuthState(): string {
  return generateRandomToken(32);
}

/**
 * Generate a PKCE code_verifier (RFC 7636 §4.1).
 *
 * Spec requires 43–128 chars from the unreserved set. 64 random bytes
 * encoded as base64url comfortably lands in that range.
 */
export function generatePkceVerifier(): string {
  return crypto.randomBytes(64).toString("base64url");
}

/**
 * Derive the PKCE code_challenge from a verifier (S256 method).
 */
export function deriveCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function getKickAuthUrl(state: string, codeVerifier: string): string {
  const { clientId, redirectUri } = getConfig();
  const codeChallenge = deriveCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DEFAULT_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${KICK_AUTH_URL}?${params.toString()}`;
}

export interface KickTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<KickTokens> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const res = await fetch(KICK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Kick token exchange failed (${res.status}): ${error}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<KickTokens> {
  const { clientId, clientSecret } = getConfig();

  const res = await fetch(KICK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Kick token refresh failed (${res.status}): ${error}`);
  }

  return res.json();
}
