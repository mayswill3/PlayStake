import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma, withTransaction } from "@/lib/db/client";
import {
  AmlCaseStatus,
  KycStatus,
  KycSubmissionStatus,
  PlayerRiskStatus,
  UserRole,
} from "../../../../../../generated/prisma/client";
import { adminUpdateUserSchema } from "@/lib/validation/schemas";
import { recordAdminAction } from "@/lib/admin/audit";
import { MINIMUM_AGE_YEARS, ageInYears } from "@/lib/kyc/constants";
import { getActiveBreak } from "@/lib/responsible-play/service";

export const GET = withRoleGuard([UserRole.ADMIN], async (_req, context) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "User ID required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      kycStatus: true,
      emailVerified: true,
      twoFactorEnabled: true,
      dateOfBirth: true,
      marketingConsent: true,
      accountStatus: true,
      accountStatusReason: true,
      accountStatusChangedAt: true,
      gamstopStatus: true,
      gamstopCheckedAt: true,
      createdAt: true,
      lastLoginAt: true,
      _count: {
        select: {
          sessionsAsPlayerA: true,
          sessionsAsPlayerB: true,
          disputesFiled: true,
        },
      },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const [balanceAccount, activeBreak, openRiskSignals, openAmlCases, complaints] = await Promise.all([
    prisma.ledgerAccount.findFirst({
      where: { userId: id, accountType: "PLAYER_BALANCE" },
      select: { balance: true },
    }),
    getActiveBreak(id),
    prisma.playerRiskSignal.count({ where: { userId: id, status: PlayerRiskStatus.OPEN } }),
    prisma.amlCase.count({
      where: {
        userId: id,
        status: { notIn: [AmlCaseStatus.CLOSED_NO_ACTION, AmlCaseStatus.CLOSED_ACTION_TAKEN] },
      },
    }),
    prisma.complaint.count({ where: { userId: id } }),
  ]);

  return Response.json({
    ...user,
    balance: Number(balanceAccount?.balance ?? 0),
    totalBets: user._count.sessionsAsPlayerA + user._count.sessionsAsPlayerB,
    disputesFiled: user._count.disputesFiled,
    activeBreak,
    openRiskSignals,
    openAmlCases,
    complaints,
  });
});

/**
 * Change a user's role or KYC status. Every change needs a reason and is
 * written to the admin audit log. An admin can't change their own role, and
 * KYC can only be set to VERIFIED by hand when an approved identity document
 * shows the customer is 18 or over — age verification can't be bypassed.
 */
export const PATCH = withRoleGuard([UserRole.ADMIN], async (req, context, auth) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "User ID required" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = adminUpdateUserSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const update: { role?: UserRole; kycStatus?: KycStatus } = {};
  if (parsed.data.role) update.role = parsed.data.role as UserRole;
  if (parsed.data.kycStatus) update.kycStatus = parsed.data.kycStatus as KycStatus;

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }
  if (update.role && id === auth.userId) {
    return Response.json({ error: "You can't change your own role" }, { status: 409 });
  }

  const before = await prisma.user.findUnique({
    where: { id },
    select: { role: true, kycStatus: true },
  });
  if (!before) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (update.kycStatus === KycStatus.VERIFIED) {
    const approved = await prisma.kycSubmission.findFirst({
      where: { userId: id, status: KycSubmissionStatus.APPROVED },
      orderBy: { reviewedAt: "desc" },
      select: { dateOfBirth: true },
    });
    if (!approved || ageInYears(approved.dateOfBirth) < MINIMUM_AGE_YEARS) {
      return Response.json(
        {
          error:
            "KYC can only be marked verified when an approved identity document shows the customer is 18 or over. Review their submission instead.",
        },
        { status: 409 },
      );
    }
  }

  const user = await withTransaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: update,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        kycStatus: true,
      },
    });
    await recordAdminAction(
      {
        actorId: auth.userId,
        action: "user.update",
        targetType: "user",
        targetId: id,
        details: { before, after: update, reason: parsed.data.reason },
        request: req,
      },
      tx,
    );
    return updated;
  });

  return Response.json(user);
});
