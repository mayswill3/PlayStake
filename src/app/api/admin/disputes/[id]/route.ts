import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../../generated/prisma/client";
import { adminResolveDisputeSchema } from "@/lib/validation/schemas";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { getAssignmentForBetForAdmin } from "@/lib/referees/admin-history";
import { errorResponse } from "@/lib/errors";
import { getDisputeEvidence, resolveDispute } from "@/lib/disputes/review";

export const GET = withRoleGuard([UserRole.ADMIN], async (_req, context, auth) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "Dispute ID required" }, { status: 400 });
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      bet: {
        include: {
          game: { select: { name: true, slug: true } },
          playerA: { select: { id: true, displayName: true, email: true } },
          playerB: { select: { id: true, displayName: true, email: true } },
        },
      },
      filedBy: { select: { id: true, displayName: true, email: true } },
      messages: {
        include: {
          author: { select: { id: true, displayName: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  const [refereeAssignment, evidence] = await Promise.all([
    getAssignmentForBetForAdmin(dispute.betId),
    getDisputeEvidence(auth.userId, id).catch(() => null),
  ]);
  return Response.json({ ...dispute, refereeAssignment, evidence });
});

export const PATCH = withRoleGuard([UserRole.ADMIN], async (req, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) return Response.json({ error: "Dispute ID required" }, { status: 400 });

    const parsed = adminResolveDisputeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const updated = await resolveDispute({
      userId: auth.userId,
      disputeId: id,
      status: parsed.data.status,
      resolution: parsed.data.resolution,
      context: auditContextFromRequest(req),
      request: req,
    });
    return Response.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
});
