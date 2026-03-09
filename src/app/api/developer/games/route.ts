import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "../../../../../generated/prisma/client.js";
import { prisma } from "../../../../lib/db/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { createGameSchema } from "../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { centsToDollars, dollarsToCents } from "../../../../lib/utils/money.js";
import { generateRandomToken } from "../../../../lib/utils/crypto.js";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../lib/errors/index.js";

async function getDeveloperProfile(userId: string) {
  const profile = await prisma.developerProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new NotFoundError(
      "Developer profile not found. Register as a developer first."
    );
  }
  return profile;
}

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    if (
      session.user.role !== UserRole.DEVELOPER &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError("Developer or admin role required");
    }

    const profile = await getDeveloperProfile(session.userId);

    const games = await prisma.game.findMany({
      where: { developerProfileId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    const data = games.map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      logoUrl: game.logoUrl,
      webhookUrl: game.webhookUrl,
      isActive: game.isActive,
      minBetAmount: dollarsToCents(game.minBetAmount),
      maxBetAmount: dollarsToCents(game.maxBetAmount),
      platformFeePercent: game.platformFeePercent.toNumber(),
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    if (
      session.user.role !== UserRole.DEVELOPER &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError("Developer or admin role required");
    }

    const profile = await getDeveloperProfile(session.userId);

    const body = await request.json();
    const input = validateBody(createGameSchema, body);

    // Generate a webhook secret
    const webhookSecret = `whsec_${generateRandomToken(32)}`;

    const game = await prisma.game.create({
      data: {
        developerProfileId: profile.id,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        logoUrl: input.logoUrl ?? null,
        webhookUrl: input.webhookUrl ?? null,
        webhookSecret,
        minBetAmount: input.minBetAmount
          ? centsToDollars(input.minBetAmount)
          : undefined,
        maxBetAmount: input.maxBetAmount
          ? centsToDollars(input.maxBetAmount)
          : undefined,
      },
    });

    return NextResponse.json(
      {
        id: game.id,
        name: game.name,
        slug: game.slug,
        description: game.description,
        logoUrl: game.logoUrl,
        webhookUrl: game.webhookUrl,
        webhookSecret, // Returned only on creation
        isActive: game.isActive,
        minBetAmount: dollarsToCents(game.minBetAmount),
        maxBetAmount: dollarsToCents(game.maxBetAmount),
        platformFeePercent: game.platformFeePercent.toNumber(),
        createdAt: game.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
