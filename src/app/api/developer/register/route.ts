import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "../../../../../generated/prisma/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { withTransaction } from "../../../../lib/db/client";
import { developerRegisterSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import {
  errorResponse,
  AuthenticationError,
  ConflictError,
} from "../../../../lib/errors/index";

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const body = await request.json();
    const input = validateBody(developerRegisterSchema, body);

    // Check if user already has a developer profile
    const result = await withTransaction(async (tx) => {
      const existing = await tx.developerProfile.findUnique({
        where: { userId: session.userId },
      });

      if (existing) {
        throw new ConflictError("You already have a developer profile");
      }

      // Create developer profile
      const profile = await tx.developerProfile.create({
        data: {
          userId: session.userId,
          companyName: input.companyName,
          websiteUrl: input.websiteUrl ?? null,
          contactEmail: input.contactEmail,
        },
      });

      // Create developer escrow limit with default values
      await tx.developerEscrowLimit.create({
        data: {
          developerProfileId: profile.id,
        },
      });

      // Upgrade user role to DEVELOPER
      await tx.user.update({
        where: { id: session.userId },
        data: { role: UserRole.DEVELOPER },
      });

      return profile;
    });

    return NextResponse.json(
      {
        developerProfileId: result.id,
        isApproved: result.isApproved,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
