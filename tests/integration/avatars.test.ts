// =============================================================================
// Integration Tests: profile photo upload
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import sharp from "sharp";
import {
  callApi,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";

const prisma = getTestPrisma();
const createdUserIds: string[] = [];

let ipCounter = 0;
async function newPlayer() {
  const user = await createTestUser(prisma as unknown as TxClient);
  createdUserIds.push(user.id);
  const { sessionToken } = await createTestSession(prisma as unknown as TxClient, user.id);
  ipCounter += 1;
  return { user, sessionToken, ip: `10.77.0.${ipCounter}` };
}

async function pngFile(width: number, height: number): Promise<File> {
  const bytes = await sharp({
    create: { width, height, channels: 3, background: { r: 95, g: 220, b: 178 } },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(bytes)], "me.png", { type: "image/png" });
}

function upload(file: File, sessionToken: string, ip: string) {
  const formData = new FormData();
  formData.set("avatar", file);
  return callApi("POST", "/api/user/avatar", {
    formData,
    sessionToken,
    headers: { "x-forwarded-for": ip },
  });
}

afterAll(async () => {
  await purgeComplianceRecords(prisma, createdUserIds);
  await disconnectTestPrisma();
});

describe("profile photos", () => {
  it("re-encodes an upload to a 256px WebP and serves it publicly", async () => {
    const { user, sessionToken, ip } = await newPlayer();

    const res = await upload(await pngFile(800, 500), sessionToken, ip);
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(new RegExp(`^/api/avatars/${user.id}\\?v=\\d+$`));

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.avatarUrl).toBe(res.body.avatarUrl);

    const stored = await prisma.userAvatar.findUniqueOrThrow({ where: { userId: user.id } });
    const meta = await sharp(Buffer.from(stored.data)).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 256, height: 256 });

    // No session needed: other players see the photo too.
    const served = await callApi("GET", res.body.avatarUrl);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("rejects files that aren't images", async () => {
    const { user, sessionToken, ip } = await newPlayer();
    const fake = new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.png", {
      type: "image/png",
    });

    const res = await upload(fake, sessionToken, ip);
    expect(res.status).toBe(422);
    expect(await prisma.userAvatar.count({ where: { userId: user.id } })).toBe(0);
  });

  it("needs a signed-in user", async () => {
    const formData = new FormData();
    formData.set("avatar", await pngFile(10, 10));
    const res = await callApi("POST", "/api/user/avatar", { formData });
    expect(res.status).toBe(401);
  });

  it("removes the photo", async () => {
    const { user, sessionToken, ip } = await newPlayer();
    await upload(await pngFile(300, 300), sessionToken, ip);

    const res = await callApi("DELETE", "/api/user/avatar", { sessionToken });
    expect(res.status).toBe(200);

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.avatarUrl).toBeNull();
    expect((await callApi("GET", `/api/avatars/${user.id}`)).status).toBe(404);
  });
});
