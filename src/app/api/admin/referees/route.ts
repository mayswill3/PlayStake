import { UserRole } from "@/../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { withRoleGuard } from "@/lib/middleware/auth";

export const GET = withRoleGuard([UserRole.ADMIN], async () => {
  const profiles = await prisma.refereeProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          kycStatus: true,
          kickAccount: { select: { channelSlug: true } },
        },
      },
      qualifications: {
        include: { game: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return Response.json({ profiles });
});
