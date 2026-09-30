import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../generated/prisma/client";

const PAGE_SIZE = 100;

/**
 * GET /api/admin/audit-log?action=&targetType=&targetId=&actorId=&before=
 *
 * The append-only record of staff actions, newest first. `before` (an ISO
 * timestamp from the last row) pages backwards.
 */
export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  const params = new URL(request.url).searchParams;
  const before = params.get("before");
  const entries = await prisma.adminAuditLog.findMany({
    where: {
      ...(params.get("action") ? { action: { startsWith: params.get("action")! } } : {}),
      ...(params.get("targetType") ? { targetType: params.get("targetType")! } : {}),
      ...(params.get("targetId") ? { targetId: params.get("targetId")! } : {}),
      ...(params.get("actorId") ? { actorId: params.get("actorId")! } : {}),
      ...(before && !Number.isNaN(Date.parse(before)) ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { actor: { select: { displayName: true, email: true } } },
  });
  return Response.json({ entries, pageSize: PAGE_SIZE });
});
