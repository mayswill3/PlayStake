import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "../../../../../../generated/prisma/client.js";
import { prisma } from "../../../../../lib/db/client.js";
import { validateSession } from "../../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../../lib/auth/helpers.js";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "../../../../../lib/errors/index.js";

export async function DELETE(
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

    const profile = await prisma.developerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!profile) {
      throw new NotFoundError("Developer profile not found");
    }

    // Find the API key and verify ownership
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    if (
      apiKey.developerProfileId !== profile.id &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError("You do not own this API key");
    }

    if (apiKey.revokedAt) {
      return NextResponse.json({ ok: true, message: "API key already revoked" });
    }

    // Revoke the key
    await prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
