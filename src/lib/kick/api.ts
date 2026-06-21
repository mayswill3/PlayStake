import { prisma } from "../db/client";
import { refreshAccessToken } from "../auth/kick";
import { decrypt, encrypt } from "../utils/encryption";

const KICK_API_BASE = "https://api.kick.com/public/v1";

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

  return res.json() as Promise<T>;
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
