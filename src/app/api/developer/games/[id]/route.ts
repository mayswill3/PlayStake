import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "../../../../../../generated/prisma/client.js";
import { prisma } from "../../../../../lib/db/client.js";
import { validateSession } from "../../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../../lib/auth/helpers.js";
import { updateGameSchema } from "../../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../../lib/middleware/validate.js";
import { centsToDollars, dollarsToCents } from "../../../../../lib/utils/money.js";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../../lib/errors/index.js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        developerProfile: { select: { userId: true } },
      },
    });

    if (!game) {
      throw new NotFoundError("Game not found");
    }

    // Verify ownership
    if (
      game.developerProfile.userId !== session.userId &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError("You do not own this game");
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        developerProfile: { select: { userId: true } },
      },
    });

    if (!game) {
      throw new NotFoundError("Game not found");
    }

    if (
      game.developerProfile.userId !== session.userId &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError("You do not own this game");
    }

    const body = await request.json();
    const input = validateBody(updateGameSchema, body);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
    if (input.webhookUrl !== undefined) updateData.webhookUrl = input.webhookUrl;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.minBetAmount !== undefined) {
      updateData.minBetAmount = centsToDollars(input.minBetAmount);
    }
    if (input.maxBetAmount !== undefined) {
      updateData.maxBetAmount = centsToDollars(input.maxBetAmount);
    }

    const updated = await prisma.game.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      logoUrl: updated.logoUrl,
      webhookUrl: updated.webhookUrl,
      isActive: updated.isActive,
      minBetAmount: dollarsToCents(updated.minBetAmount),
      maxBetAmount: dollarsToCents(updated.maxBetAmount),
      platformFeePercent: updated.platformFeePercent.toNumber(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
