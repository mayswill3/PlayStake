import { applyDiditDecision } from "@/lib/kyc/didit-decisions";
import { getDiditDecision, verifyDiditWebhook } from "@/lib/kyc/didit";

const SESSION_EVENTS = new Set(["status.updated", "data.updated"]);

/**
 * POST /api/webhooks/didit — Didit's signed notifications. The signature and
 * timestamp are checked, then the decision is re-read from Didit's API with
 * our key, so the body of the webhook is never trusted on its own.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifyDiditWebhook(rawBody, {
    signature: request.headers.get("x-signature"),
    signatureV2: request.headers.get("x-signature-v2"),
    timestamp: request.headers.get("x-timestamp"),
  });
  if (!verified) return Response.json({ error: "Invalid signature" }, { status: 401 });

  let event: { webhook_type?: string; session_id?: string; status?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.session_id || !SESSION_EVENTS.has(event.webhook_type ?? "")) {
    return Response.json({ received: true, handled: false });
  }

  try {
    const outcome = await applyDiditDecision(await getDiditDecision(event.session_id));
    return Response.json({ received: true, outcome });
  } catch (error) {
    // A 5xx makes Didit retry (twice, over about five minutes).
    console.error("[KYC] Didit webhook could not be processed:", error);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
