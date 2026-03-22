import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../generated/prisma/client";
import { adminAnomalyListQuerySchema } from "@/lib/validation/schemas";

export const GET = withRoleGuard([UserRole.ADMIN], async (req) => {
  const url = new URL(req.url);
  const parsed = adminAnomalyListQuerySchema.safeParse(
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

  const [anomalies, total] = await Promise.all([
    prisma.anomalyAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.anomalyAlert.count({ where }),
  ]);

  return Response.json({
    data: anomalies,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
