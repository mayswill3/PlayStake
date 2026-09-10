import "dotenv/config";
import { PrismaClient } from "../../../generated/prisma/client";
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
  options?: { maxWait?: number; timeout?: number; retries?: number }
): Promise<T> {
  const retries = options?.retries ?? 3;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        maxWait: options?.maxWait ?? 10_000,
        timeout: options?.timeout ?? 30_000,
        isolationLevel: "Serializable",
      });
    } catch (error) {
      // P2034 is Prisma's own write-conflict/deadlock code. A serialization
      // failure hit by a raw query (our SELECT ... FOR UPDATE pattern) is NOT
      // mapped to P2034 — it surfaces as P2010 carrying the Postgres SQLSTATE
      // 40001, nested under meta.code or (with the PrismaPg driver adapter)
      // meta.driverAdapterError.cause.originalCode. All of these mean the same
      // thing under Serializable: safe to retry.
      const err = error as {
        code?: string;
        meta?: {
          code?: string;
          driverAdapterError?: { cause?: { originalCode?: string } };
        };
      };
      const code = error instanceof Error ? err.code : undefined;
      const sqlState =
        err.meta?.code ?? err.meta?.driverAdapterError?.cause?.originalCode;
      const isWriteConflict =
        code === "P2034" || (code === "P2010" && sqlState === "40001");
      if (!isWriteConflict || attempt >= retries) throw error;

      // Short jitter reduces repeat collisions without holding a DB transaction.
      await new Promise((resolve) =>
        setTimeout(resolve, 20 * 2 ** attempt + Math.floor(Math.random() * 25)),
      );
    }
  }
}
