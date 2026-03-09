import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client.js";
import {
  LedgerAccountType,
  type TransactionType,
  type TransactionStatus,
} from "../../../../../generated/prisma/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { transactionListQuerySchema } from "../../../../lib/validation/schemas.js";
import { validateQuery } from "../../../../lib/middleware/validate.js";
import { dollarsToCents } from "../../../../lib/utils/money.js";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index.js";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const url = new URL(request.url);
    const query = validateQuery(transactionListQuerySchema, url.searchParams);

    // Find the user's ledger account to scope transactions
    const playerAccount = await prisma.ledgerAccount.findUnique({
      where: {
        userId_accountType: {
          userId: session.userId,
          accountType: LedgerAccountType.PLAYER_BALANCE,
        },
      },
    });

    if (!playerAccount) {
      return NextResponse.json({
        data: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          totalCount: 0,
          totalPages: 0,
        },
      });
    }

    // Build filter: transactions that have a ledger entry touching this account
    const where: Record<string, unknown> = {
      entries: {
        some: {
          ledgerAccountId: playerAccount.id,
        },
      },
    };

    if (query.type) {
      where.type = query.type as TransactionType;
    }
    if (query.status) {
      where.status = query.status as TransactionStatus;
    }

    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const data = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: dollarsToCents(tx.amount),
      currency: tx.currency,
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
      completedAt: tx.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
