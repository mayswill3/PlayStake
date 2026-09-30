// =============================================================================
// PlayStake — Identity screening at KYC
// =============================================================================
// Run when a customer submits identity documents:
//
//   - the date of birth on the document must match the one they declared at
//     registration; a mismatch opens a DOB_MISMATCH case,
//   - the same person (name + date of birth, or the same document image) on
//     another account opens a SHARED_IDENTITY case — one person, one account,
//     and if that other account is self-excluded, the exclusion is applied to
//     this one too: self-exclusion follows the person, not the account,
//   - GAMSTOP is re-checked now that we know who they are.
//
// Approval of the submission is blocked while either case is open.
// =============================================================================

import { AmlCaseType, PlayBreakType } from "../../../generated/prisma/client";
import { getActiveBreak } from "../responsible-play/service";
import { prisma } from "../db/client";
import { hasOpenAmlCase, raiseAmlCase } from "./aml";
import { refreshGamstopStatusQuietly } from "./gamstop";

const BLOCKING_CASES = [AmlCaseType.DOB_MISMATCH, AmlCaseType.SHARED_IDENTITY];

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function screenKycSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.kycSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: {
      userId: true,
      legalFirstName: true,
      legalLastName: true,
      dateOfBirth: true,
      user: { select: { dateOfBirth: true } },
      documents: { select: { sha256: true } },
    },
  });

  const declared = submission.user.dateOfBirth;
  if (declared && isoDate(declared) !== isoDate(submission.dateOfBirth)) {
    await raiseAmlCase({
      userId: submission.userId,
      type: AmlCaseType.DOB_MISMATCH,
      severity: "medium",
      details: {
        submissionId,
        declaredAtRegistration: isoDate(declared),
        onDocument: isoDate(submission.dateOfBirth),
      },
    });
  }

  const sameIdentity = await prisma.kycSubmission.findMany({
    where: {
      userId: { not: submission.userId },
      OR: [
        {
          legalFirstName: { equals: submission.legalFirstName, mode: "insensitive" },
          legalLastName: { equals: submission.legalLastName, mode: "insensitive" },
          dateOfBirth: submission.dateOfBirth,
        },
        {
          documents: {
            some: { sha256: { in: submission.documents.map((document) => document.sha256) } },
          },
        },
      ],
    },
    select: { userId: true, id: true },
  });
  for (const otherUserId of new Set(sameIdentity.map((match) => match.userId))) {
    const otherBreak = await getActiveBreak(otherUserId);
    if (otherBreak?.type === PlayBreakType.SELF_EXCLUSION) {
      await prisma.playBreak.create({
        data: {
          userId: submission.userId,
          type: PlayBreakType.SELF_EXCLUSION,
          startsAt: new Date(),
          // A lapsed exclusion the customer hasn't returned from still applies.
          endsAt: otherBreak.awaitingReturn ? new Date() : otherBreak.endsAt,
        },
      });
    }
    await raiseAmlCase({
      userId: submission.userId,
      relatedUserId: otherUserId,
      type: AmlCaseType.SHARED_IDENTITY,
      severity: "high",
      details: {
        submissionId,
        otherAccountSelfExcluded: otherBreak?.type === PlayBreakType.SELF_EXCLUSION,
        matchingSubmissionIds: sameIdentity
          .filter((match) => match.userId === otherUserId)
          .map((match) => match.id),
      },
    });
  }

  await refreshGamstopStatusQuietly(submission.userId);
}

/** Whether an identity problem is still open, which blocks KYC approval. */
export function hasBlockingIdentityCase(userId: string): Promise<boolean> {
  return hasOpenAmlCase(userId, BLOCKING_CASES);
}
