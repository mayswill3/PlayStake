import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "../../../../../generated/prisma/client.js";
import { prisma } from "../../../../lib/db/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { createApiKeySchema } from "../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { generateRandomToken, sha256Hash } from "../../../../lib/utils/crypto.js";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../lib/errors/index.js";

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

    const profile = await prisma.developerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!profile) {
      throw new NotFoundError("Developer profile not found");
    }

    const keys = await prisma.apiKey.findMany({
      where: {
        developerProfileId: profile.id,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const data = keys.map((key) => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      label: key.label,
      permissions: key.permissions,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      expiresAt: key.expiresAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
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

    const profile = await prisma.developerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!profile) {
      throw new NotFoundError("Developer profile not found");
    }

    const body = await request.json();
    const input = validateBody(createApiKeySchema, body);

    // Generate the API key
    const keyPrefix = "ps_live_";
    const rawKeyBody = generateRandomToken(32);
    const rawKey = `${keyPrefix}${rawKeyBody}`;
    const keyHash = sha256Hash(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        developerProfileId: profile.id,
        keyPrefix,
        keyHash,
        label: input.label,
        permissions: input.permissions,
      },
    });

    // The raw key is returned ONCE and never again
    return NextResponse.json(
      {
        id: apiKey.id,
        key: rawKey,
        keyPrefix: apiKey.keyPrefix,
        label: apiKey.label,
        permissions: apiKey.permissions,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
