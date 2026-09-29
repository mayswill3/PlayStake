import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors/index";
import { LIVE_STATUS_CHANNEL } from "@/lib/realtime/live-events";
import { subscribeChannel } from "@/lib/realtime/subscriber";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

/**
 * GET /api/live/stream
 *
 * Server-Sent Events: a nudge whenever someone's live state changes, so open
 * pages refetch instead of waiting for their next poll. Shares the
 * `ENABLE_LOBBY_SSE` switch with the lobby stream; when it's off (or Redis is
 * unreachable) this 503s and clients keep polling.
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.ENABLE_LOBBY_SSE !== "true") {
      return new Response("Live SSE is disabled. Use polling.", { status: 503 });
    }

    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    let closed = false;

    const send = (chunk: string) => {
      if (closed || !controller) return;
      try {
        controller.enqueue(encoder.encode(chunk));
      } catch {
        cleanup();
      }
    };

    let unsubscribe: () => void;
    try {
      unsubscribe = await subscribeChannel(LIVE_STATUS_CHANNEL, (message) =>
        send(`data: ${message}\n\n`),
      );
    } catch (err) {
      console.error("[LIVE_SSE] subscribe failed", err);
      return new Response("Live SSE is unavailable. Use polling.", { status: 503 });
    }

    const heartbeat = setInterval(() => send(`: heartbeat\n\n`), HEARTBEAT_MS);

    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      try {
        controller?.close();
      } catch {
        /* already closed */
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        // Initial comment lets clients know the stream is live.
        send(`: connected\n\n`);
      },
      cancel() {
        cleanup();
      },
    });

    request.signal.addEventListener("abort", cleanup);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
