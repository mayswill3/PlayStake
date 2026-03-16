import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import { UserRole, BetStatus, TransactionType } from "../../../../../generated/prisma/client";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { dollarsToCents } from "../../../../lib/utils/money";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../lib/errors/index";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    if (
      session.user.role !== UserRole.DEVELOPER &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError("Developer or admin role required");
    }

    const profile = await prisma.developerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!profile) {
      throw new NotFoundError("Developer profile not found");
    }

    // Get all games for this developer
    const games = await prisma.game.findMany({
      where: { developerProfileId: profile.id },
      select: { id: true },
    });
    const gameIds = games.map((g) => g.id);

    // Total bets across all developer games
    const totalBets = await prisma.bet.count({
      where: {
        gameId: { in: gameIds },
        status: {
          notIn: [BetStatus.PENDING_CONSENT, BetStatus.CANCELLED],
        },
      },
    });

    // Active bets
    const activeBets = await prisma.bet.count({
      where: {
        gameId: { in: gameIds },
        status: {
          in: [
            BetStatus.OPEN,
            BetStatus.MATCHED,
            BetStatus.RESULT_REPORTED,
            BetStatus.DISPUTED,
          ],
        },
      },
    });

    // Total volume (sum of bet amounts for settled bets)
    const settledBets = await prisma.bet.findMany({
      where: {
        gameId: { in: gameIds },
        status: BetStatus.SETTLED,
      },
      select: { amount: true },
    });

    const totalVolumeDollars = settledBets.reduce(
      (sum, bet) => sum.plus(bet.amount),
      new Decimal(0)
    );
    const totalVolume = dollarsToCents(totalVolumeDollars);

    // Revenue share earned: sum of DEVELOPER_SHARE transactions
    // crediting this developer's DEVELOPER_BALANCE account
    const devAccount = await prisma.ledgerAccount.findUnique({
      where: {
        userId_accountType: {
          userId: session.userId,
          accountType: "DEVELOPER_BALANCE",
        },
      },
    });

    let revShareEarned = 0;
    if (devAccount) {
      const devShareEntries = await prisma.ledgerEntry.findMany({
        where: {
          ledgerAccountId: devAccount.id,
          amount: { gt: 0 }, // credits only
          transaction: {
            type: TransactionType.DEVELOPER_SHARE,
          },
        },
        select: { amount: true },
      });

      const totalRevShare = devShareEntries.reduce(
        (sum, entry) => sum.plus(entry.amount),
        new Decimal(0)
      );
      revShareEarned = dollarsToCents(totalRevShare);
    }

    // Period: current month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const periodEnd = now.toISOString().split("T")[0];

    return NextResponse.json({
      totalBets,
      totalVolume,
      activeBets,
      revShareEarned,
      periodStart,
      periodEnd,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
