import "dotenv/config";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Transaction client type — the subset of PrismaClient available inside
 * an interactive transaction. Prisma strips $connect, $disconnect, and
 * $transaction from the client within a transaction scope.
 */
export type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ---------------------------------------------------------------------------
// Singleton PrismaClient using the driver adapter pattern (same as seed.ts)
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Singleton Prisma client. Reuses the same instance across imports to avoid
 * exhausting database connection pools.
 */
export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = createPrismaClient();
  }
  return _prisma;
}

export const prisma = getPrisma();

/**
 * Run a callback inside an interactive Prisma transaction.
 *
 * All ledger operations accept a `TxClient` as their first argument so they
 * compose naturally inside a single transaction boundary. This helper provides
 * the outermost transaction wrapper.
 *
 * @param fn  Callback that receives the transaction client.
 * @param options  Optional Prisma transaction options (timeout, maxWait).
 * @returns The value returned by the callback.
 */
export async function withTransaction<T>(
  fn: (tx: TxClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number }
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 10_000,
    timeout: options?.timeout ?? 30_000,
  });
}
