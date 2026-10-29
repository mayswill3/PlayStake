// =============================================================================
// PlayStake — Match voice chat: who may join, rooms, tokens, recordings
// =============================================================================
// One LiveKit room per match ("match-<betId>"), for the two players and the
// match referee only, open from when the match is agreed until the referee
// records the result (or it's cancelled). Each room is created with an
// audio-only recording that LiveKit writes straight to the R2 bucket. When a
// recording finishes, LiveKit calls our webhook: we store it as a VOICE match
// recording, then a worker job fingerprints it and seals the SHA-256 into the
// match's hash-chained audit trail, exactly like the stream recording.
// =============================================================================

import {
  AccessToken,
  EncodedFileOutput,
  EncodedFileType,
  RoomCompositeEgressRequest,
  RoomEgress,
  RoomServiceClient,
  S3Upload,
  TrackSource,
  type WebhookEvent,
} from "livekit-server-sdk";
import {
  BetStatus,
  DisputeStatus,
  MatchRecordingRole,
  MatchRecordingStatus,
  RefereeAssignmentStatus,
} from "../../../generated/prisma/client";
import { prisma, withTransaction } from "../db/client";
import { AuthorizationError, ConflictError, NotFoundError } from "../errors";
import { getQueue } from "../jobs/queue";
import { QUEUE_NAMES } from "../jobs/types";
import { appendRefereeAudit } from "../referees/audit";
import { UNDISPUTED_RETENTION_MS, r2Config } from "../recordings/config";
import { sha256Of } from "../recordings/storage";
import {
  VOICE_ROOM_DEPARTURE_TIMEOUT_S,
  VOICE_TOKEN_TTL,
  betIdFromRoom,
  isVoiceEnabled,
  liveKitConfig,
  voiceRoomName,
} from "./config";

export type VoiceRole = "PLAYER_A" | "PLAYER_B" | "REFEREE";

const LIVE_ASSIGNMENT: RefereeAssignmentStatus[] = [
  RefereeAssignmentStatus.ASSIGNED,
  RefereeAssignmentStatus.READY,
  RefereeAssignmentStatus.IN_PROGRESS,
];
const OPEN_DISPUTES: DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

async function loadMatch(betId: string) {
  return prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      status: true,
      playerAId: true,
      playerBId: true,
      refereeAssignment: { select: { id: true, status: true, refereeProfile: { select: { userId: true } } } },
    },
  });
}
type Match = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

/** Voice is open while the match is agreed and the result isn't in yet. */
function isMatchLive(match: Match): boolean {
  if (match.status !== BetStatus.MATCHED) return false;
  const assignment = match.refereeAssignment;
  return !assignment || assignment.status === RefereeAssignmentStatus.OPEN || LIVE_ASSIGNMENT.includes(assignment.status);
}

function roleOf(match: Match, userId: string): VoiceRole | null {
  if (match.playerAId === userId) return "PLAYER_A";
  if (match.playerBId === userId) return "PLAYER_B";
  const assignment = match.refereeAssignment;
  if (assignment?.refereeProfile?.userId === userId && LIVE_ASSIGNMENT.includes(assignment.status)) return "REFEREE";
  return null;
}

/** Whether voice is available to this user for this match (for the page). */
export async function getVoiceAvailability(userId: string, betId: string) {
  if (!isVoiceEnabled()) return { available: false as const, reason: "Voice chat isn't switched on." };
  const match = await loadMatch(betId);
  if (!match) throw new NotFoundError("Match not found");
  const role = roleOf(match, userId);
  if (!role) return { available: false as const, reason: "Only the players and the referee can join this match's voice chat." };
  if (!isMatchLive(match)) return { available: false as const, reason: "Voice chat is open while the match is being played." };
  return { available: true as const, role, recorded: r2Config() !== null };
}

function roomService(): RoomServiceClient {
  const config = liveKitConfig();
  if (!config) throw new ConflictError("Voice chat isn't configured");
  return new RoomServiceClient(config.apiUrl, config.apiKey, config.apiSecret);
}

/** The room's audio-only recording, written by LiveKit straight to R2. */
function recordingEgress(betId: string): RoomEgress | undefined {
  const r2 = r2Config();
  if (!r2) return undefined;
  return new RoomEgress({
    room: new RoomCompositeEgressRequest({
      roomName: voiceRoomName(betId),
      audioOnly: true,
      fileOutputs: [
        new EncodedFileOutput({
          fileType: EncodedFileType.OGG,
          filepath: `matches/${betId}/voice-{time}.ogg`,
          output: {
            case: "s3",
            value: new S3Upload({
              accessKey: r2.accessKeyId,
              secret: r2.secretAccessKey,
              region: "auto",
              endpoint: r2.endpoint ?? `https://${r2.accountId}.r2.cloudflarestorage.com`,
              bucket: r2.bucket,
              forcePathStyle: true,
            }),
          },
        }),
      ],
    }),
  });
}

/**
 * A token to join this match's voice room. Creates the room (with its
 * recording) on first use. Only the players and the match referee, only while
 * the match is live; microphone only.
 */
export async function issueVoiceToken(userId: string, betId: string) {
  const availability = await getVoiceAvailability(userId, betId);
  if (!availability.available) throw new AuthorizationError(availability.reason);
  const config = liveKitConfig()!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });

  const room = voiceRoomName(betId);
  // Idempotent: an existing room is returned unchanged, keeping one recording.
  await roomService().createRoom({
    name: room,
    emptyTimeout: 10 * 60,
    departureTimeout: VOICE_ROOM_DEPARTURE_TIMEOUT_S,
    maxParticipants: 3,
    egress: recordingEgress(betId),
  });

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: userId,
    name: user.displayName,
    ttl: VOICE_TOKEN_TTL,
    metadata: JSON.stringify({ role: availability.role }),
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canPublishSources: [TrackSource.MICROPHONE],
  });
  return { serverUrl: config.url, token: await token.toJwt(), room, role: availability.role, recorded: availability.recorded };
}

/** Close voice rooms whose match is over. Run every minute by the worker. */
export async function closeFinishedVoiceRooms(): Promise<number> {
  if (!liveKitConfig()) return 0;
  const service = roomService();
  const rooms = await service.listRooms();
  let closed = 0;
  for (const room of rooms) {
    const betId = betIdFromRoom(room.name);
    if (!betId) continue;
    const match = await loadMatch(betId);
    if (match && isMatchLive(match)) continue;
    await service.deleteRoom(room.name);
    closed++;
  }
  return closed;
}

const nsToMs = (value: bigint | undefined) => (value ? Number(value / 1_000_000n) : 0);

export interface SealVoicePayload {
  recordingId: string;
}

/**
 * LiveKit webhook: when a voice recording finishes, store it as a VOICE match
 * recording and queue it to be fingerprinted and sealed.
 */
export async function handleLiveKitEvent(event: WebhookEvent): Promise<string[]> {
  if (event.event !== "egress_ended" || !event.egressInfo) return [];
  const betId = betIdFromRoom(event.egressInfo.roomName);
  if (!betId) return [];
  const bet = await prisma.bet.findUnique({ where: { id: betId }, select: { playerAId: true } });
  if (!bet) return [];

  const disputed = await prisma.dispute.count({ where: { betId, status: { in: OPEN_DISPUTES } } });
  const created: string[] = [];
  for (const file of event.egressInfo.fileResults) {
    const existing = await prisma.matchRecording.findFirst({ where: { betId, storageKey: file.filename }, select: { id: true } });
    if (existing) continue; // webhook retried
    const segment = await prisma.matchRecording.count({ where: { betId, role: MatchRecordingRole.VOICE } });
    const endedAt = new Date(nsToMs(file.endedAt) || Date.now());
    const ok = Number(file.size) > 0 && !event.egressInfo.error;
    const recording = await prisma.matchRecording.create({
      data: {
        betId,
        userId: bet.playerAId,
        role: MatchRecordingRole.VOICE,
        segment,
        channelSlug: "voice",
        status: ok ? MatchRecordingStatus.READY : MatchRecordingStatus.FAILED,
        storageKey: ok ? file.filename : null,
        startedAt: new Date(nsToMs(file.startedAt) || Date.now()),
        endedAt,
        durationSeconds: Math.round(nsToMs(file.duration) / 1000),
        byteSize: file.size,
        failureReason: ok ? null : (event.egressInfo.error || "Empty recording").slice(0, 500),
        retainUntil: disputed ? null : new Date(endedAt.getTime() + UNDISPUTED_RETENTION_MS),
      },
      select: { id: true, status: true },
    });
    created.push(recording.id);
    if (recording.status === MatchRecordingStatus.READY) {
      await getQueue<SealVoicePayload>(QUEUE_NAMES.RECORDING_RETENTION).add(
        "seal-voice",
        { recordingId: recording.id },
        { jobId: `seal-voice-${recording.id}` },
      );
    }
  }
  return created;
}

/** Fingerprint a voice recording and seal it into the audit trail. */
export async function sealVoiceRecording(recordingId: string): Promise<void> {
  const recording = await prisma.matchRecording.findUnique({
    where: { id: recordingId },
    select: { id: true, betId: true, storageKey: true, sha256: true, durationSeconds: true },
  });
  if (!recording?.storageKey || recording.sha256) return;
  const { sha256, byteSize } = await sha256Of(recording.storageKey);
  await withTransaction(async (tx) => {
    await tx.matchRecording.update({ where: { id: recording.id }, data: { sha256, byteSize: BigInt(byteSize) } });
    const assignment = await tx.refereeAssignment.findUnique({ where: { betId: recording.betId }, select: { id: true } });
    if (assignment) {
      await appendRefereeAudit(tx, {
        assignmentId: assignment.id,
        action: "RECORDING_SEALED",
        details: { recordingId: recording.id, kind: "voice", sha256, byteSize, durationSeconds: recording.durationSeconds },
      });
    }
  });
}
