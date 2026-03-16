import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken, sanitizeUser } from "../../../../lib/auth/helpers";
import { updateProfileSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const user = session.user;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      kycStatus: user.kycStatus,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const body = await request.json();
    const input = validateBody(updateProfileSchema, body);

    // Build update data from non-undefined fields
    const updateData: Record<string, unknown> = {};
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(sanitizeUser(session.user as any));
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      kycStatus: updated.kycStatus,
      emailVerified: updated.emailVerified,
      twoFactorEnabled: updated.twoFactorEnabled,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
