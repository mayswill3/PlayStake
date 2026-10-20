import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { updateProfileSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";
import { changeUsername, generateUsername, nextUsernameChangeAt } from "../../../../lib/users/username";
import type { User } from "../../../../../generated/prisma/client";

function profileJson(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    usernameChangeAvailableAt: nextUsernameChangeAt(user.usernameChangedAt)?.toISOString() ?? null,
    discoverable: user.discoverable,
    avatarUrl: user.avatarUrl,
    role: user.role,
    kycStatus: user.kycStatus,
    emailVerified: user.emailVerified,
    emailNotifications: user.emailNotifications,
    marketingConsent: user.marketingConsent,
    followLiveEmails: user.followLiveEmails,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    let user = session.user as User;
    // Accounts made before usernames existed, or by a path that skips them.
    if (!user.username) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username: await generateUsername(prisma, user.displayName) },
      });
    }

    return NextResponse.json(profileJson(user));
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
    if (input.emailNotifications !== undefined) {
      updateData.emailNotifications = input.emailNotifications;
    }
    if (input.marketingConsent !== undefined) {
      updateData.marketingConsent = input.marketingConsent;
      updateData.marketingConsentAt = input.marketingConsent ? new Date() : null;
    }
    if (input.followLiveEmails !== undefined) updateData.followLiveEmails = input.followLiveEmails;
    if (input.discoverable !== undefined) updateData.discoverable = input.discoverable;
    if (input.username !== undefined) await changeUsername(session.userId, input.username);

    const updated =
      Object.keys(updateData).length === 0
        ? await prisma.user.findUniqueOrThrow({ where: { id: session.userId } })
        : await prisma.user.update({ where: { id: session.userId }, data: updateData });

    return NextResponse.json(profileJson(updated));
  } catch (error) {
    return errorResponse(error);
  }
}
