import { createHash } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client";
import type { TxClient } from "@/lib/db/client";

export interface AuditContext {
  ipHash?: string | null;
  userAgent?: string | null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

export function computeRefereeAuditHash(input: {
  assignmentId: string;
  sequence: number;
  action: string;
  details: unknown;
  previousHash: string | null;
  actorUserId: string | null;
  createdAt: Date;
}): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        assignmentId: input.assignmentId,
        sequence: input.sequence,
        action: input.action,
        details: input.details,
        previousHash: input.previousHash,
        actorUserId: input.actorUserId,
        createdAt: input.createdAt.toISOString(),
      }),
    )
    .digest("hex");
}

export function auditContextFromRequest(request: Request): AuditContext {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp;

  return {
    ipHash: ip
      ? createHash("sha256")
          .update(
            `${process.env.AUDIT_IP_SALT ?? process.env.SESSION_SECRET ?? "local-development"}:${ip}`,
          )
          .digest("hex")
      : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/**
 * Append a hash-chained event while the caller holds the assignment row lock.
 * The database migration additionally prevents UPDATE/DELETE on this table.
 */
export async function appendRefereeAudit(
  tx: TxClient,
  input: {
    assignmentId: string;
    actorUserId?: string | null;
    action: string;
    details?: Record<string, unknown>;
    context?: AuditContext;
  },
) {
  await tx.$queryRaw`
    SELECT id FROM referee_assignments
    WHERE id = ${input.assignmentId}::uuid
    FOR UPDATE
  `;

  const previous = await tx.refereeAuditEvent.findFirst({
    where: { assignmentId: input.assignmentId },
    orderBy: { sequence: "desc" },
    select: { sequence: true, eventHash: true },
  });
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousHash = previous?.eventHash ?? null;
  const details = input.details ?? {};
  const actorUserId = input.actorUserId ?? null;
  const createdAt = new Date();
  const eventHash = computeRefereeAuditHash({
    assignmentId: input.assignmentId,
    sequence,
    action: input.action,
    details,
    previousHash,
    actorUserId,
    createdAt,
  });

  return tx.refereeAuditEvent.create({
    data: {
      assignmentId: input.assignmentId,
      actorUserId,
      sequence,
      action: input.action,
      details: details as Prisma.InputJsonValue,
      previousHash,
      eventHash,
      ipHash: input.context?.ipHash ?? null,
      userAgent: input.context?.userAgent ?? null,
      createdAt,
    },
  });
}

export function verifyRefereeAuditChain(
  events: Array<{
    assignmentId: string;
    actorUserId: string | null;
    sequence: number;
    action: string;
    details: unknown;
    previousHash: string | null;
    eventHash: string;
    createdAt: Date;
  }>,
): boolean {
  let previousHash: string | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.sequence !== index + 1 || event.previousHash !== previousHash) return false;
    const expected = computeRefereeAuditHash({
      assignmentId: event.assignmentId,
      sequence: event.sequence,
      action: event.action,
      details: event.details,
      previousHash: event.previousHash,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt,
    });
    if (expected !== event.eventHash) return false;
    previousHash = event.eventHash;
  }

  return true;
}
