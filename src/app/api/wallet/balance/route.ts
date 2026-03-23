import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "../../../../lib/db/client";
import { LedgerAccountType, BetStatus } from "../../../../../generated/prisma/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { validateWidgetToken } from "../../../../lib/auth/widget-token";
import { dollarsToCents } from "../../../../lib/utils/money";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";

export async function GET(request: NextRequest) {
  try {
    // Support both session cookie auth and widget token auth
    let userId: string;

    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader.startsWith("WidgetToken ")) {
      const rawToken = authHeader.slice("WidgetToken ".length);
      const widgetSession = await validateWidgetToken(rawToken);
      if (!widgetSession) throw new AuthenticationError("Invalid or expired widget token");
      userId = widgetSession.userId;
    } else {
      const token = getSessionToken(request);
      if (!token) throw new AuthenticationError();
      const session = await validateSession(token);
      if (!session) throw new AuthenticationError("Invalid or expired session");
      userId = session.userId;
    }

    // Get the player's balance account
    const playerAccount = await prisma.ledgerAccount.findUnique({
      where: {
        userId_accountType: {
          userId: userId,
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
          { playerAId: userId },
          { playerBId: userId },
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
      userId,
      available,
      escrowed,
      currency: "USD",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
