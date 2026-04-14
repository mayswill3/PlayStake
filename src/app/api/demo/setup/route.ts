import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { generateWidgetToken } from "../../../../lib/auth/widget-token";
import { generateRandomToken, sha256Hash } from "../../../../lib/utils/crypto";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";
import { UserRole, LedgerAccountType } from "../../../../../generated/prisma/client";

const DEMO_DEV_EMAIL = "system-demo@playstake.internal";

type DemoGameType = 'cards' | 'tictactoe';

const DEMO_GAMES: Record<DemoGameType, { slug: string; name: string; description: string }> = {
  cards: {
    slug: "higher-lower",
    name: "Higher / Lower",
    description: "Classic card game with turn-based wagering and score tracking.",
  },
  tictactoe: {
    slug: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    description: "Classic strategy game with two-player wagering and win detection.",
  },
};

/**
 * POST /api/demo/setup
 *
 * Uses the current user's session to set up everything needed for a demo game:
 * - Ensures a system "Demo" developer profile + game exist
 * - Ensures the current user has a PLAYER_BALANCE ledger account
 * - Creates a fresh API key for the demo
 * - Generates a widget token for the current user
 *
 * Returns { playerId, apiKey, gameId, widgetToken }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate current user via session cookie
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError("Please log in to play demo games");

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Session expired — please log in again");

    const playerId = session.userId;

    // 2. Parse gameType from request body
    const body = await request.json().catch(() => ({}));
    const gameType: DemoGameType = body.gameType && body.gameType in DEMO_GAMES ? body.gameType : 'tictactoe';

    // 3. Ensure system demo developer + game exist (upsert pattern)
    const { gameId, developerProfileId } = await ensureDemoGame(gameType);

    // 3. Ensure the player has a PLAYER_BALANCE ledger account
    await prisma.ledgerAccount.upsert({
      where: {
        userId_accountType: {
          userId: playerId,
          accountType: LedgerAccountType.PLAYER_BALANCE,
        },
      },
      update: {},
      create: {
        userId: playerId,
        accountType: LedgerAccountType.PLAYER_BALANCE,
        balance: 0,
        currency: "USD",
      },
    });

    // 4. Create a temporary API key for this demo session
    const keyPrefix = "ps_demo_";
    const rawKeyBody = generateRandomToken(32);
    const rawKey = `${keyPrefix}${rawKeyBody}`;
    const keyHash = sha256Hash(rawKey);

    await prisma.apiKey.create({
      data: {
        developerProfileId,
        keyPrefix,
        keyHash,
        label: `demo-${playerId.slice(0, 8)}-${Date.now()}`,
        permissions: ["bet:create", "bet:read", "result:report", "webhook:manage", "widget:auth"],
      },
    });

    // 5. Generate widget token for the current player
    const { widgetToken } = await generateWidgetToken(gameId, playerId, developerProfileId);

    return NextResponse.json({
      playerId,
      apiKey: rawKey,
      gameId,
      widgetToken,
      displayName: session.user.displayName,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Ensures the system demo developer user, profile, and game exist.
 * Uses upsert to be idempotent across deploys.
 */
async function ensureDemoGame(gameType: DemoGameType): Promise<{ gameId: string; developerProfileId: string }> {
  const gameConfig = DEMO_GAMES[gameType];

  // Check if this demo game already exists
  const existingGame = await prisma.game.findUnique({
    where: { slug: gameConfig.slug },
    select: { id: true, developerProfileId: true },
  });

  if (existingGame) {
    // Ensure fee is 0 for demo games
    await prisma.game.update({
      where: { id: existingGame.id },
      data: { platformFeePercent: 0 },
    });
    return { gameId: existingGame.id, developerProfileId: existingGame.developerProfileId };
  }

  // Create the system demo developer user + profile + game in a transaction
  return prisma.$transaction(async (tx) => {
    // Create or find system developer user
    let devUser = await tx.user.findUnique({ where: { email: DEMO_DEV_EMAIL } });
    if (!devUser) {
      devUser = await tx.user.create({
        data: {
          email: DEMO_DEV_EMAIL,
          passwordHash: sha256Hash(generateRandomToken(64)), // random, unguessable
          role: UserRole.DEVELOPER,
          displayName: "PlayStake Demo",
          emailVerified: true,
        },
      });
    }

    // Create developer profile
    let profile = await tx.developerProfile.findUnique({ where: { userId: devUser.id } });
    if (!profile) {
      profile = await tx.developerProfile.create({
        data: {
          userId: devUser.id,
          companyName: "PlayStake",
          contactEmail: DEMO_DEV_EMAIL,
          revSharePercent: 0,
          isApproved: true,
        },
      });
    }

    // Create demo game
    const game = await tx.game.create({
      data: {
        developerProfileId: profile.id,
        name: gameConfig.name,
        slug: gameConfig.slug,
        description: gameConfig.description,
        isActive: true,
        maxBetAmount: 500,
        minBetAmount: 1,
        platformFeePercent: 0,
      },
    });

    // Create system ledger accounts if they don't exist
    for (const accountType of [
      LedgerAccountType.PLATFORM_REVENUE,
      LedgerAccountType.STRIPE_SOURCE,
      LedgerAccountType.STRIPE_SINK,
    ]) {
      const existing = await tx.ledgerAccount.findFirst({ where: { accountType, userId: null, betId: null } });
      if (!existing) {
        await tx.ledgerAccount.create({
          data: { accountType, balance: 0, currency: "USD" },
        });
      }
    }

    return { gameId: game.id, developerProfileId: profile.id };
  });
}
