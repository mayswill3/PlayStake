import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { UserRole, LedgerAccountType, BetStatus, BetOutcome } from "../generated/prisma/enums.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

/**
 * Seed the database with essential test data and system accounts.
 *
 * System ledger accounts (PLATFORM_REVENUE, STRIPE_SOURCE, STRIPE_SINK) are
 * singleton accounts with no associated user. They must exist before any
 * transactions can be processed.
 */
async function main() {
  console.log("Seeding PlayStake database...\n");

  // ---------------------------------------------------------------------------
  // 1. Test Player
  // ---------------------------------------------------------------------------
  const player = await prisma.user.upsert({
    where: { email: "player@test.playstake.com" },
    update: {},
    create: {
      email: "player@test.playstake.com",
      passwordHash: hashPassword("TestPlayer123!"),
      role: UserRole.PLAYER,
      displayName: "TestPlayer",
      emailVerified: true,
    },
  });
  console.log(`  Player created:   ${player.id} (${player.email})`);

  // Player balance ledger account — seed with $100 for testing
  const playerBalance = await prisma.ledgerAccount.upsert({
    where: {
      userId_accountType: {
        userId: player.id,
        accountType: LedgerAccountType.PLAYER_BALANCE,
      },
    },
    update: { balance: 100.0 },
    create: {
      userId: player.id,
      accountType: LedgerAccountType.PLAYER_BALANCE,
      balance: 100.0,
      currency: "USD",
    },
  });
  console.log(`  Player ledger:    ${playerBalance.id} ($100.00)`);

  // ---------------------------------------------------------------------------
  // 1b. Test Player B (second player for testing bets)
  // ---------------------------------------------------------------------------
  const playerB = await prisma.user.upsert({
    where: { email: "player2@test.playstake.com" },
    update: {},
    create: {
      email: "player2@test.playstake.com",
      passwordHash: hashPassword("TestPlayer2!"),
      role: UserRole.PLAYER,
      displayName: "TestPlayerB",
      emailVerified: true,
    },
  });
  console.log(`  Player B created: ${playerB.id} (${playerB.email})`);

  // Player B balance ledger account — seed with $100 for testing
  const playerBBalance = await prisma.ledgerAccount.upsert({
    where: {
      userId_accountType: {
        userId: playerB.id,
        accountType: LedgerAccountType.PLAYER_BALANCE,
      },
    },
    update: { balance: 100.0 },
    create: {
      userId: playerB.id,
      accountType: LedgerAccountType.PLAYER_BALANCE,
      balance: 100.0,
      currency: "USD",
    },
  });
  console.log(`  Player B ledger:  ${playerBBalance.id} ($100.00)`);

  // ---------------------------------------------------------------------------
  // 2. Test Developer
  // ---------------------------------------------------------------------------
  const developer = await prisma.user.upsert({
    where: { email: "developer@test.playstake.com" },
    update: {},
    create: {
      email: "developer@test.playstake.com",
      passwordHash: hashPassword("TestDev123!"),
      role: UserRole.DEVELOPER,
      displayName: "TestDeveloper",
      emailVerified: true,
    },
  });
  console.log(`  Developer created: ${developer.id} (${developer.email})`);

  // Developer balance ledger account
  const devBalance = await prisma.ledgerAccount.upsert({
    where: {
      userId_accountType: {
        userId: developer.id,
        accountType: LedgerAccountType.DEVELOPER_BALANCE,
      },
    },
    update: {},
    create: {
      userId: developer.id,
      accountType: LedgerAccountType.DEVELOPER_BALANCE,
      balance: 0,
      currency: "USD",
    },
  });
  console.log(`  Dev ledger:       ${devBalance.id}`);

  // Developer profile
  const devProfile = await prisma.developerProfile.upsert({
    where: { userId: developer.id },
    update: {},
    create: {
      userId: developer.id,
      companyName: "Test Game Studio",
      contactEmail: "developer@test.playstake.com",
      websiteUrl: "https://testgamestudio.example.com",
      revSharePercent: 0.02, // 2% rev share
      isApproved: true,
    },
  });
  console.log(`  Dev profile:      ${devProfile.id}`);

  // ---------------------------------------------------------------------------
  // 3. Developer Escrow Limit
  // ---------------------------------------------------------------------------
  const escrowLimit = await prisma.developerEscrowLimit.upsert({
    where: { developerProfileId: devProfile.id },
    update: {},
    create: {
      developerProfileId: devProfile.id,
      maxTotalEscrow: 50000,
      maxSingleBet: 1000,
      currentEscrow: 0,
      tier: "STARTER",
    },
  });
  console.log(`  Escrow limit:     ${escrowLimit.id} (tier: ${escrowLimit.tier})`);

  // ---------------------------------------------------------------------------
  // 4. Test Game
  // ---------------------------------------------------------------------------
  const demoGames = [
    {
      name: "FPS Scoreboard",
      slug: "fps-scoreboard",
      description: "Team-based shooter with live scoreboard and real-time wagering.",
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      platformFeePercent: 0,
    },
    {
      name: "Higher / Lower",
      slug: "higher-lower",
      description: "Classic card game with turn-based wagering and score tracking.",
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      platformFeePercent: 0,
    },
    {
      name: "Tic-Tac-Toe",
      slug: "tic-tac-toe",
      description: "Classic strategy game with two-player wagering and win detection.",
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      platformFeePercent: 0,
    },
  ];

  const games = [];
  for (const g of demoGames) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: {},
      create: {
        developerProfileId: devProfile.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        isActive: true,
        minBetAmount: g.minBetAmount,
        maxBetAmount: g.maxBetAmount,
        platformFeePercent: g.platformFeePercent,
      },
    });
    games.push(game);
    console.log(`  Game created:     ${game.id} (${game.slug})`);
  }

  // ---------------------------------------------------------------------------
  // 5. Demo Bets (across multiple games)
  // ---------------------------------------------------------------------------
  const now = new Date();
  const demoBets = [
    { gameIdx: 0, amount: 5.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_A_WIN, daysAgo: 4 },
    { gameIdx: 1, amount: 10.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_B_WIN, daysAgo: 3 },
    { gameIdx: 2, amount: 25.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_A_WIN, daysAgo: 3 },
    { gameIdx: 0, amount: 5.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_B_WIN, daysAgo: 2 },
    { gameIdx: 1, amount: 15.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_A_WIN, daysAgo: 2 },
    { gameIdx: 2, amount: 5.00, status: BetStatus.VOIDED, outcome: null, daysAgo: 2 },
    { gameIdx: 0, amount: 20.00, status: BetStatus.MATCHED, outcome: null, daysAgo: 1 },
    { gameIdx: 1, amount: 5.00, status: BetStatus.SETTLED, outcome: BetOutcome.DRAW, daysAgo: 1 },
    { gameIdx: 2, amount: 10.00, status: BetStatus.OPEN, outcome: null, daysAgo: 0 },
    { gameIdx: 0, amount: 50.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_B_WIN, daysAgo: 1 },
    { gameIdx: 1, amount: 5.00, status: BetStatus.CANCELLED, outcome: null, daysAgo: 1 },
    { gameIdx: 2, amount: 30.00, status: BetStatus.SETTLED, outcome: BetOutcome.PLAYER_A_WIN, daysAgo: 5 },
  ];

  let betCount = 0;
  for (const b of demoBets) {
    const game = games[b.gameIdx];
    const createdAt = new Date(now.getTime() - b.daysAgo * 24 * 60 * 60 * 1000);
    const settledAt = b.status === BetStatus.SETTLED ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null;
    const feePercent = Number(game.platformFeePercent);
    const feeAmount = b.status === BetStatus.SETTLED ? +(b.amount * 2 * feePercent).toFixed(2) : null;

    await prisma.bet.create({
      data: {
        gameId: game.id,
        playerAId: player.id,
        playerBId: b.status === BetStatus.OPEN ? null : playerB.id,
        amount: b.amount,
        currency: "USD",
        status: b.status,
        outcome: b.outcome,
        platformFeePercent: feePercent,
        platformFeeAmount: feeAmount,
        expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        playerAConsentedAt: createdAt,
        playerBConsentedAt: b.status === BetStatus.OPEN ? null : createdAt,
        matchedAt: ["MATCHED", "RESULT_REPORTED", "SETTLED"].includes(b.status) ? createdAt : null,
        settledAt,
        cancelledAt: b.status === BetStatus.CANCELLED ? createdAt : null,
        createdAt,
      },
    });
    betCount++;
  }
  console.log(`  Demo bets:        ${betCount} bets across ${games.length} games`);

  // ---------------------------------------------------------------------------
  // 6. System Ledger Accounts (singletons, no userId)
  // ---------------------------------------------------------------------------
  // These use findFirst + create pattern since the unique constraint
  // is on (userId, accountType) and userId is null for system accounts.

  const systemAccounts: { type: LedgerAccountType; label: string }[] = [
    { type: LedgerAccountType.PLATFORM_REVENUE, label: "Platform Revenue" },
    { type: LedgerAccountType.STRIPE_SOURCE, label: "Stripe Source (inbound funds)" },
    { type: LedgerAccountType.STRIPE_SINK, label: "Stripe Sink (outbound funds)" },
  ];

  for (const sa of systemAccounts) {
    const existing = await prisma.ledgerAccount.findFirst({
      where: { accountType: sa.type, userId: null },
    });

    if (!existing) {
      const account = await prisma.ledgerAccount.create({
        data: {
          accountType: sa.type,
          balance: 0,
          currency: "USD",
        },
      });
      console.log(`  System account:   ${account.id} (${sa.label})`);
    } else {
      console.log(`  System account:   ${existing.id} (${sa.label}) [already exists]`);
    }
  }

  console.log("\nSeed completed successfully.");
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
