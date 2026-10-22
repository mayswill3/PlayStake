import { withSessionAuth } from "@/lib/middleware/auth";
import { kycSubmissionRateLimit } from "@/lib/middleware/rate-limit";
import { AppError, ConflictError, errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import { KycStatus } from "../../../../../generated/prisma/client";
import { appUrl } from "@/lib/email/layout";
import { createDiditSession, isDiditEnabled } from "@/lib/kyc/didit";

/** POST /api/kyc/didit — start a Didit check and return the page to send the player to. */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    if (!isDiditEnabled()) throw new AppError("Online verification isn't available right now. Upload your documents instead.", 503, "DIDIT_DISABLED");
    const limited = kycSubmissionRateLimit(request);
    if (limited) return limited;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, email: true, emailVerified: true, kycStatus: true, dateOfBirth: true },
    });
    if (!user.emailVerified) throw new ConflictError("Verify your email address before verifying your identity");
    if (user.kycStatus === KycStatus.VERIFIED) throw new ConflictError("Your identity is already verified");
    if (user.kycStatus === KycStatus.PENDING) {
      throw new ConflictError("Your verification is already under review. We'll email you when there's a decision.");
    }

    const session = await createDiditSession({
      userId: user.id,
      email: user.email,
      callbackUrl: appUrl("/verification"),
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    });
    return Response.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.name === "DiditApiError") {
      console.error("[KYC] Didit session could not be created:", error.message);
      return Response.json(
        { error: "Online verification isn't available right now. Try again shortly, or upload your documents instead." },
        { status: 503 },
      );
    }
    return errorResponse(error);
  }
});
