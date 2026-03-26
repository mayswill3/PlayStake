import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/client";
import { validateSession } from "../../../../../lib/auth/session";
import { getSessionToken } from "../../../../../lib/auth/helpers";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../../lib/errors/index";

/**
 * Lightweight endpoint to check a deposit transaction's status.
 * Used by the wallet page to poll after payment until the webhook
 * marks the transaction COMPLETED.
 */
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

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: { status: true, metadata: true },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found");
    }

    // Authorize via metadata.userId (the original PENDING transaction
    // has no ledger entries, so we can't use the ledger-entry check)
    const metaUserId = (transaction.metadata as any)?.userId;
    if (metaUserId !== session.userId) {
      throw new AuthorizationError("You do not have access to this transaction");
    }

    return NextResponse.json({ status: transaction.status });
  } catch (error) {
    return errorResponse(error);
  }
}
