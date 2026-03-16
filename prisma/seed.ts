import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { UserRole, LedgerAccountType } from "../generated/prisma/enums.js";
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

  // Player balance ledger account
  const playerBalance = await prisma.ledgerAccount.upsert({
    where: {
      userId_accountType: {
        userId: player.id,
        accountType: LedgerAccountType.PLAYER_BALANCE,
      },
    },
    update: {},
    create: {
      userId: player.id,
      accountType: LedgerAccountType.PLAYER_BALANCE,
      balance: 0,
      currency: "USD",
    },
  });
  console.log(`  Player ledger:    ${playerBalance.id}`);

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
  const game = await prisma.game.upsert({
    where: { slug: "test-battle-arena" },
    update: {},
    create: {
      developerProfileId: devProfile.id,
      name: "Test Battle Arena",
      slug: "test-battle-arena",
      description: "A test game for local development and integration testing.",
      isActive: true,
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      platformFeePercent: 0.05, // 5%
    },
  });
  console.log(`  Game created:     ${game.id} (${game.slug})`);

  // ---------------------------------------------------------------------------
  // 5. System Ledger Accounts (singletons, no userId)
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
