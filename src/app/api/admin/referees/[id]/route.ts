import { RefereeProfileStatus, UserRole } from "@/../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { withRoleGuard } from "@/lib/middleware/auth";
import { emailRefereeApplicationDecided } from "@/lib/email/events";
import { recordAdminAction } from "@/lib/admin/audit";

export const PATCH = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
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
  const before = await prisma.refereeProfile.findUnique({ where: { id }, select: { status: true } });
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
  await recordAdminAction({
    actorId: auth.userId,
    action: "referee.status",
    targetType: "referee_profile",
    targetId: id,
    details: { userId: profile.userId, from: before?.status ?? null, to: body.status },
    request,
  });
  await emailRefereeApplicationDecided({
    userId: profile.userId,
    profileId: profile.id,
    status:
      body.status === RefereeProfileStatus.APPROVED
        ? "approved"
        : body.status === RefereeProfileStatus.SUSPENDED
          ? "suspended"
          : "rejected",
  });

  return Response.json(profile);
});
