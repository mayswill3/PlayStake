import { RefereeProfileStatus, UserRole } from "@/../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { withRoleGuard } from "@/lib/middleware/auth";

export const PATCH = withRoleGuard([UserRole.ADMIN], async (request, context) => {
  const id = context.params?.id;
  if (!id) return Response.json({ error: "Referee profile ID required" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  if (
    body.status !== RefereeProfileStatus.APPROVED &&
    body.status !== RefereeProfileStatus.REJECTED &&
    body.status !== RefereeProfileStatus.SUSPENDED
  ) {
    return Response.json({ error: "Invalid referee status" }, { status: 422 });
  }
  if (body.status === RefereeProfileStatus.APPROVED) {
    const candidate = await prisma.refereeProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            kycStatus: true,
            kickAccount: { select: { channelSlug: true } },
          },
        },
      },
    });
    if (!candidate) {
      return Response.json({ error: "Referee profile not found" }, { status: 404 });
    }
    if (
      candidate.user.kycStatus !== "VERIFIED" ||
      !candidate.user.kickAccount?.channelSlug
    ) {
      return Response.json(
        { error: "Verified identity and a connected Kick channel are required" },
        { status: 422 },
      );
    }
  }
  const now = new Date();
  const profile = await prisma.refereeProfile.update({
    where: { id },
    data: {
      status: body.status,
      isAvailable:
        body.status === RefereeProfileStatus.APPROVED ? undefined : false,
      approvedAt:
        body.status === RefereeProfileStatus.APPROVED ? now : undefined,
      suspendedAt:
        body.status === RefereeProfileStatus.SUSPENDED ? now : null,
    },
  });
  return Response.json(profile);
});
