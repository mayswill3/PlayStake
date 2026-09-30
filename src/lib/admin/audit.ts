// =============================================================================
// PlayStake — Admin audit log
// =============================================================================
// Every privileged staff action is recorded here: who, what, to which record,
// with what change, from where. The table is append-only (a DB trigger rejects
// UPDATE and DELETE). Write it in the same transaction as the change it
// describes, so a change can never land without its record.
// =============================================================================

import type { NextRequest } from "next/server";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma, type TxClient } from "../db/client";

export interface AdminActionInput {
  actorId: string;
  /** Verb-ish, e.g. "user.kyc_override", "complaint.final_response". */
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Prisma.InputJsonValue;
  request?: NextRequest | Request | null;
}

function clientIp(request?: NextRequest | Request | null): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim().slice(0, 45) || null;
}

export async function recordAdminAction(
  input: AdminActionInput,
  tx: TxClient | typeof prisma = prisma,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      details: input.details ?? {},
      ipAddress: clientIp(input.request),
    },
  });
}
