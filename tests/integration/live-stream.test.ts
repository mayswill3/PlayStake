// =============================================================================
// Integration Tests: Live-status SSE stream
// =============================================================================
// A live-status change published through Redis must reach every open
// /api/live/stream connection, so pages update without a reload.
// Requires Redis (REDIS_URL, default localhost:6379) as well as Postgres.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { NextRequest } from "next/server";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import { GET } from "../../src/app/api/live/stream/route.js";
import { publishLiveStatusChanged } from "../../src/lib/realtime/live-events.js";

const prisma = getTestPrisma();
let userId: string;
let sessionToken: string;
let previousFlag: string | undefined;

beforeAll(async () => {
  previousFlag = process.env.ENABLE_LOBBY_SSE;
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: { email: `live-stream-${uid}@playstake-test.com`, displayName: `Live ${uid}`, emailVerified: true },
  });
  userId = user.id;
  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: crypto.createHash("sha256").update(sessionToken).digest("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
});

afterAll(async () => {
  if (previousFlag === undefined) delete process.env.ENABLE_LOBBY_SSE;
  else process.env.ENABLE_LOBBY_SSE = previousFlag;
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await disconnectTestPrisma();
});

function streamRequest(options: { authed?: boolean; signal?: AbortSignal } = {}) {
  return new NextRequest("http://localhost/api/live/stream", {
    headers: options.authed === false ? {} : { cookie: `playstake_session=${sessionToken}` },
    signal: options.signal,
  });
}

/** Read from the SSE body until `match` appears, or fail after `timeoutMs`. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  match: string | RegExp,
  timeoutMs = 3000,
): Promise<string> {
  const decoder = new TextDecoder();
  let received = "";
  const deadline = Date.now() + timeoutMs;
  const found = () => (typeof match === "string" ? received.includes(match) : match.test(received));
  while (!found()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`Timed out waiting for "${match}"; got: ${received}`);
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out waiting for "${match}"; got: ${received}`)), remaining),
      ),
    ]);
    if (chunk.done) throw new Error(`Stream ended before "${match}"; got: ${received}`);
    received += decoder.decode(chunk.value, { stream: true });
  }
  return received;
}

describe("GET /api/live/stream", () => {
  it("503s when SSE is disabled, so clients keep polling", async () => {
    delete process.env.ENABLE_LOBBY_SSE;
    const response = await GET(streamRequest());
    expect(response.status).toBe(503);
  });

  it("rejects callers without a session", async () => {
    process.env.ENABLE_LOBBY_SSE = "true";
    const response = await GET(streamRequest({ authed: false }));
    expect(response.status).toBe(401);
  });

  it("delivers a published live-status change to every open stream", async () => {
    process.env.ENABLE_LOBBY_SSE = "true";
    const aborts = [new AbortController(), new AbortController()];
    const responses = await Promise.all(
      aborts.map((abort) => GET(streamRequest({ signal: abort.signal }))),
    );

    try {
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/event-stream");
      }
      const readers = responses.map((response) => response.body!.getReader());
      for (const reader of readers) await readUntil(reader, ": connected");

      await publishLiveStatusChanged();

      for (const reader of readers) {
        const received = await readUntil(reader, /data: (.*)\n\n/);
        const [, data] = received.match(/data: (.*)\n\n/)!;
        expect(JSON.parse(data)).toEqual({ type: "live-status" });
      }
    } finally {
      for (const abort of aborts) abort.abort();
    }
  });
});
