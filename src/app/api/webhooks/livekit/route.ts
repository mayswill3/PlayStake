import { WebhookReceiver } from "livekit-server-sdk";
import { liveKitConfig } from "@/lib/voice/config";
import { handleLiveKitEvent } from "@/lib/voice/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/livekit — LiveKit events, signed with our API secret.
 * We act on finished recordings of match voice rooms.
 */
export async function POST(request: Request) {
  const config = liveKitConfig();
  if (!config) return Response.json({ error: "Voice chat isn't configured" }, { status: 404 });
  const body = await request.text();
  let event;
  try {
    event = await new WebhookReceiver(config.apiKey, config.apiSecret).receive(body, request.headers.get("authorization") ?? undefined);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const created = await handleLiveKitEvent(event);
    return Response.json({ ok: true, recordings: created.length });
  } catch (error) {
    console.error("[LiveKit] webhook handling failed", error);
    return Response.json({ error: "Could not process the event" }, { status: 500 });
  }
}
