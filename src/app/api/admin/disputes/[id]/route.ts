import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../../generated/prisma/client";
import { adminResolveDisputeSchema } from "@/lib/validation/schemas";

export const GET = withRoleGuard([UserRole.ADMIN], async (_req, context) => {
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

  return Response.json(dispute);
});

export const PATCH = withRoleGuard([UserRole.ADMIN], async (req, context, auth) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "Dispute ID required" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = adminResolveDisputeSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const dispute = await prisma.dispute.findUnique({ where: { id } });
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) {
    return Response.json(
      { error: "Dispute has already been resolved" },
      { status: 400 }
    );
  }

  const updated = await prisma.dispute.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolution: parsed.data.resolution,
      resolvedById: auth.userId,
      resolvedAt: new Date(),
    },
  });

  return Response.json(updated);
});
