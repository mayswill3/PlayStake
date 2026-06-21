import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { KICK_HEADERS, verifyKickSignature } from "../../../../lib/kick/webhook";

// Webhook bodies must be read raw (unparsed) so the signature check sees the
// exact bytes Kick signed. Force the Node runtime + dynamic handling.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KickBroadcaster {
  user_id: number;
  username?: string;
  channel_slug?: string;
  profile_picture?: string;
}

interface LivestreamStatusEvent {
  broadcaster: KickBroadcaster;
  is_live: boolean;
  title?: string;
  started_at?: string | null;
  ended_at?: string | null;
}

interface ChannelFollowedEvent {
  broadcaster: KickBroadcaster;
  follower: KickBroadcaster;
}

interface SubscriptionEvent {
  broadcaster: KickBroadcaster;
  subscriber?: KickBroadcaster;
  gifter?: KickBroadcaster | null;
  giftees?: KickBroadcaster[];
  duration?: number;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const messageId = request.headers.get(KICK_HEADERS.messageId);
  const timestamp = request.headers.get(KICK_HEADERS.timestamp);
  const signature = request.headers.get(KICK_HEADERS.signature);
  const eventType = request.headers.get(KICK_HEADERS.eventType);

  if (!verifyKickSignature(messageId, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await dispatchEvent(eventType, payload);
  } catch (err) {
    // Log and acknowledge: returning non-2xx makes Kick retry, which only
    // helps for transient failures. We swallow handler errors to avoid retry
    // storms on malformed payloads, but surface them in logs.
    console.error(`Kick webhook handler error (${eventType}):`, err);
  }

  // Always 200 once the signature is valid so Kick marks delivery successful.
  return NextResponse.json({ received: true });
}

async function dispatchEvent(eventType: string | null, payload: unknown) {
  switch (eventType) {
    case "livestream.status.updated":
      return handleLivestreamStatus(payload as LivestreamStatusEvent);
    case "channel.followed":
      return handleFollow(payload as ChannelFollowedEvent);
    case "channel.subscription.new":
    case "channel.subscription.renewal":
    case "channel.subscription.gifts":
      return handleSubscription(eventType, payload as SubscriptionEvent);
    default:
      console.info(`Kick webhook: unhandled event type "${eventType}"`);
  }
}

/**
 * Persist live state onto the linked KickAccount. Idempotent — safe under
 * Kick's at-least-once redelivery.
 */
async function handleLivestreamStatus(event: LivestreamStatusEvent) {
  const kickUserId = String(event.broadcaster.user_id);

  await prisma.kickAccount.updateMany({
    where: { kickUserId },
    data: {
      isLive: event.is_live,
      ...(event.is_live ? { lastLiveAt: new Date() } : {}),
    },
  });
}

async function handleFollow(event: ChannelFollowedEvent) {
  console.info(
    `Kick follow: ${event.follower?.username ?? "unknown"} -> broadcaster ${event.broadcaster.user_id}`,
  );
  // Extension point: notify the linked user, update follower-gated features, etc.
}

async function handleSubscription(eventType: string, event: SubscriptionEvent) {
  const count = event.giftees?.length ?? 1;
  console.info(
    `Kick ${eventType}: broadcaster ${event.broadcaster.user_id} (${count} sub${count === 1 ? "" : "s"})`,
  );
  // Extension point: reward subs, surface in dashboard, etc.
}
