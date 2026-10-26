// =============================================================================
// Integration Tests: PlayStake match recordings
// =============================================================================
// The recorder captures every refereed match into one sealed video. These
// cover what the app controls: who can open the recording view, sealing into
// the audit trail, retention (30 days undisputed, held while disputed, 12
// months after a decision) and who can watch.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { callApi, createTestSession, disconnectTestPrisma, getTestPrisma, purgeComplianceRecords } from "./helpers.js";
import { BetOutcome, BetStatus, MatchRecordingStatus, RefereeAssignmentStatus, RefereeProfileStatus } from "../../generated/prisma/client.js";

vi.mock("../../src/lib/recordings/storage.js", () => ({
  uploadFile: vi.fn(async () => 0),
  deletePrefix: vi.fn(async () => 1),
  playbackUrl: vi.fn(async (key: string) => `https://r2.example/${key}?signed`),
}));

process.env.RECORDER_SECRET = "test-recorder-secret";
const { signRecorderToken, verifyRecorderToken } = await import("../../src/lib/recordings/token.js");
const { beginRecording, sealRecording, deleteExpiredRecordings, shouldStopRecording } = await import("../../src/lib/recordings/service.js");
const { UNDISPUTED_RETENTION_MS } = await import("../../src/lib/recordings/config.js");

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const dev = await prisma.user.upsert({
    where: { email: "match-rec-dev@playstake-test.com" },
    update: {},
    create: { email: "match-rec-dev@playstake-test.com", role: "DEVELOPER", displayName: "Rec Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: dev.id },
    update: {},
    create: { userId: dev.id, companyName: "Rec Co", contactEmail: "match-rec-dev@playstake-test.com" },
  });
  const game = await prisma.game.upsert({
    where: { slug: "match-rec-game" },
    update: {},
    create: { developerProfileId: profile.id, name: "Rec Game", slug: "match-rec-game", platformFeePercent: new Decimal("0.05") },
  });
  gameId = game.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: "match-rec-" } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const betIds = (await prisma.bet.findMany({ where: { gameId }, select: { id: true } })).map((bet) => bet.id);
  await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" DISABLE TRIGGER "referee_audit_events_immutable"');
  try {
    await prisma.refereeAuditEvent.deleteMany({ where: { assignment: { betId: { in: betIds } } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" ENABLE TRIGGER "referee_audit_events_immutable"');
  }
  await prisma.matchRecording.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.dispute.deleteMany({ where: { betId: { in: betIds } } });
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
    data: { email: `match-rec-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`, displayName: name, role: role as never, emailVerified: true },
  });
  const { sessionToken } = await createTestSession(prisma as never, user.id);
  return { ...user, token: sessionToken };
}

async function matchInProgress() {
  const playerA = await makeUser("Rec A");
  const playerB = await makeUser("Rec B");
  const referee = await makeUser("Rec Referee");
  const profile = await prisma.refereeProfile.create({
    data: { userId: referee.id, status: RefereeProfileStatus.APPROVED, approvedAt: new Date() },
  });
  const bet = await prisma.bet.create({
    data: {
      gameId,
      playerAId: playerA.id,
      playerBId: playerB.id,
      amount: new Decimal("5.00"),
      status: BetStatus.MATCHED,
      platformFeePercent: new Decimal("0.05"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const assignment = await prisma.refereeAssignment.create({
    data: { betId: bet.id, refereeProfileId: profile.id, status: RefereeAssignmentStatus.IN_PROGRESS, startedAt: new Date() },
  });
  return { playerA, playerB, referee, bet, assignment };
}

const seal = (betId: string) =>
  sealRecording({ betId, key: `matches/${betId}/recording.mp4`, byteSize: 1000, durationSeconds: 600, sha256: "a".repeat(64) });

describe("the recording view", () => {
  it("opens only with a valid, unexpired token for that match", async () => {
    const { bet } = await matchInProgress();
    const token = signRecorderToken(bet.id, 60_000);
    expect(verifyRecorderToken(bet.id, token)).toBe(true);
    expect(verifyRecorderToken(crypto.randomUUID(), token)).toBe(false);
    expect(verifyRecorderToken(bet.id, signRecorderToken(bet.id, -1000))).toBe(false);
    expect(verifyRecorderToken(bet.id, `${token}x`)).toBe(false);

    const { GET } = await import("../../src/app/api/recorder/[betId]/route.js");
    const call = (query: string) =>
      GET(new Request(`http://localhost/api/recorder/${bet.id}${query}`) as never, { params: Promise.resolve({ betId: bet.id }) });
    expect((await call("")).status).toBe(403);
    const ok = await call(`?token=${encodeURIComponent(token)}`);
    expect(ok.status).toBe(200);
    const view = await ok.json();
    expect(view.streams.playerA.name).toBe("Rec A");
    expect(view.status).toBe("IN_PROGRESS");
  });
});

describe("recording lifecycle", () => {
  it("keeps recording while the match is live and stops once the result is in", async () => {
    const { bet, assignment } = await matchInProgress();
    const recording = await beginRecording(bet.id);
    expect(recording.status).toBe(MatchRecordingStatus.RECORDING);
    expect(await shouldStopRecording(bet.id, recording.startedAt)).toBe(false);
    expect(await shouldStopRecording(bet.id, new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe(true);
    await prisma.refereeAssignment.update({ where: { id: assignment.id }, data: { status: RefereeAssignmentStatus.DECISION_SUBMITTED } });
    expect(await shouldStopRecording(bet.id, recording.startedAt)).toBe(true);
  });

  it("seals the recording into the audit trail and keeps it 30 days", async () => {
    const { bet, assignment } = await matchInProgress();
    await beginRecording(bet.id);
    const sealed = await seal(bet.id);
    expect(sealed.status).toBe(MatchRecordingStatus.READY);
    expect(sealed.retainUntil!.getTime() - sealed.endedAt!.getTime()).toBe(UNDISPUTED_RETENTION_MS);
    const event = await prisma.refereeAuditEvent.findFirst({ where: { assignmentId: assignment.id, action: "RECORDING_SEALED" } });
    expect(event?.details).toMatchObject({ sha256: "a".repeat(64), recordingId: sealed.id });
  });

  it("is held while disputed, kept 12 months after the decision, then deleted", async () => {
    const { bet, assignment, playerB } = await matchInProgress();
    await beginRecording(bet.id);
    await seal(bet.id);
    await prisma.refereeAssignment.update({
      where: { id: assignment.id },
      data: { status: RefereeAssignmentStatus.DECISION_SUBMITTED, decision: BetOutcome.PLAYER_A_WIN, decisionSubmittedAt: new Date() },
    });
    await prisma.bet.update({ where: { id: bet.id }, data: { status: BetStatus.RESULT_REPORTED, outcome: BetOutcome.PLAYER_A_WIN, resultReportedAt: new Date() } });

    const filed = await callApi("POST", `/api/bets/${bet.id}/dispute`, {
      sessionToken: playerB.token,
      body: { reason: "The winning goal was offside at 87:40." },
    });
    expect(filed.status).toBe(201);
    const held = await prisma.matchRecording.findFirstOrThrow({ where: { betId: bet.id } });
    expect(held.retainUntil).toBeNull();
    // Nothing is deleted while the dispute is open, however old.
    await prisma.matchRecording.update({ where: { id: held.id }, data: { retainUntil: new Date(Date.now() - 1000) } });
    await deleteExpiredRecordings();
    expect((await prisma.matchRecording.findUniqueOrThrow({ where: { id: held.id } })).status).toBe(MatchRecordingStatus.READY);

    const admin = await makeUser("Rec Admin", "ADMIN");
    const dispute = await prisma.dispute.findFirstOrThrow({ where: { betId: bet.id } });
    const decided = await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: admin.token,
      body: { status: "RESOLVED_PLAYER_A", resolution: "Onside on the recording at 87:40." },
    });
    expect(decided.status).toBe(200);
    const kept = await prisma.matchRecording.findUniqueOrThrow({ where: { id: held.id } });
    expect(kept.retainUntil!.getTime()).toBeGreaterThan(Date.now() + 360 * 24 * 60 * 60 * 1000);

    await prisma.matchRecording.update({ where: { id: held.id }, data: { retainUntil: new Date(Date.now() - 1000) } });
    expect(await deleteExpiredRecordings()).toBeGreaterThanOrEqual(1);
    const gone = await prisma.matchRecording.findUniqueOrThrow({ where: { id: held.id } });
    expect(gone.status).toBe(MatchRecordingStatus.DELETED);
    expect(gone.storageKey).toBeNull();
  });
});

describe("watching a recording", () => {
  it("is for admins and independent reviewers only, and every viewing is logged", async () => {
    const { bet, assignment, playerB, referee } = await matchInProgress();
    await beginRecording(bet.id);
    const recording = await seal(bet.id);
    await prisma.refereeAssignment.update({ where: { id: assignment.id }, data: { status: RefereeAssignmentStatus.DISPUTED, decision: BetOutcome.PLAYER_A_WIN } });
    await prisma.bet.update({ where: { id: bet.id }, data: { status: BetStatus.DISPUTED } });
    const dispute = await prisma.dispute.create({ data: { betId: bet.id, filedById: playerB.id, reason: "Offside winner, please check." } });
    const path = `/api/referees/disputes/${dispute.id}/recordings/${recording.id}`;

    for (const user of [playerB, referee]) {
      expect((await callApi("GET", path, { sessionToken: user.token })).status).toBe(403);
    }
    const admin = await makeUser("Rec Admin 2", "ADMIN");
    const res = await callApi("GET", path, { sessionToken: admin.token });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain(`matches/${bet.id}/recording.mp4`);
    const log = await prisma.adminAuditLog.findFirst({ where: { actorId: admin.id, action: "recording.view", targetId: recording.id } });
    expect(log).not.toBeNull();
  });
});
