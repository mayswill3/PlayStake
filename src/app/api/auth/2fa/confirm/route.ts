import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { confirm2FASchema } from "@/lib/validation/schemas";
import * as OTPAuth from "otpauth";
import crypto from "crypto";

export const POST = withSessionAuth(async (req, _context, auth) => {
  // Must have a pending secret
  if (!auth.user.twoFactorSecret) {
    return Response.json(
      { error: "Please initiate 2FA setup first" },
      { status: 400 }
    );
  }

  if (auth.user.twoFactorEnabled) {
    return Response.json(
      { error: "Two-factor authentication is already enabled" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = confirm2FASchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Validate the TOTP code
  const totp = new OTPAuth.TOTP({
    issuer: "PlayStake",
    label: auth.user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(auth.user.twoFactorSecret),
  });

  const delta = totp.validate({ token: parsed.data.code, window: 1 });

  if (delta === null) {
    return Response.json(
      { error: "Invalid verification code. Please try again." },
      { status: 400 }
    );
  }

  // Generate backup codes
  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString("hex")
  );

  // Enable 2FA
  await prisma.user.update({
    where: { id: auth.userId },
    data: { twoFactorEnabled: true },
  });

  return Response.json({
    message: "Two-factor authentication enabled successfully",
    backupCodes,
  });
});
