import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse } from "../../../../lib/errors/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Validate input but always return 200 to prevent email enumeration
    validateBody(forgotPasswordSchema, body);

    // TODO: In production:
    // 1. Look up the user by email
    // 2. If user exists, generate a signed reset token (JWT or HMAC with expiry)
    // 3. Send the reset link via email service
    // 4. Store the token hash with expiry for verification in reset-password

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
