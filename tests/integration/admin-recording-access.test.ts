// =============================================================================
// Integration Tests: admin access to match recordings
// =============================================================================

import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { callApi, createTestSession, disconnectTestPrisma, getTestPrisma, purgeComplianceRecords } from "./helpers.js";
import { BetStatus, MatchRecordingRole, MatchRecordingStatus, RefereeAssignmentStatus, RefereeProfileStatus } from "../../generated/prisma/client.js";

vi.mock("../../src/lib/recordings/storage.js", () => ({
  playbackUrl: vi.fn(async (key: string) => `https://r2.example/${key}?signed`),
  deletePrefix: vi.fn(async () => 1),
  uploadFile: vi.fn(),
  sha256Of: vi.fn(),
  contentTypeFor: vi.fn(() => "video/mp4"),
}));
process.env.R2_ACCOUNT_ID = "acct";
process.env.R2_ACCESS_KEY_ID = "key";
process.env.R2_SECRET_ACCESS_KEY = "secret";
process.env.R2_BUCKET = "bucket";
const { deleteExpiredRecordings } = await import("../../src/lib/recordings/service.js");

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const dev = await prisma.user.upsert({
    where: { email: "rec-access-dev@playstake-test.com" },
    update: {},
    create: { email: "rec-access-dev@playstake-test.com", role: "DEVELOPER", displayName: "Rec Access Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: dev.id },
    update: {},
    create: { userId: dev.id, companyName: "Rec Access Co", contactEmail: "rec-access-dev@playstake-test.com" },
  });
  gameId = (
    await prisma.game.upsert({
      where: { slug: "rec-access-game" },
      update: {},
      create: { developerProfileId: profile.id, name: "Rec Access Game", slug: "rec-access-game", platformFeePercent: new Decimal("0.05") },
    })
  ).id;
});

afterAll(async () => {
  const userIds = (await prisma.user.findMany({ where: { email: { contains: "rec-access-" } }, select: { id: true } })).map((u) => u.id);
  const betIds = (await prisma.bet.findMany({ where: { gameId }, select: { id: true } })).map((b) => b.id);
  await prisma.matchRecording.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await purgeComplianceRecords(prisma, userIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeUser(name: string, role = "PLAYER") {
  const user = await prisma.user.create({
    data: { email: `rec-access-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`, displayName: name, role: role as never, emailVerified: true },
  });
  return { ...user, token: (await createTestSession(prisma as never, user.id)).sessionToken };
}

async function recordedMatch(playerA?: { id: string }) {
  const a = playerA ?? (await makeUser("Rec Access A"));
  const b = await makeUser("Rec Access B");
  const referee = await makeUser("Rec Access Ref");
  const profile = await prisma.refereeProfile.create({ data: { userId: referee.id, status: RefereeProfileStatus.APPROVED, approvedAt: new Date() } });
  const bet = await prisma.bet.create({
    data: { gameId, playerAId: a.id, playerBId: b.id, amount: new Decimal("5.00"), status: BetStatus.SETTLED, platformFeePercent: new Decimal("0.05"), expiresAt: new Date() },
  });
  await prisma.refereeAssignment.create({
    data: { betId: bet.id, refereeProfileId: profile.id, status: RefereeAssignmentStatus.COMPLETED, startedAt: new Date(Date.now() - 3_600_000) },
  });
  const endedAt = new Date(Date.now() - 10 * 24 * 3_600_000);
  const video = await prisma.matchRecording.create({
    data: {
      betId: bet.id, userId: a.id, role: MatchRecordingRole.COMPOSITE, channelSlug: "composite", status: MatchRecordingStatus.READY,
      storageKey: `matches/${bet.id}/recording.mp4`, startedAt: new Date(endedAt.getTime() - 1_800_000), endedAt,
      retainUntil: new Date(endedAt.getTime() + 30 * 24 * 3_600_000),
    },
  });
  return { bet, video, referee };
}

describe("Admin access to match recordings", () => {
  it("is for admins only, needs a reason and note, and logs each viewing", async () => {
    const { bet, video } = await recordedMatch();
    const admin = await makeUser("Rec Access Admin", "ADMIN");
    const player = await makeUser("Rec Access Player");
    const path = `/api/admin/matches/${bet.id}/recordings/${video.id}`;

    expect((await callApi("POST", path, { sessionToken: player.token, body: { reason: "COMPLAINT", note: "Case 12" } })).status).toBe(403);
    expect((await callApi("POST", path, { sessionToken: admin.token, body: {} })).status).toBe(422);
    expect((await callApi("POST", path, { sessionToken: admin.token, body: { reason: "BROWSING", note: "just looking" } })).status).toBe(422);

    const ok = await callApi("POST", path, { sessionToken: admin.token, body: { reason: "CHEATING_OR_FIXING", note: "Anomaly alert 42" } });
    expect(ok.status).toBe(200);
    expect(ok.body.url).toContain(`matches/${bet.id}/recording.mp4`);
    const log = await prisma.adminAuditLog.findFirst({ where: { actorId: admin.id, action: "recording.view", targetId: video.id } });
    expect(log?.details).toMatchObject({ via: "admin", reason: "CHEATING_OR_FIXING", note: "Anomaly alert 42", betId: bet.id });

    const access = await callApi("GET", "/api/admin/recording-access", { sessionToken: admin.token });
    expect(access.body.entries.some((e: { targetId: string }) => e.targetId === video.id)).toBe(true);

    const list = await callApi("GET", "/api/admin/matches?search=Rec%20Access%20A", { sessionToken: admin.token });
    expect(list.body.matches.some((m: { id: string; recordings: number }) => m.id === bet.id && m.recordings === 1)).toBe(true);
  });

  it("refuses an admin who played in or refereed the match", async () => {
    const admin = await makeUser("Rec Access Playing Admin", "ADMIN");
    const { bet, video } = await recordedMatch(admin);
    const detail = await callApi("GET", `/api/admin/matches/${bet.id}`, { sessionToken: admin.token });
    expect(detail.body.match.conflict).toMatch(/played in or refereed/);
    const res = await callApi("POST", `/api/admin/matches/${bet.id}/recordings/${video.id}`, {
      sessionToken: admin.token,
      body: { reason: "COMPLAINT", note: "My own match" },
    });
    expect(res.status).toBe(403);
  });

  it("holds recordings past their deletion date, and releasing restores normal retention", async () => {
    const { bet, video } = await recordedMatch();
    const admin = await makeUser("Rec Access Hold Admin", "ADMIN");
    const held = await callApi("POST", `/api/admin/matches/${bet.id}/hold`, { sessionToken: admin.token, body: { hold: true, reason: "AML case 7" } });
    expect(held.status).toBe(200);

    // Even with an expired date, a held recording isn't deleted.
    await prisma.matchRecording.update({ where: { id: video.id }, data: { retainUntil: new Date(Date.now() - 1000) } });
    await deleteExpiredRecordings();
    const kept = await prisma.matchRecording.findUniqueOrThrow({ where: { id: video.id } });
    expect(kept.status).toBe(MatchRecordingStatus.READY);
    expect(kept.heldReason).toBe("AML case 7");

    const released = await callApi("POST", `/api/admin/matches/${bet.id}/hold`, { sessionToken: admin.token, body: { hold: false, reason: "Case closed" } });
    expect(released.status).toBe(200);
    const after = await prisma.matchRecording.findUniqueOrThrow({ where: { id: video.id } });
    expect(after.heldAt).toBeNull();
    // 30 days after the match, or at least a day from now.
    expect(after.retainUntil!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(await prisma.adminAuditLog.count({ where: { actorId: admin.id, action: { in: ["recording.hold", "recording.release"] } } })).toBe(2);
  });
});
