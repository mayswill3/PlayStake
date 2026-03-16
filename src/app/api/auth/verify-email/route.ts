import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { verifyEmailSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse, AppError } from "../../../../lib/errors/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateBody(verifyEmailSchema, body);

    // TODO: In production, verify a signed JWT or HMAC token that encodes
    // the user ID and expiry. For now, we treat the token as the user ID
    // directly (stub implementation).

    const user = await prisma.user.findUnique({
      where: { id: input.token },
    });

    if (!user) {
      throw new AppError("Invalid or expired token", 400, "INVALID_TOKEN");
    }

    if (user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
