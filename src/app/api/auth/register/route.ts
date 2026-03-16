import { NextRequest, NextResponse } from "next/server";
import { prisma, withTransaction } from "../../../../lib/db/client";
import { hashPassword, validatePasswordStrength } from "../../../../lib/auth/password";
import { getOrCreatePlayerAccount } from "../../../../lib/ledger/accounts";
import { registerSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse, ValidationError, ConflictError } from "../../../../lib/errors/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateBody(registerSchema, body);

    // Validate password strength
    const strength = validatePasswordStrength(input.password);
    if (!strength.valid) {
      throw new ValidationError("Password too weak", strength.errors);
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user and player balance account in a transaction
    const user = await withTransaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      });

      // Create the PLAYER_BALANCE ledger account
      await getOrCreatePlayerAccount(tx, newUser.id);

      // TODO: Send verification email
      // In production, generate a signed token and send via email service.
      // For now, the user is created with emailVerified = false.

      return newUser;
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
