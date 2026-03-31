import { generateRandomToken } from "../utils/crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables");
  }

  return { clientId, clientSecret, redirectUri: `${appUrl}/api/auth/google/callback` };
}

/**
 * Generate a random state token for CSRF protection.
 */
export function generateOAuthState(): string {
  return generateRandomToken(32);
}

/**
 * Build the Google OAuth consent URL.
 */
export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  return res.json();
}

export interface GoogleUserInfo {
  sub: string;       // Google user ID
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

/**
 * Decode the id_token JWT payload to extract user info.
 *
 * The id_token was obtained directly from Google's token endpoint over HTTPS,
 * so we trust its contents without local signature verification.
 */
export function getGoogleUserInfo(idToken: string): GoogleUserInfo {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid id_token format");
  }

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));

  if (!payload.sub || !payload.email) {
    throw new Error("id_token missing required fields (sub, email)");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture,
    email_verified: payload.email_verified ?? false,
  };
}
