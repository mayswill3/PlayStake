// =============================================================================
// PlayStake — Integration Test Helpers
// =============================================================================
// Provides factories, rollback-wrapped transactions, and a callApi helper
// that invokes Next.js route handlers directly without starting an HTTP server.
// =============================================================================

import "dotenv/config";
import { NextRequest } from "next/server";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  UserRole,
  LedgerAccountType,
  WidgetSessionStatus,
} from "../../generated/prisma/client.js";
import type { TxClient } from "../../src/lib/db/client.js";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";

// ---------------------------------------------------------------------------
// Test-specific Prisma client (reuse across tests)
// ---------------------------------------------------------------------------

let _testPrisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!_testPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set for tests");
    }
    const adapter = new PrismaPg({ connectionString });
    _testPrisma = new PrismaClient({ adapter });
  }
  return _testPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (_testPrisma) {
    await _testPrisma.$disconnect();
    _testPrisma = undefined;
  }
}

// ---------------------------------------------------------------------------
// Rollback transaction wrapper (reuse pattern from unit tests)
// ---------------------------------------------------------------------------

const ROLLBACK_SENTINEL = "__TEST_ROLLBACK__";

export async function withRollback(
  fn: (tx: TxClient) => Promise<void>
): Promise<void> {
  const prisma = getTestPrisma();
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Error(ROLLBACK_SENTINEL);
      },
      { maxWait: 30_000, timeout: 120_000 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ROLLBACK_SENTINEL) {
      return;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Password hashing (using bcrypt, same as production)
// ---------------------------------------------------------------------------

import bcrypt from "bcrypt";

async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ---------------------------------------------------------------------------
// Factory: create a user
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  passwordHash: string;
  emailVerified: boolean;
}

export async function createTestUser(
  tx: TxClient,
  overrides: {
    email?: string;
    password?: string;
    displayName?: string;
    role?: "PLAYER" | "DEVELOPER" | "ADMIN";
    emailVerified?: boolean;
  } = {}
): Promise<TestUser & { rawPassword: string }> {
  const uid = crypto.randomUUID().substring(0, 8);
  const rawPassword = overrides.password ?? "TestPass1!";
  const passwordHash = await hashPasswordBcrypt(rawPassword);
  const role =
    overrides.role === "DEVELOPER"
      ? UserRole.DEVELOPER
      : overrides.role === "ADMIN"
        ? UserRole.ADMIN
        : UserRole.PLAYER;

  const user = await tx.user.create({
    data: {
      email: overrides.email ?? `test-${uid}@playstake-test.com`,
      passwordHash,
      displayName: overrides.displayName ?? `TestUser_${uid}`,
      role,
      emailVerified: overrides.emailVerified ?? true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    passwordHash: user.passwordHash,
    emailVerified: user.emailVerified,
    rawPassword,
  };
}

// ---------------------------------------------------------------------------
// Factory: create developer profile + escrow limit
// ---------------------------------------------------------------------------

export interface TestDeveloperProfile {
  id: string;
  userId: string;
  companyName: string;
  revSharePercent: number;
}

export async function createTestDeveloperProfile(
  tx: TxClient,
  userId: string,
  overrides: {
    companyName?: string;
    contactEmail?: string;
    revSharePercent?: number;
    isApproved?: boolean;
    maxTotalEscrow?: number;
    maxSingleBet?: number;
  } = {}
): Promise<{
  developerProfile: TestDeveloperProfile;
  escrowLimit: { id: string; maxTotalEscrow: number; maxSingleBet: number };
}> {
  const profile = await tx.developerProfile.create({
    data: {
      userId,
      companyName: overrides.companyName ?? "Test Studio",
      contactEmail:
        overrides.contactEmail ?? `dev-${crypto.randomUUID().substring(0, 8)}@test.com`,
      revSharePercent: overrides.revSharePercent ?? 0.02,
      isApproved: overrides.isApproved ?? true,
    },
  });

  const escrowLimit = await tx.developerEscrowLimit.create({
    data: {
      developerProfileId: profile.id,
      maxTotalEscrow: overrides.maxTotalEscrow ?? 50000,
      maxSingleBet: overrides.maxSingleBet ?? 1000,
      currentEscrow: 0,
      tier: "STARTER",
    },
  });

  return {
    developerProfile: {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      revSharePercent: Number(profile.revSharePercent),
    },
    escrowLimit: {
      id: escrowLimit.id,
      maxTotalEscrow: Number(escrowLimit.maxTotalEscrow),
      maxSingleBet: Number(escrowLimit.maxSingleBet),
    },
  };
}

// ---------------------------------------------------------------------------
// Factory: create a game
// ---------------------------------------------------------------------------

export interface TestGame {
  id: string;
  slug: string;
  developerProfileId: string;
  platformFeePercent: number;
}

export async function createTestGame(
  tx: TxClient,
  developerProfileId: string,
  overrides: {
    name?: string;
    slug?: string;
    minBetAmount?: number;
    maxBetAmount?: number;
    platformFeePercent?: number;
  } = {}
): Promise<TestGame> {
  const uid = crypto.randomUUID().substring(0, 8);
  const game = await tx.game.create({
    data: {
      developerProfileId,
      name: overrides.name ?? `Test Game ${uid}`,
      slug: overrides.slug ?? `test-game-${uid}`,
      description: "Integration test game",
      isActive: true,
      minBetAmount: overrides.minBetAmount ?? 1.0,
      maxBetAmount: overrides.maxBetAmount ?? 500.0,
      platformFeePercent: overrides.platformFeePercent ?? 0.05,
    },
  });

  return {
    id: game.id,
    slug: game.slug,
    developerProfileId: game.developerProfileId,
    platformFeePercent: Number(game.platformFeePercent),
  };
}

// ---------------------------------------------------------------------------
// Factory: create API key (returns the raw key)
// ---------------------------------------------------------------------------

import { generateRandomToken, sha256Hash } from "../../src/lib/utils/crypto.js";

export interface TestApiKey {
  id: string;
  rawKey: string;
  developerProfileId: string;
  permissions: string[];
}

export async function createTestApiKey(
  tx: TxClient,
  developerProfileId: string,
  overrides: {
    label?: string;
    permissions?: string[];
  } = {}
): Promise<TestApiKey> {
  const rawKeyBody = generateRandomToken(32);
  const rawKey = `ps_live_${rawKeyBody}`;
  const keyHash = sha256Hash(rawKey);
  const permissions = overrides.permissions ?? [
    "bet:create",
    "bet:read",
    "result:report",
    "widget:auth",
  ];

  const apiKey = await tx.apiKey.create({
    data: {
      developerProfileId,
      keyPrefix: rawKey.substring(0, 8),
      keyHash,
      label: overrides.label ?? "Test Key",
      permissions,
      isActive: true,
    },
  });

  return {
    id: apiKey.id,
    rawKey,
    developerProfileId,
    permissions,
  };
}

// ---------------------------------------------------------------------------
// Factory: create widget token (returns the raw token)
// ---------------------------------------------------------------------------

export interface TestWidgetToken {
  rawToken: string;
  userId: string;
  gameId: string;
  expiresAt: Date;
}

export async function createTestWidgetToken(
  tx: TxClient,
  userId: string,
  gameId: string
): Promise<TestWidgetToken> {
  const rawTokenBody = generateRandomToken(32);
  const rawToken = `wt_${rawTokenBody}`;
  const tokenHash = sha256Hash(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Revoke any existing tokens for this user+game
  await tx.widgetSession.updateMany({
    where: {
      userId,
      gameId,
      status: WidgetSessionStatus.ACTIVE,
    },
    data: {
      status: WidgetSessionStatus.REVOKED,
    },
  });

  await tx.widgetSession.create({
    data: {
      userId,
      gameId,
      tokenHash,
      status: WidgetSessionStatus.ACTIVE,
      expiresAt,
    },
  });

  return { rawToken, userId, gameId, expiresAt };
}

// ---------------------------------------------------------------------------
// Factory: create system ledger accounts
// ---------------------------------------------------------------------------

export interface TestSystemAccounts {
  platformRevenue: { id: string };
  stripeSource: { id: string };
  stripeSink: { id: string };
}

export async function createSystemAccounts(
  tx: TxClient
): Promise<TestSystemAccounts> {
  const platformRevenue = await tx.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.PLATFORM_REVENUE,
      balance: 0,
      currency: "USD",
    },
  });

  const stripeSource = await tx.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.STRIPE_SOURCE,
      balance: 0,
      currency: "USD",
    },
  });

  const stripeSink = await tx.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.STRIPE_SINK,
      balance: 0,
      currency: "USD",
    },
  });

  return {
    platformRevenue: { id: platformRevenue.id },
    stripeSource: { id: stripeSource.id },
    stripeSink: { id: stripeSink.id },
  };
}

// ---------------------------------------------------------------------------
// Factory: fund a player's balance
// ---------------------------------------------------------------------------

export async function fundPlayer(
  tx: TxClient,
  userId: string,
  stripeSourceId: string,
  amountDollars: number | string
): Promise<void> {
  const { getOrCreatePlayerAccount } = await import(
    "../../src/lib/ledger/accounts.js"
  );
  const { transfer } = await import("../../src/lib/ledger/transfer.js");
  const { TransactionType } = await import("../../generated/prisma/client.js");

  const decimalAmount = new Decimal(amountDollars.toString());

  // Prime STRIPE_SOURCE with enough balance
  await tx.$executeRaw`
    UPDATE ledger_accounts
    SET balance = balance + ${decimalAmount}::decimal,
        updated_at = NOW()
    WHERE id = ${stripeSourceId}::uuid
  `;

  const playerAccount = await getOrCreatePlayerAccount(tx, userId);

  await transfer(tx, {
    fromAccountId: stripeSourceId,
    toAccountId: playerAccount.id,
    amount: decimalAmount,
    transactionType: TransactionType.DEPOSIT,
    description: "Test deposit",
    idempotencyKey: `test_deposit_${userId}_${crypto.randomUUID()}`,
  });
}

// ---------------------------------------------------------------------------
// Factory: create a session and return the raw token
// ---------------------------------------------------------------------------

export async function createTestSession(
  tx: TxClient,
  userId: string
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateRandomToken(32);
  const tokenHash = sha256Hash(sessionToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await tx.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { sessionToken, expiresAt };
}

// ---------------------------------------------------------------------------
// callApi: invoke Next.js route handlers directly
// ---------------------------------------------------------------------------

/**
 * Build a Request object and call the specified route handler directly.
 *
 * Since we call route handlers in-process, this bypasses HTTP entirely.
 * For authenticated routes, pass cookies or auth headers in options.
 */
export async function callApi(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    sessionToken?: string;
    apiKey?: string;
    widgetToken?: string;
  } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "127.0.0.1",
    ...(options.headers ?? {}),
  };

  // Authentication helpers
  if (options.sessionToken) {
    headers["cookie"] = `playstake_session=${options.sessionToken}`;
  }
  if (options.apiKey) {
    headers["authorization"] = `Bearer ${options.apiKey}`;
  }
  if (options.widgetToken) {
    headers["authorization"] = `WidgetToken ${options.widgetToken}`;
  }

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (options.body !== undefined && method !== "GET") {
    requestInit.body = JSON.stringify(options.body);
  }

  const url = `http://localhost${path}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = new NextRequest(url, requestInit as any);

  // Dynamic import of the route handler based on the path
  const { handler, params } = await resolveRouteHandler(method, path);
  let response: Response;

  if (params) {
    response = await handler(request, { params: Promise.resolve(params) });
  } else {
    response = await handler(request);
  }

  let body: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

// ---------------------------------------------------------------------------
// Route resolution: maps URL paths to imported handler functions
// ---------------------------------------------------------------------------

interface ResolvedRoute {
  handler: Function;
  params?: Record<string, string>;
}

async function resolveRouteHandler(
  method: string,
  path: string
): Promise<ResolvedRoute> {
  // Auth routes
  if (path === "/api/auth/register") {
    const mod = await import("../../src/app/api/auth/register/route.js");
    return { handler: mod.POST };
  }
  if (path === "/api/auth/login") {
    const mod = await import("../../src/app/api/auth/login/route.js");
    return { handler: mod.POST };
  }
  if (path === "/api/auth/logout") {
    const mod = await import("../../src/app/api/auth/logout/route.js");
    return { handler: mod.POST };
  }

  // Wallet routes
  if (path === "/api/wallet/balance") {
    const mod = await import("../../src/app/api/wallet/balance/route.js");
    return { handler: mod.GET };
  }
  if (path === "/api/wallet/deposit") {
    const mod = await import("../../src/app/api/wallet/deposit/route.js");
    return { handler: mod.POST };
  }
  if (path === "/api/wallet/withdraw") {
    const mod = await import("../../src/app/api/wallet/withdraw/route.js");
    return { handler: mod.POST };
  }
  if (path === "/api/wallet/transactions") {
    const mod = await import(
      "../../src/app/api/wallet/transactions/route.js"
    );
    return { handler: mod.GET };
  }

  // Developer portal routes
  if (path === "/api/developer/register") {
    const mod = await import("../../src/app/api/developer/register/route.js");
    return { handler: mod.POST };
  }
  if (path === "/api/developer/games") {
    const mod = await import("../../src/app/api/developer/games/route.js");
    return { handler: method === "GET" ? mod.GET : mod.POST };
  }
  if (path === "/api/developer/api-keys") {
    const mod = await import("../../src/app/api/developer/api-keys/route.js");
    return { handler: method === "GET" ? mod.GET : mod.POST };
  }
  if (path === "/api/developer/analytics") {
    const mod = await import("../../src/app/api/developer/analytics/route.js");
    return { handler: mod.GET };
  }

  // Developer API key revoke: /api/developer/api-keys/:id
  const devKeyRevokeMatch = path.match(
    /^\/api\/developer\/api-keys\/([a-f0-9-]+)$/
  );
  if (devKeyRevokeMatch) {
    const mod = await import(
      "../../src/app/api/developer/api-keys/[id]/route.js"
    );
    return { handler: mod.DELETE, params: { id: devKeyRevokeMatch[1] } };
  }

  // V1 API routes
  if (path === "/api/v1/widget/auth") {
    const mod = await import("../../src/app/api/v1/widget/auth/route.js");
    return { handler: mod.POST };
  }

  // /api/v1/bets (list or create)
  if (path === "/api/v1/bets") {
    const mod = await import("../../src/app/api/v1/bets/route.js");
    return { handler: method === "GET" ? mod.GET : mod.POST };
  }

  // /api/v1/bets/:betId/consent
  const consentMatch = path.match(
    /^\/api\/v1\/bets\/([a-f0-9-]+)\/consent$/
  );
  if (consentMatch) {
    const mod = await import(
      "../../src/app/api/v1/bets/[betId]/consent/route.js"
    );
    return { handler: mod.POST, params: { betId: consentMatch[1] } };
  }

  // /api/v1/bets/:betId/accept
  const acceptMatch = path.match(
    /^\/api\/v1\/bets\/([a-f0-9-]+)\/accept$/
  );
  if (acceptMatch) {
    const mod = await import(
      "../../src/app/api/v1/bets/[betId]/accept/route.js"
    );
    return { handler: mod.POST, params: { betId: acceptMatch[1] } };
  }

  // /api/v1/bets/:betId/result
  const resultMatch = path.match(
    /^\/api\/v1\/bets\/([a-f0-9-]+)\/result$/
  );
  if (resultMatch) {
    const mod = await import(
      "../../src/app/api/v1/bets/[betId]/result/route.js"
    );
    return { handler: mod.POST, params: { betId: resultMatch[1] } };
  }

  // /api/v1/bets/:betId/widget-result
  const widgetResultMatch = path.match(
    /^\/api\/v1\/bets\/([a-f0-9-]+)\/widget-result$/
  );
  if (widgetResultMatch) {
    const mod = await import(
      "../../src/app/api/v1/bets/[betId]/widget-result/route.js"
    );
    return { handler: mod.POST, params: { betId: widgetResultMatch[1] } };
  }

  // /api/v1/bets/:betId/cancel
  const cancelMatch = path.match(
    /^\/api\/v1\/bets\/([a-f0-9-]+)\/cancel$/
  );
  if (cancelMatch) {
    const mod = await import(
      "../../src/app/api/v1/bets/[betId]/cancel/route.js"
    );
    return { handler: mod.POST, params: { betId: cancelMatch[1] } };
  }

  throw new Error(`No route handler found for ${method} ${path}`);
}

// ---------------------------------------------------------------------------
// Full scenario builder: creates all pieces needed for a bet lifecycle test
// ---------------------------------------------------------------------------

export interface FullScenario {
  developerUser: TestUser & { rawPassword: string };
  developerProfile: TestDeveloperProfile;
  escrowLimit: { id: string; maxTotalEscrow: number; maxSingleBet: number };
  game: TestGame;
  apiKey: TestApiKey;
  playerA: TestUser & { rawPassword: string };
  playerB: TestUser & { rawPassword: string };
  widgetTokenA: TestWidgetToken;
  widgetTokenB: TestWidgetToken;
  systemAccounts: TestSystemAccounts;
}

/**
 * Create a complete scenario: developer with game and API key,
 * two funded players with widget tokens, and system accounts.
 */
export async function createFullScenario(
  tx: TxClient,
  options: {
    playerABalance?: number;
    playerBBalance?: number;
    revSharePercent?: number;
    maxTotalEscrow?: number;
    maxSingleBet?: number;
    platformFeePercent?: number;
  } = {}
): Promise<FullScenario> {
  // System accounts
  const systemAccounts = await createSystemAccounts(tx);

  // Developer
  const developerUser = await createTestUser(tx, { role: "DEVELOPER" });
  const { developerProfile, escrowLimit } = await createTestDeveloperProfile(
    tx,
    developerUser.id,
    {
      revSharePercent: options.revSharePercent ?? 0.02,
      maxTotalEscrow: options.maxTotalEscrow ?? 50000,
      maxSingleBet: options.maxSingleBet ?? 1000,
    }
  );

  // Game
  const game = await createTestGame(tx, developerProfile.id, {
    platformFeePercent: options.platformFeePercent ?? 0.05,
  });

  // API key
  const apiKey = await createTestApiKey(tx, developerProfile.id);

  // Players
  const playerA = await createTestUser(tx, { displayName: "PlayerA" });
  const playerB = await createTestUser(tx, { displayName: "PlayerB" });

  // Fund players
  const balA = options.playerABalance ?? 100;
  const balB = options.playerBBalance ?? 100;
  if (balA > 0) {
    await fundPlayer(tx, playerA.id, systemAccounts.stripeSource.id, balA);
  }
  if (balB > 0) {
    await fundPlayer(tx, playerB.id, systemAccounts.stripeSource.id, balB);
  }

  // Widget tokens
  const widgetTokenA = await createTestWidgetToken(tx, playerA.id, game.id);
  const widgetTokenB = await createTestWidgetToken(tx, playerB.id, game.id);

  return {
    developerUser,
    developerProfile,
    escrowLimit,
    game,
    apiKey,
    playerA,
    playerB,
    widgetTokenA,
    widgetTokenB,
    systemAccounts,
  };
}

// ---------------------------------------------------------------------------
// Helpers: get account balance in dollars
// ---------------------------------------------------------------------------

export async function getPlayerBalance(
  tx: TxClient,
  userId: string
): Promise<Decimal> {
  const account = await tx.ledgerAccount.findUnique({
    where: {
      userId_accountType: {
        userId,
        accountType: LedgerAccountType.PLAYER_BALANCE,
      },
    },
  });
  return account ? new Decimal(account.balance.toString()) : new Decimal(0);
}

export async function getEscrowBalance(
  tx: TxClient,
  betId: string
): Promise<Decimal> {
  const account = await tx.ledgerAccount.findFirst({
    where: {
      betId,
      accountType: LedgerAccountType.ESCROW,
    },
  });
  return account ? new Decimal(account.balance.toString()) : new Decimal(0);
}

export async function getPlatformRevenueBalance(
  tx: TxClient
): Promise<Decimal> {
  const account = await tx.ledgerAccount.findFirst({
    where: {
      accountType: LedgerAccountType.PLATFORM_REVENUE,
      userId: null,
    },
  });
  return account ? new Decimal(account.balance.toString()) : new Decimal(0);
}

export async function getDeveloperBalance(
  tx: TxClient,
  userId: string
): Promise<Decimal> {
  const account = await tx.ledgerAccount.findUnique({
    where: {
      userId_accountType: {
        userId,
        accountType: LedgerAccountType.DEVELOPER_BALANCE,
      },
    },
  });
  return account ? new Decimal(account.balance.toString()) : new Decimal(0);
}

export async function getCurrentEscrowLimit(
  tx: TxClient,
  escrowLimitId: string
): Promise<Decimal> {
  const limit = await tx.developerEscrowLimit.findUniqueOrThrow({
    where: { id: escrowLimitId },
  });
  return new Decimal(limit.currentEscrow.toString());
}
