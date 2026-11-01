// =============================================================================
// PlayStake — Admin access to match recordings
// =============================================================================
// Admins can watch or listen to any match's recordings, not only through a
// dispute, but only for a stated purpose (DPIA, Document 18): they choose a
// reason and write a note before every playback, every playback is logged in
// the append-only admin audit log ("recording.view"), and the "Recording
// access" log lets the compliance lead review who viewed what and why. An
// admin who played in or refereed the match can't open its recordings.
//
// An admin can place an investigation hold so a match's recordings aren't
// deleted on schedule; releasing it restores the normal retention date.
// =============================================================================

import { DisputeStatus, MatchRecordingStatus } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { recordAdminAction } from "../admin/audit";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { UNDISPUTED_RETENTION_MS } from "./config";
import { playbackUrl } from "./storage";
import { DISPUTED_RECORDING_RETENTION_MS } from "../disputes/review";

export const RECORDING_ACCESS_REASONS = {
  COMPLAINT: "Complaint",
  CHEATING_OR_FIXING: "Suspected cheating or fixing",
  AML_OR_FRAUD: "AML or fraud investigation",
  REFEREE_QUALITY: "Referee quality review",
  DATA_REQUEST: "Data request from the player",
} as const;
export type RecordingAccessReason = keyof typeof RECORDING_ACCESS_REASONS;

const OPEN_DISPUTES: DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];
const DAY_MS = 24 * 60 * 60 * 1000;

function assertReason(reason: string, note: string): asserts reason is RecordingAccessReason {
  if (!(reason in RECORDING_ACCESS_REASONS)) throw new ValidationError("Choose why you need to open this recording");
  if (note.trim().length < 5) throw new ValidationError("Add a short note (case, complaint or reference)");
}

/** Recent refereed matches, newest first, optionally filtered by a player's name, email or the match ID. */
export async function listMatchesForAdmin(input: { search?: string; userId?: string; limit?: number }) {
  const search = input.search?.trim();
  const playerFilter = (where: object) => ({ OR: [{ playerA: where }, { playerB: where }] });
  const isId = search && /^[0-9a-f-]{36}$/i.test(search);
  const bets = await prisma.bet.findMany({
    where: {
      refereeAssignment: { isNot: null },
      ...(input.userId ? { OR: [{ playerAId: input.userId }, { playerBId: input.userId }] } : {}),
      ...(search && !input.userId
        ? isId
          ? { id: search }
          : playerFilter({
              OR: [
                { displayName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            })
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(input.limit ?? 50, 100),
    select: {
      id: true,
      status: true,
      amount: true,
      createdAt: true,
      game: { select: { name: true } },
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
      _count: { select: { recordings: { where: { status: MatchRecordingStatus.READY, deletedAt: null } } } },
    },
  });
  return bets.map((bet) => ({
    id: bet.id,
    status: bet.status,
    amount: bet.amount.toString(),
    createdAt: bet.createdAt.toISOString(),
    game: bet.game.name,
    playerA: bet.playerA.displayName,
    playerB: bet.playerB?.displayName ?? null,
    recordings: bet._count.recordings,
  }));
}

/** A match and its recordings (no links: those need a reason). */
export async function getMatchRecordingsForAdmin(adminId: string, betId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      status: true,
      amount: true,
      outcome: true,
      createdAt: true,
      game: { select: { name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
      refereeAssignment: {
        select: { status: true, startedAt: true, decision: true, decisionSubmittedAt: true, refereeProfile: { select: { user: { select: { id: true, displayName: true } } } } },
      },
      disputes: { select: { id: true, status: true }, orderBy: { createdAt: "desc" } },
      recordings: {
        orderBy: [{ role: "asc" }, { segment: "asc" }],
        select: {
          id: true, role: true, segment: true, status: true, startedAt: true, endedAt: true, durationSeconds: true,
          byteSize: true, sha256: true, failureReason: true, retainUntil: true, deletedAt: true, heldAt: true, heldReason: true,
        },
      },
    },
  });
  if (!bet) throw new NotFoundError("Match not found");
  const refereeUserId = bet.refereeAssignment?.refereeProfile?.user.id;
  const conflict = [bet.playerA.id, bet.playerB?.id, refereeUserId].includes(adminId)
    ? "You played in or refereed this match, so you can't open its recordings."
    : null;
  return {
    ...bet,
    amount: bet.amount.toString(),
    conflict,
    recordings: bet.recordings.map((r) => ({ ...r, byteSize: r.byteSize?.toString() ?? null })),
  };
}

/** A 15-minute link to watch or listen, for a stated reason. Logged. */
export async function getAdminPlayback(input: {
  adminId: string;
  betId: string;
  recordingId: string;
  reason: string;
  note: string;
  request?: Request;
}) {
  assertReason(input.reason, input.note);
  const match = await getMatchRecordingsForAdmin(input.adminId, input.betId);
  if (match.conflict) throw new AuthorizationError(match.conflict);
  const recording = await prisma.matchRecording.findFirst({
    where: { id: input.recordingId, betId: input.betId, status: MatchRecordingStatus.READY, deletedAt: null },
    select: { id: true, storageKey: true, role: true },
  });
  if (!recording?.storageKey) throw new NotFoundError("Recording not available");
  const extension = recording.storageKey.split(".").pop() ?? "mp4";
  const url = await playbackUrl(recording.storageKey, `playstake-match-${input.betId}.${extension}`);
  await recordAdminAction({
    actorId: input.adminId,
    action: "recording.view",
    targetType: "match_recording",
    targetId: recording.id,
    details: {
      betId: input.betId,
      via: "admin",
      kind: recording.role,
      reason: input.reason,
      reasonLabel: RECORDING_ACCESS_REASONS[input.reason as RecordingAccessReason],
      note: input.note.trim().slice(0, 500),
    },
    request: input.request,
  });
  return { url };
}

/** The normal retention date for a match's recordings with no hold. */
async function normalRetainUntil(betId: string, endedAt: Date | null, now: Date): Promise<Date | null> {
  const disputes = await prisma.dispute.findMany({ where: { betId }, select: { status: true, resolvedAt: true } });
  if (disputes.some((d) => OPEN_DISPUTES.includes(d.status))) return null;
  const candidates = [new Date((endedAt ?? now).getTime() + UNDISPUTED_RETENTION_MS), new Date(now.getTime() + DAY_MS)];
  for (const d of disputes) if (d.resolvedAt) candidates.push(new Date(d.resolvedAt.getTime() + DISPUTED_RECORDING_RETENTION_MS));
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

/** Place or release an investigation hold on all of a match's recordings. Logged. */
export async function setRecordingHold(input: { adminId: string; betId: string; hold: boolean; reason: string; request?: Request; now?: Date }) {
  const now = input.now ?? new Date();
  if (input.reason.trim().length < 5) throw new ValidationError("Give a reason for the hold (case or reference)");
  const recordings = await prisma.matchRecording.findMany({
    where: { betId: input.betId, deletedAt: null },
    select: { id: true, endedAt: true },
  });
  if (recordings.length === 0) throw new ConflictError("This match has no recordings to hold");
  if (input.hold) {
    await prisma.matchRecording.updateMany({
      where: { betId: input.betId, deletedAt: null },
      data: { heldAt: now, heldReason: input.reason.trim().slice(0, 500), heldById: input.adminId, retainUntil: null },
    });
  } else {
    for (const recording of recordings) {
      await prisma.matchRecording.update({
        where: { id: recording.id },
        data: { heldAt: null, heldReason: null, heldById: null, retainUntil: await normalRetainUntil(input.betId, recording.endedAt, now) },
      });
    }
  }
  await recordAdminAction({
    actorId: input.adminId,
    action: input.hold ? "recording.hold" : "recording.release",
    targetType: "bet",
    targetId: input.betId,
    details: { reason: input.reason.trim().slice(0, 500), recordings: recordings.length },
    request: input.request,
  });
  return { held: input.hold, recordings: recordings.length };
}

/** Who opened which recording, when and why (dispute reviews and admin access). */
export async function listRecordingAccess(limit = 200) {
  const rows = await prisma.adminAuditLog.findMany({
    where: { action: { in: ["recording.view", "recording.hold", "recording.release"] } },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    select: { id: true, action: true, targetId: true, details: true, createdAt: true, actor: { select: { displayName: true, email: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetId: row.targetId,
    details: row.details as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor.displayName || row.actor.email,
  }));
}
