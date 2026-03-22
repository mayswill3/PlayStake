import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../../generated/prisma/client";
import { adminUpdateUserSchema } from "@/lib/validation/schemas";

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

  // Fetch balance
  const balanceAccount = await prisma.ledgerAccount.findFirst({
    where: { userId: id, accountType: "PLAYER_BALANCE" },
    select: { balance: true },
  });

  return Response.json({
    ...user,
    balance: Number(balanceAccount?.balance ?? 0),
    totalBets: user._count.sessionsAsPlayerA + user._count.sessionsAsPlayerB,
    disputesFiled: user._count.disputesFiled,
  });
});

export const PATCH = withRoleGuard([UserRole.ADMIN], async (req, context) => {
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

  const update: Record<string, unknown> = {};
  if (parsed.data.role) update.role = parsed.data.role;
  if (parsed.data.kycStatus) update.kycStatus = parsed.data.kycStatus;

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
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

  return Response.json(user);
});
