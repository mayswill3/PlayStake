// =============================================================================
// PlayStake — Match recordings: lifecycle, the recording view, retention
// =============================================================================
// When a referee starts a match, a job asks the recorder service to record
// it. The recorder opens the recording view, captures it in 5-minute
// segments uploaded as it goes, stops when the referee records the result (or
// the match ends another way), joins the segments into one file and seals it:
// the file's SHA-256 goes into the match's hash-chained audit trail, so anyone
// can later show the recording hasn't been changed.
//
// Undisputed recordings are deleted 30 days after the match. A dispute keeps
// them until it's decided, then for 12 months (complaints and IBAS).
// =============================================================================

import {
  DisputeStatus,
  MatchRecordingRole,
  MatchRecordingStatus,
  RefereeAssignmentStatus,
} from "../../../generated/prisma/client";
import { prisma, withTransaction } from "../db/client";
import { NotFoundError } from "../errors";
import { getQueue } from "../jobs/queue";
import { QUEUE_NAMES } from "../jobs/types";
import { recordAdminAction } from "../admin/audit";
import { appendRefereeAudit } from "../referees/audit";
import { getDisputeEvidence } from "../disputes/review";
import { RECORDING_MAX_MS, UNDISPUTED_RETENTION_MS, isRecordingEnabled, recordingKey } from "./config";
import { deletePrefix, playbackUrl } from "./storage";

export interface RecordMatchPayload {
  betId: string;
}

const OPEN_DISPUTES = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

/** Ask the recorder to record this match. Safe to call twice. Never throws. */
export async function queueMatchRecording(betId: string): Promise<void> {
  if (!isRecordingEnabled()) return;
  try {
    await getQueue<RecordMatchPayload>(QUEUE_NAMES.MATCH_RECORDING).add(
      "record-match",
      { betId },
      { jobId: `record-${betId}`, attempts: 1, removeOnComplete: true },
    );
  } catch (error) {
    console.error("[Recording] could not queue the recording job", { betId, error });
  }
}

/** What the recording view shows: the three streams and a live events panel. */
export async function getRecorderView(betId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      amount: true,
      game: { select: { name: true } },
      playerA: { select: { displayName: true, kickAccount: { select: { channelSlug: true } } } },
      playerB: { select: { displayName: true, kickAccount: { select: { channelSlug: true } } } },
      refereeAssignment: {
        select: {
          status: true,
          startedAt: true,
          refereeProfile: { select: { user: { select: { displayName: true, kickAccount: { select: { channelSlug: true } } } } } },
          auditEvents: { select: { action: true, createdAt: true }, orderBy: { sequence: "asc" } },
        },
      },
      chatMessages: {
        where: { deletedAt: null },
        select: { body: true, createdAt: true, user: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
  if (!bet?.refereeAssignment) throw new NotFoundError("Match not found");
  const assignment = bet.refereeAssignment;
  return {
    betId: bet.id,
    gameName: bet.game.name,
    stakeAmount: Number(bet.amount),
    startedAt: assignment.startedAt?.toISOString() ?? null,
    status: assignment.status,
    streams: {
      playerA: { name: bet.playerA.displayName, channel: bet.playerA.kickAccount?.channelSlug ?? null },
      playerB: { name: bet.playerB?.displayName ?? "Player B", channel: bet.playerB?.kickAccount?.channelSlug ?? null },
      referee: {
        name: assignment.refereeProfile?.user.displayName ?? "Referee",
        channel: assignment.refereeProfile?.user.kickAccount?.channelSlug ?? null,
      },
    },
    events: assignment.auditEvents.map((event) => ({ action: event.action, at: event.createdAt.toISOString() })),
    chat: bet.chatMessages
      .reverse()
      .map((message) => ({ name: message.user.displayName, body: message.body, at: message.createdAt.toISOString() })),
  };
}

/** Called by the recorder when it starts capturing. */
export async function beginRecording(betId: string, now: Date = new Date()) {
  const bet = await prisma.bet.findUniqueOrThrow({ where: { id: betId }, select: { playerAId: true } });
  return prisma.matchRecording.upsert({
    where: { betId_role: { betId, role: MatchRecordingRole.COMPOSITE } },
    create: {
      betId,
      userId: bet.playerAId,
      role: MatchRecordingRole.COMPOSITE,
      channelSlug: "composite",
      status: MatchRecordingStatus.RECORDING,
      startedAt: now,
    },
    update: { status: MatchRecordingStatus.RECORDING, startedAt: now, failureReason: null },
  });
}

/** True once the match is over (or has run past the limit), so recording should stop. */
export async function shouldStopRecording(betId: string, startedAt: Date, now: Date = new Date()): Promise<boolean> {
  if (now.getTime() - startedAt.getTime() > RECORDING_MAX_MS) return true;
  const assignment = await prisma.refereeAssignment.findUnique({ where: { betId }, select: { status: true } });
  return !assignment || assignment.status !== RefereeAssignmentStatus.IN_PROGRESS;
}

/** Mark the recording ready and write its fingerprint into the audit trail. */
export async function sealRecording(input: {
  betId: string;
  key: string;
  byteSize: number;
  durationSeconds: number;
  sha256: string;
  endedAt?: Date;
}) {
  const endedAt = input.endedAt ?? new Date();
  const disputed = await prisma.dispute.count({ where: { betId: input.betId, status: { in: OPEN_DISPUTES } } });
  return withTransaction(async (tx) => {
    const recording = await tx.matchRecording.update({
      where: { betId_role: { betId: input.betId, role: MatchRecordingRole.COMPOSITE } },
      data: {
        status: MatchRecordingStatus.READY,
        storageKey: input.key,
        byteSize: BigInt(input.byteSize),
        durationSeconds: input.durationSeconds,
        sha256: input.sha256,
        endedAt,
        // A dispute keeps the recording until it's decided.
        retainUntil: disputed ? null : new Date(endedAt.getTime() + UNDISPUTED_RETENTION_MS),
      },
    });
    const assignment = await tx.refereeAssignment.findUnique({ where: { betId: input.betId }, select: { id: true } });
    if (assignment) {
      await appendRefereeAudit(tx, {
        assignmentId: assignment.id,
        action: "RECORDING_SEALED",
        details: { recordingId: recording.id, sha256: input.sha256, byteSize: input.byteSize, durationSeconds: input.durationSeconds },
      });
    }
    return recording;
  });
}

export async function failRecording(betId: string, reason: string) {
  await prisma.matchRecording.updateMany({
    where: { betId, role: MatchRecordingRole.COMPOSITE },
    data: {
      status: MatchRecordingStatus.FAILED,
      failureReason: reason.slice(0, 500),
      endedAt: new Date(),
      retainUntil: new Date(Date.now() + UNDISPUTED_RETENTION_MS),
    },
  });
}

/** A filed dispute keeps the match's recordings until it's decided. */
export async function holdRecordingsForDispute(betId: string): Promise<void> {
  await prisma.matchRecording.updateMany({ where: { betId, deletedAt: null }, data: { retainUntil: null } });
}

/** Delete recordings past their retention date with no open dispute. */
export async function deleteExpiredRecordings(now: Date = new Date()): Promise<number> {
  const expired = await prisma.matchRecording.findMany({
    where: {
      retainUntil: { lt: now },
      deletedAt: null,
      bet: { disputes: { none: { status: { in: OPEN_DISPUTES } } } },
    },
    select: { id: true, betId: true },
    take: 100,
  });
  for (const recording of expired) {
    await deletePrefix(recordingKey(recording.betId, ""));
    await prisma.matchRecording.update({
      where: { id: recording.id },
      data: { status: MatchRecordingStatus.DELETED, deletedAt: now, storageKey: null },
    });
  }
  return expired.length;
}

/**
 * A short-lived link to watch a dispute's recording, for someone allowed to
 * review it. Every viewing is logged.
 */
export async function getDisputePlayback(userId: string, disputeId: string, recordingId: string, request?: Request) {
  const evidence = await getDisputeEvidence(userId, disputeId);
  const recording = await prisma.matchRecording.findFirst({
    where: { id: recordingId, betId: evidence.bet.id, status: MatchRecordingStatus.READY, deletedAt: null },
    select: { id: true, storageKey: true, startedAt: true, sha256: true },
  });
  if (!recording?.storageKey) throw new NotFoundError("Recording not available");
  const url = await playbackUrl(recording.storageKey, `playstake-match-${evidence.bet.id}.mp4`);
  await recordAdminAction({
    actorId: userId,
    action: "recording.view",
    targetType: "match_recording",
    targetId: recording.id,
    details: { disputeId, betId: evidence.bet.id },
    request,
  });
  return { url, startedAt: recording.startedAt.toISOString(), sha256: recording.sha256 };
}
