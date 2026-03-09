import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "../../../../lib/db/client.js";
import { LedgerAccountType, BetStatus } from "../../../../../generated/prisma/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { dollarsToCents } from "../../../../lib/utils/money.js";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index.js";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    // Get the player's balance account
    const playerAccount = await prisma.ledgerAccount.findUnique({
      where: {
        userId_accountType: {
          userId: session.userId,
          accountType: LedgerAccountType.PLAYER_BALANCE,
        },
      },
    });

    const available = playerAccount
      ? dollarsToCents(playerAccount.balance)
      : 0;

    // Calculate escrowed amount: sum of escrow accounts for user's active bets
    const activeBetStatuses = [
      BetStatus.PENDING_CONSENT,
      BetStatus.OPEN,
      BetStatus.MATCHED,
      BetStatus.RESULT_REPORTED,
      BetStatus.DISPUTED,
    ];

    // Find all active bets where user is a participant
    const activeBets = await prisma.bet.findMany({
      where: {
        status: { in: activeBetStatuses },
        OR: [
          { playerAId: session.userId },
          { playerBId: session.userId },
        ],
      },
      select: { id: true },
    });

    let escrowed = 0;
    if (activeBets.length > 0) {
      const betIds = activeBets.map((b) => b.id);
      const escrowAccounts = await prisma.ledgerAccount.findMany({
        where: {
          betId: { in: betIds },
          accountType: LedgerAccountType.ESCROW,
        },
        select: { balance: true },
      });

      escrowed = escrowAccounts.reduce(
        (sum, acc) => sum + dollarsToCents(acc.balance),
        0
      );
    }

    return NextResponse.json({
      available,
      escrowed,
      currency: "USD",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
