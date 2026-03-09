import { prisma } from "../db/client.js";
import { TransactionStatus } from "../../../generated/prisma/client.js";
import { ConflictError } from "../errors/index.js";

/**
 * Check if a transaction with the given idempotency key already exists.
 *
 * If a COMPLETED transaction exists, returns `{ exists: true, response }` with
 * the original transaction data so the endpoint can return the same response.
 *
 * If a PENDING transaction exists, throws a ConflictError (another request
 * is in flight).
 *
 * If no transaction exists, returns `{ exists: false }`.
 *
 * @param key  The idempotency key from the client request.
 * @param params  The request parameters for conflict detection.
 */
export async function checkIdempotency(
  key: string,
  params: { amount?: number; type?: string }
): Promise<{ exists: boolean; response?: Record<string, unknown> }> {
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey: key },
  });

  if (!existing) {
    return { exists: false };
  }

  if (existing.status === TransactionStatus.PENDING) {
    throw new ConflictError(
      "A transaction with this idempotency key is already being processed"
    );
  }

  if (existing.status === TransactionStatus.COMPLETED) {
    // Verify the parameters match (prevent reuse with different amounts)
    if (params.amount !== undefined) {
      const existingCents = existing.amount.times(100).round().toNumber();
      if (existingCents !== params.amount) {
        throw new ConflictError(
          "Idempotency key already used with different parameters"
        );
      }
    }

    return {
      exists: true,
      response: {
        transactionId: existing.id,
        type: existing.type,
        status: existing.status,
        amount: existing.amount.times(100).round().toNumber(),
        createdAt: existing.createdAt.toISOString(),
      },
    };
  }

  // FAILED or REVERSED — allow retry with a new key
  throw new ConflictError(
    `Transaction with this idempotency key has status ${existing.status}. Use a new idempotency key to retry.`
  );
}
