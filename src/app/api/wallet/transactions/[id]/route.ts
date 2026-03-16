import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/client";
import { LedgerAccountType } from "../../../../../../generated/prisma/client";
import { validateSession } from "../../../../../lib/auth/session";
import { getSessionToken } from "../../../../../lib/auth/helpers";
import { dollarsToCents } from "../../../../../lib/utils/money";
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  AuthorizationError,
} from "../../../../../lib/errors/index";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id } = await params;

    // Fetch transaction with ledger entries
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            ledgerAccount: {
              select: { accountType: true, userId: true },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found");
    }

    // Verify the transaction belongs to this user by checking ledger entries
    const playerAccount = await prisma.ledgerAccount.findUnique({
      where: {
        userId_accountType: {
          userId: session.userId,
          accountType: LedgerAccountType.PLAYER_BALANCE,
        },
      },
    });

    const userIsParticipant = transaction.entries.some(
      (entry) => entry.ledgerAccountId === playerAccount?.id
    );

    if (!userIsParticipant) {
      throw new AuthorizationError(
        "You do not have access to this transaction"
      );
    }

    const ledgerEntries = transaction.entries.map((entry) => ({
      accountType: entry.ledgerAccount.accountType,
      amount: dollarsToCents(entry.amount),
      balanceAfter: dollarsToCents(entry.balanceAfter),
    }));

    return NextResponse.json({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: dollarsToCents(transaction.amount),
      currency: transaction.currency,
      description: transaction.description,
      betId: transaction.betId,
      ledgerEntries,
      createdAt: transaction.createdAt.toISOString(),
      completedAt: transaction.completedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
