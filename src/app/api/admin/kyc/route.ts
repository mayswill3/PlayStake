import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { adminKycListQuerySchema } from "@/lib/validation/schemas";
import { Prisma, UserRole } from "../../../../../generated/prisma/client";

export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  const url = new URL(request.url);
  const parsed = adminKycListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { page, limit, status, search } = parsed.data;
  const where: Prisma.KycSubmissionWhereInput = {};

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { legalFirstName: { contains: search, mode: "insensitive" } },
      { legalLastName: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [submissions, total, pendingTotal] = await Promise.all([
    prisma.kycSubmission.findMany({
      where,
      select: {
        id: true,
        status: true,
        legalFirstName: true,
        legalLastName: true,
        country: true,
        documentType: true,
        createdAt: true,
        reviewedAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
      // Oldest pending packet first: reviewers should work a queue, not a stack.
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.kycSubmission.count({ where }),
    prisma.kycSubmission.count({ where: { status: "PENDING" } }),
  ]);

  return Response.json({
    data: submissions,
    pendingTotal,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});
