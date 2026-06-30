import { prisma } from "../db/client";
import { refreshAccessToken } from "../auth/kick";
import { decrypt, encrypt } from "../utils/encryption";

const KICK_API_BASE = "https://api.kick.com/public/v1";
const KICK_TOKEN_URL = "https://id.kick.com/oauth/token";

// Refresh tokens that expire within this window to avoid mid-request expiry.
const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000;

export interface KickUser {
  user_id: number;
  name: string;
  email?: string;
  profile_picture?: string;
}

export interface KickChannel {
  broadcaster_user_id: number;
  slug: string;
  channel_description?: string;
  banner_picture?: string;
  stream_title?: string;
  category?: { id: number; name: string; thumbnail?: string };
  stream?: { is_live: boolean; viewer_count?: number; start_time?: string };
}

/**
 * Return a valid access token for the given Kick account, refreshing if needed.
 *
 * The new token (and refresh token, which Kick rotates) is persisted before
 * being returned so concurrent callers see consistent state.
 */
export async function getValidAccessToken(kickAccountId: string): Promise<string> {
  const account = await prisma.kickAccount.findUnique({
    where: { id: kickAccountId },
  });
  if (!account) {
    throw new Error(`KickAccount ${kickAccountId} not found`);
  }

  const expiresAt = account.tokenExpiresAt.getTime();
  if (expiresAt - Date.now() > TOKEN_REFRESH_LEEWAY_MS) {
    return decrypt(account.accessTokenEnc);
  }

  const refreshToken = decrypt(account.refreshTokenEnc);
  const tokens = await refreshAccessToken(refreshToken);

  const updated = await prisma.kickAccount.update({
    where: { id: kickAccountId },
    data: {
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
  });

  return decrypt(updated.accessTokenEnc);
}

async function kickFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${KICK_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kick API ${path} failed (${res.status}): ${body}`);
  }

  // Some endpoints (e.g. DELETE /events/subscriptions) return 204 / an empty
  // body. Parsing that as JSON throws "Unexpected end of JSON input", so guard
  // against it and return undefined for empty responses.
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Fetch the authenticated user (sub, name, email).
 *
 * Used during the OAuth callback to resolve the Kick identity, and any time
 * we need a fresh snapshot of the linked user's profile.
 */
export async function fetchKickUser(accessToken: string): Promise<KickUser> {
  const body = await kickFetch<{ data: KickUser[] }>("/users", accessToken);
  if (!body.data?.[0]) {
    throw new Error("Kick /users returned no data");
  }
  return body.data[0];
}

/**
 * Fetch the authenticated user's channel (slug, broadcaster_user_id, live state).
 */
export async function fetchKickChannel(
  accessToken: string,
): Promise<KickChannel | null> {
  const body = await kickFetch<{ data: KickChannel[] }>(
    "/channels",
    accessToken,
  );
  return body.data?.[0] ?? null;
}

// Webhook event subscriptions we register when a channel is linked. Each entry
// is sent to Kick as {name, version}; the receiver lives at /api/webhooks/kick.
// Docs: https://docs.kick.com/events/subscribe-to-events
export const KICK_SUBSCRIBED_EVENTS = [
  { name: "livestream.status.updated", version: 1 },
  { name: "channel.followed", version: 1 },
  { name: "channel.subscription.new", version: 1 },
  { name: "channel.subscription.renewal", version: 1 },
  { name: "channel.subscription.gifts", version: 1 },
] as const;

export interface KickSubscription {
  id: string;
  event: string;
  version: number;
  method: string;
  broadcaster_user_id: number;
}

/**
 * Subscribe the authenticated channel to our webhook events.
 *
 * Best-effort: returns the created subscription records. Kick de-duplicates
 * repeat subscriptions, so this is safe to call again on re-link.
 */
export async function subscribeToWebhookEvents(
  accessToken: string,
): Promise<KickSubscription[]> {
  const body = await kickFetch<{ data: KickSubscription[] }>(
    "/events/subscriptions",
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "webhook",
        events: KICK_SUBSCRIBED_EVENTS,
      }),
    },
  );
  return body.data ?? [];
}

/**
 * List the authenticated channel's webhook subscriptions.
 */
export async function listWebhookSubscriptions(
  accessToken: string,
): Promise<KickSubscription[]> {
  const body = await kickFetch<{ data: KickSubscription[] }>(
    "/events/subscriptions",
    accessToken,
  );
  return body.data ?? [];
}

/**
 * Delete webhook subscriptions by id. No-op when given an empty list.
 */
export async function deleteWebhookSubscriptions(
  accessToken: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const query = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
  await kickFetch(`/events/subscriptions?${query}`, accessToken, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// App (client-credentials) token + public channel data
// ---------------------------------------------------------------------------

// Module-level cache for the app access token. Railway runs a long-lived Node
// process, so this persists across requests.
let appTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get a server-to-server App Access Token (client credentials grant).
 *
 * Used to read publicly available data (e.g. live channel thumbnails) without
 * any individual user's token. Cached until shortly before expiry.
 */
export async function getAppAccessToken(): Promise<string> {
  if (appTokenCache && appTokenCache.expiresAt - Date.now() > TOKEN_REFRESH_LEEWAY_MS) {
    return appTokenCache.token;
  }

  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing KICK_CLIENT_ID or KICK_CLIENT_SECRET");
  }

  const res = await fetch(KICK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Kick app token request failed (${res.status})`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  appTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface KickPublicChannel {
  slug: string;
  stream_title?: string;
  stream?: { is_live: boolean; viewer_count?: number; thumbnail?: string };
}

/**
 * Fetch public channel data (incl. live thumbnail + viewer count) for up to 50
 * slugs in one call, using an app access token.
 */
export async function fetchPublicChannels(
  slugs: string[],
): Promise<KickPublicChannel[]> {
  if (slugs.length === 0) return [];
  const token = await getAppAccessToken();
  const query = slugs
    .slice(0, 50)
    .map((s) => `slug=${encodeURIComponent(s)}`)
    .join("&");
  const body = await kickFetch<{ data: KickPublicChannel[] }>(
    `/channels?${query}`,
    token,
  );
  return body.data ?? [];
}
