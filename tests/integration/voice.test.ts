// =============================================================================
// Integration Tests: match voice chat (LiveKit)
// =============================================================================
// Who may join, the room and its recording, closing rooms when the match is
// over, and storing + sealing voice recordings. LiveKit's room API and our
// object storage are mocked; tokens are real so their grants can be checked.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { callApi, createTestSession, disconnectTestPrisma, getTestPrisma, purgeComplianceRecords } from "./helpers.js";
import { BetStatus, RefereeAssignmentStatus, RefereeProfileStatus } from "../../generated/prisma/client.js";

process.env.VOICE_CHAT_ENABLED = "true";
process.env.LIVEKIT_URL = "wss://playstake-test.livekit.cloud";
process.env.LIVEKIT_API_KEY = "APItestkey";
process.env.LIVEKIT_API_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
process.env.R2_ACCOUNT_ID = "acct";
process.env.R2_ACCESS_KEY_ID = "key";
process.env.R2_SECRET_ACCESS_KEY = "secret";
process.env.R2_BUCKET = "playstake-recordings";

const rooms = vi.hoisted(() => ({ created: [] as Array<Record<string, unknown>>, live: [] as string[], deleted: [] as string[] }));
vi.mock("livekit-server-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("livekit-server-sdk")>();
  class RoomServiceClient {
    async createRoom(options: Record<string, unknown>) {
      rooms.created.push(options);
      return { name: options.name };
    }
    async listRooms() {
      return rooms.live.map((name) => ({ name }));
    }
    async deleteRoom(name: string) {
      rooms.deleted.push(name);
    }
  }
  return { ...actual, RoomServiceClient };
});
const queued = vi.hoisted(() => [] as Array<{ name: string; data: unknown }>);
vi.mock("../../src/lib/jobs/queue.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/jobs/queue.js")>();
  return { ...actual, getQueue: () => ({ add: async (name: string, data: unknown) => queued.push({ name, data }) }) };
});
vi.mock("../../src/lib/recordings/storage.js", () => ({
  sha256Of: vi.fn(async () => ({ sha256: "b".repeat(64), byteSize: 4321 })),
  uploadFile: vi.fn(),
  deletePrefix: vi.fn(),
  playbackUrl: vi.fn(),
  contentTypeFor: vi.fn(() => "audio/ogg"),
}));

const { getVoiceAvailability, issueVoiceToken, closeFinishedVoiceRooms, handleLiveKitEvent, sealVoiceRecording } =
  await import("../../src/lib/voice/service.js");
const { TokenVerifier } = await import("livekit-server-sdk");

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const dev = await prisma.user.upsert({
    where: { email: "voice-test-dev@playstake-test.com" },
    update: {},
    create: { email: "voice-test-dev@playstake-test.com", role: "DEVELOPER", displayName: "Voice Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: dev.id },
    update: {},
    create: { userId: dev.id, companyName: "Voice Co", contactEmail: "voice-test-dev@playstake-test.com" },
  });
  gameId = (
    await prisma.game.upsert({
      where: { slug: "voice-test-game" },
      update: {},
      create: { developerProfileId: profile.id, name: "Voice Game", slug: "voice-test-game", platformFeePercent: new Decimal("0.05") },
    })
  ).id;
});

beforeEach(() => {
  rooms.created.length = 0;
  rooms.live.length = 0;
  rooms.deleted.length = 0;
  queued.length = 0;
});

afterAll(async () => {
  const userIds = (await prisma.user.findMany({ where: { email: { contains: "voice-test-" } }, select: { id: true } })).map((u) => u.id);
  const betIds = (await prisma.bet.findMany({ where: { gameId }, select: { id: true } })).map((b) => b.id);
  await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" DISABLE TRIGGER "referee_audit_events_immutable"');
  try {
    await prisma.refereeAuditEvent.deleteMany({ where: { assignment: { betId: { in: betIds } } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "referee_audit_events" ENABLE TRIGGER "referee_audit_events_immutable"');
  }
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

async function makeUser(name: string) {
  const user = await prisma.user.create({
    data: { email: `voice-test-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`, displayName: name, emailVerified: true },
  });
  const { sessionToken } = await createTestSession(prisma as never, user.id);
  return { ...user, token: sessionToken };
}

async function liveMatch(assignmentStatus: RefereeAssignmentStatus = RefereeAssignmentStatus.IN_PROGRESS) {
  const playerA = await makeUser("Voice A");
  const playerB = await makeUser("Voice B");
  const referee = await makeUser("Voice Ref");
  const profile = await prisma.refereeProfile.create({ data: { userId: referee.id, status: RefereeProfileStatus.APPROVED, approvedAt: new Date() } });
  const bet = await prisma.bet.create({
    data: {
      gameId, playerAId: playerA.id, playerBId: playerB.id, amount: new Decimal("5.00"), status: BetStatus.MATCHED,
      platformFeePercent: new Decimal("0.05"), expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const assignment = await prisma.refereeAssignment.create({
    data: { betId: bet.id, refereeProfileId: profile.id, status: assignmentStatus, startedAt: new Date() },
  });
  return { playerA, playerB, referee, bet, assignment };
}

describe("who can join", () => {
  it("lets the two players and the match referee in, nobody else", async () => {
    const { playerA, playerB, referee, bet } = await liveMatch();
    const outsider = await makeUser("Voice Outsider");
    for (const [user, role] of [[playerA, "PLAYER_A"], [playerB, "PLAYER_B"], [referee, "REFEREE"]] as const) {
      expect(await getVoiceAvailability(user.id, bet.id)).toMatchObject({ available: true, role, recorded: true });
    }
    expect((await getVoiceAvailability(outsider.id, bet.id)).available).toBe(false);
    const refused = await callApi("POST", `/api/bets/${bet.id}/voice`, { sessionToken: outsider.token });
    expect(refused.status).toBe(403);
  });

  it("closes once the result is recorded", async () => {
    const { playerA, bet } = await liveMatch(RefereeAssignmentStatus.DECISION_SUBMITTED);
    expect(await getVoiceAvailability(playerA.id, bet.id)).toMatchObject({ available: false });
  });
});

describe("joining", () => {
  it("gives a microphone-only token for this match's room, which is created with an audio recording", async () => {
    const { playerA, bet } = await liveMatch();
    const res = await callApi("POST", `/api/bets/${bet.id}/voice`, { sessionToken: playerA.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serverUrl: "wss://playstake-test.livekit.cloud", room: `match-${bet.id}`, role: "PLAYER_A" });

    const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(res.body.token);
    expect(claims.sub).toBe(playerA.id);
    expect(claims.video).toMatchObject({ room: `match-${bet.id}`, roomJoin: true, canPublish: true, canPublishData: false });
    expect(claims.video?.roomAdmin).toBeFalsy();

    const created = rooms.created[0] as { name: string; maxParticipants: number; egress: { room: { audioOnly: boolean; fileOutputs: Array<{ filepath: string }> } } };
    expect(created.name).toBe(`match-${bet.id}`);
    expect(created.maxParticipants).toBe(3);
    expect(created.egress.room.audioOnly).toBe(true);
    expect(created.egress.room.fileOutputs[0].filepath).toBe(`matches/${bet.id}/voice-{time}.ogg`);
  });
});

describe("closing rooms", () => {
  it("closes the room of a finished match and leaves live ones open", async () => {
    const live = await liveMatch();
    const finished = await liveMatch(RefereeAssignmentStatus.DECISION_SUBMITTED);
    rooms.live.push(`match-${live.bet.id}`, `match-${finished.bet.id}`, "some-other-room");
    expect(await closeFinishedVoiceRooms()).toBe(1);
    expect(rooms.deleted).toEqual([`match-${finished.bet.id}`]);
  });
});

describe("recordings", () => {
  const egressEnded = (betId: string, filename: string) =>
    ({
      event: "egress_ended",
      egressInfo: {
        roomName: `match-${betId}`,
        error: "",
        fileResults: [
          {
            filename,
            size: 123456n,
            startedAt: BigInt(Date.now() - 600_000) * 1_000_000n,
            endedAt: BigInt(Date.now()) * 1_000_000n,
            duration: 600_000_000_000n,
            location: `https://example/${filename}`,
          },
        ],
      },
    }) as never;

  it("stores a finished voice recording once, keeps it 30 days, and seals its fingerprint", async () => {
    const { bet, assignment } = await liveMatch();
    const filename = `matches/${bet.id}/voice-1.ogg`;
    const [id] = await handleLiveKitEvent(egressEnded(bet.id, filename));
    expect(await handleLiveKitEvent(egressEnded(bet.id, filename))).toEqual([]); // retried webhook

    const recording = await prisma.matchRecording.findUniqueOrThrow({ where: { id } });
    expect(recording).toMatchObject({ role: "VOICE", segment: 0, status: "READY", storageKey: filename, durationSeconds: 600 });
    expect(recording.retainUntil!.getTime() - recording.endedAt!.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(queued).toEqual([{ name: "seal-voice", data: { recordingId: id } }]);

    await sealVoiceRecording(id);
    expect((await prisma.matchRecording.findUniqueOrThrow({ where: { id } })).sha256).toBe("b".repeat(64));
    const sealed = await prisma.refereeAuditEvent.findFirst({ where: { assignmentId: assignment.id, action: "RECORDING_SEALED" } });
    expect(sealed?.details).toMatchObject({ recordingId: id, kind: "voice" });

    // A second part (everyone left and came back) is segment 1.
    const [second] = await handleLiveKitEvent(egressEnded(bet.id, `matches/${bet.id}/voice-2.ogg`));
    expect((await prisma.matchRecording.findUniqueOrThrow({ where: { id: second } })).segment).toBe(1);
  });
});
