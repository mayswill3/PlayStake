import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import * as OTPAuth from "otpauth";
import { encryptTwoFactorSecret } from "@/lib/auth/two-factor";

export const POST = withSessionAuth(async (_req, _context, auth) => {
  // Don't re-enable if already enabled
  if (auth.user.twoFactorEnabled) {
    return Response.json(
      { error: "Two-factor authentication is already enabled" },
      { status: 400 }
    );
  }

  // Generate a random secret
  const secret = new OTPAuth.Secret({ size: 20 });

  // Create TOTP instance
  const totp = new OTPAuth.TOTP({
    issuer: "PlayStake",
    label: auth.user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      twoFactorSecret: encryptTwoFactorSecret(secret.base32),
      twoFactorLastUsedStep: null,
    },
  });

  return Response.json({
    secret: secret.base32,
    otpauthUri: totp.toString(),
  });
});
