import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { getRedisConnection } from "@/lib/jobs/queue";
import { isLobbyGameType } from "@/lib/lobby/games";
import { LobbyChannels } from "@/lib/lobby/pubsub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/lobby/stream?gameType=bullseye
 *
 * Server-Sent Events endpoint. Subscribes to the caller's relevant Redis
 * channels and streams lobby events. Gated behind `ENABLE_LOBBY_SSE=true`
 * — when disabled, clients should fall back to polling /api/lobby/status
 * and /api/lobby/players.
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.ENABLE_LOBBY_SSE !== "true") {
      return new Response("Lobby SSE is disabled. Use polling.", { status: 503 });
    }

    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const gameType = request.nextUrl.searchParams.get("gameType");
    if (!gameType || !isLobbyGameType(gameType)) {
      throw new ValidationError("Valid gameType is required");
    }

    const userId = session.userId;
    const encoder = new TextEncoder();

    const subscriber = getRedisConnection().duplicate();
    const channels = [
      LobbyChannels.game(gameType),
      LobbyChannels.invite(userId),
      LobbyChannels.matched(userId),
      LobbyChannels.inviteDeclined(userId),
      LobbyChannels.inviteExpired(userId),
      LobbyChannels.expired(userId),
    ];

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const cleanup = async () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          try {
            subscriber.removeAllListeners("message");
            await subscriber.unsubscribe(...channels).catch(() => {});
            subscriber.disconnect();
          } catch {
            /* ignore */
          }
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        try {
          await subscriber.subscribe(...channels);
        } catch (err) {
          console.error("[LOBBY_SSE] subscribe failed", err);
          await cleanup();
          return;
        }

        subscriber.on("message", (_channel: string, message: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch {
            void cleanup();
          }
        });

        // Initial comment lets clients know the stream is live
        controller.enqueue(encoder.encode(`: connected\n\n`));

        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            void cleanup();
          }
        }, 30_000);

        request.signal.addEventListener("abort", () => {
          void cleanup();
        });
      },
      cancel() {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        subscriber.removeAllListeners("message");
        subscriber.unsubscribe(...channels).catch(() => {});
        subscriber.disconnect();
      },
    });

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
