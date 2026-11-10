// =============================================================================
// PlayStake — Verified customers updating their address
// =============================================================================
// A verified customer who moves proves the new address with a Didit check
// (DIDIT_ADDRESS_WORKFLOW_ID, a proof-of-address-only workflow, if set;
// otherwise the normal workflow). The check is an ADDRESS_UPDATE submission:
// it carries the verified identity forward and only the address changes. The
// customer stays verified throughout; their latest approved submission is
// what the GB residency check reads, so an approved new address takes effect
// immediately, and earlier addresses stay on record.
// =============================================================================

import { KycStatus, KycSubmissionPurpose, KycSubmissionStatus, KycProvider } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { AppError, ConflictError } from "../errors";
import { appUrl } from "../email/layout";
import { createDiditSession, isDiditEnabled } from "./didit";
import { isGreatBritainAddress } from "./constants";

async function currentApproved(userId: string) {
  return prisma.kycSubmission.findFirst({
    where: { userId, status: KycSubmissionStatus.APPROVED },
    orderBy: { reviewedAt: "desc" },
    select: {
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
      reviewedAt: true,
    },
  });
}

/** The verified address, and any address update in progress or just decided. */
export async function getAddressStatus(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { kycStatus: true } });
  const current = await currentApproved(userId);
  const latestUpdate = await prisma.kycSubmission.findFirst({
    where: { userId, purpose: KycSubmissionPurpose.ADDRESS_UPDATE },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, reviewedAt: true, reviewNotes: true },
  });
  return {
    verified: user.kycStatus === KycStatus.VERIFIED,
    canUpdate: user.kycStatus === KycStatus.VERIFIED && Boolean(current) && isDiditEnabled() && latestUpdate?.status !== KycSubmissionStatus.PENDING,
    current: current
      ? {
          addressLine1: current.addressLine1,
          addressLine2: current.addressLine2,
          city: current.city,
          postalCode: current.postalCode,
          country: current.country,
          inGreatBritain: isGreatBritainAddress(current.country, current.postalCode),
          since: current.reviewedAt?.toISOString() ?? null,
        }
      : null,
    update: latestUpdate
      ? {
          status: latestUpdate.status,
          startedAt: latestUpdate.createdAt.toISOString(),
          decidedAt: latestUpdate.reviewedAt?.toISOString() ?? null,
          notes: latestUpdate.status === KycSubmissionStatus.REJECTED ? latestUpdate.reviewNotes : null,
        }
      : null,
  };
}

/** Start a Didit proof-of-address check for a verified customer. Returns Didit's page. */
export async function startAddressUpdate(userId: string): Promise<{ url: string }> {
  if (!isDiditEnabled()) {
    throw new AppError("Address updates aren't available online right now. Email support@playstake.org.", 503, "DIDIT_DISABLED");
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, kycStatus: true } });
  if (user.kycStatus !== KycStatus.VERIFIED) throw new ConflictError("Verify your identity first; your address is checked as part of that.");
  const current = await currentApproved(userId);
  if (!current) throw new ConflictError("We couldn't find your verified details. Email support@playstake.org.");
  const pending = await prisma.kycSubmission.findFirst({
    where: { userId, purpose: KycSubmissionPurpose.ADDRESS_UPDATE, status: KycSubmissionStatus.PENDING },
    select: { id: true, createdAt: true },
  });
  // Allow a fresh attempt if an earlier one was abandoned on Didit's page.
  if (pending && Date.now() - pending.createdAt.getTime() < 30 * 60 * 1000) {
    throw new ConflictError("Your address update is already in progress. Finish it on Didit, or try again in 30 minutes.");
  }
  if (pending) {
    await prisma.kycSubmission.update({
      where: { id: pending.id },
      data: { status: KycSubmissionStatus.REJECTED, reviewedAt: new Date(), reviewNotes: "Abandoned; a new address update was started." },
    });
  }

  const session = await createDiditSession({
    userId: user.id,
    email: user.email,
    callbackUrl: appUrl("/verification"),
    workflowId: process.env.DIDIT_ADDRESS_WORKFLOW_ID || undefined,
  });

  // Identity carried forward from the verified record; the address is filled
  // in from Didit's proof of address when the result arrives.
  await prisma.kycSubmission.create({
    data: {
      userId: user.id,
      purpose: KycSubmissionPurpose.ADDRESS_UPDATE,
      status: KycSubmissionStatus.PENDING,
      provider: KycProvider.DIDIT,
      providerSessionId: session.sessionId,
      legalFirstName: current.legalFirstName,
      legalLastName: current.legalLastName,
      dateOfBirth: current.dateOfBirth,
      documentType: current.documentType,
      addressLine1: current.addressLine1,
      addressLine2: current.addressLine2,
      city: current.city,
      region: current.region,
      postalCode: current.postalCode,
      country: current.country,
    },
  });
  return { url: session.url };
}
