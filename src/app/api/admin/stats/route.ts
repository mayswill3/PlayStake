import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { UserRole } from "../../../../../generated/prisma/client";
import { getCustomerFundsHeld } from "@/lib/ledger/customer-funds";

export const GET = withRoleGuard([UserRole.ADMIN], async () => {
  const [
    totalUsers,
    totalDevelopers,
    totalBets,
    activeBets,
    openDisputes,
    totalVolume,
    platformRevenue,
    customerFunds,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: "DEVELOPER", deletedAt: null } }),
    prisma.bet.count(),
    prisma.bet.count({
      where: { status: { in: ["OPEN", "MATCHED", "RESULT_REPORTED"] } },
    }),
    prisma.dispute.count({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    }),
    prisma.bet.aggregate({ _sum: { amount: true } }),
    prisma.transaction.aggregate({
      where: { type: "PLATFORM_FEE", status: "COMPLETED" },
      _sum: { amount: true },
    }),
    getCustomerFundsHeld(),
  ]);

  return Response.json({
    totalUsers,
    totalDevelopers,
    totalBets,
    activeBets,
    openDisputes,
    totalVolume: Number(totalVolume._sum.amount ?? 0),
    platformRevenue: Number(platformRevenue._sum.amount ?? 0),
    /** In pence: what PlayStake owes customers, to reconcile daily against the client account. */
    customerFunds,
  });
});
