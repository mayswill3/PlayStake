import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../generated/prisma/client";
import { adminDisputeListQuerySchema } from "@/lib/validation/schemas";

export const GET = withRoleGuard([UserRole.ADMIN], async (req) => {
  const url = new URL(req.url);
  const parsed = adminDisputeListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams)
  );

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { page, limit, status } = parsed.data;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: {
        bet: {
          select: {
            id: true,
            amount: true,
            game: { select: { name: true } },
          },
        },
        filedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  return Response.json({
    data: disputes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
