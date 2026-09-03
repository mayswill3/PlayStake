import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { errorResponse } from "@/lib/errors";
import { reviewSubmission } from "@/lib/kyc/service";
import { sendKycDecisionEmail } from "@/lib/email/resend";
import { adminKycReviewSchema } from "@/lib/validation/schemas";
import { UserRole } from "../../../../../../generated/prisma/client";

export const GET = withRoleGuard([UserRole.ADMIN], async (_req, context) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "Submission ID required" }, { status: 400 });
  }

  const submission = await prisma.kycSubmission.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      legalFirstName: true,
      legalLastName: true,
      dateOfBirth: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
      documentType: true,
      reviewNotes: true,
      reviewedAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          kycStatus: true,
          createdAt: true,
        },
      },
      reviewedBy: { select: { id: true, displayName: true, email: true } },
      // Document bytes are fetched one at a time from the documents endpoint.
      documents: {
        select: { id: true, kind: true, mimeType: true, byteSize: true },
        orderBy: { kind: "asc" },
      },
    },
  });

  if (!submission) {
    return Response.json({ error: "Submission not found" }, { status: 404 });
  }

  return Response.json(submission);
});

export const PATCH = withRoleGuard([UserRole.ADMIN], async (req, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) {
      return Response.json(
        { error: "Submission ID required" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = adminKycReviewSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const approve = parsed.data.decision === "APPROVE";
    const result = await reviewSubmission({
      submissionId: id,
      reviewerId: auth.userId,
      approve,
      reviewNotes: parsed.data.reviewNotes ?? null,
    });

    // A failed notification must not undo a recorded decision.
    try {
      await sendKycDecisionEmail({
        email: result.user.email,
        displayName: result.user.displayName,
        submissionId: result.id,
        approved: approve,
        reviewNotes: result.reviewNotes,
      });
    } catch (emailError) {
      console.error(
        `[KYC] Decision email could not be sent for submission ${result.id}:`,
        emailError,
      );
    }

    return Response.json({
      id: result.id,
      status: result.status,
      reviewedAt: result.reviewedAt,
      reviewNotes: result.reviewNotes,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
