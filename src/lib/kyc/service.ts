import {
  KycDocumentKind,
  KycDocumentType,
  KycStatus,
  KycSubmissionStatus,
} from "../../../generated/prisma/client";
import { prisma, withTransaction } from "../db/client";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { decryptDocument, encryptDocument, hashDocument } from "./crypto";
import {
  MAX_DOCUMENT_BYTES,
  MINIMUM_AGE_YEARS,
  REQUIRED_DOCUMENT_KINDS,
  ageInYears,
  sniffMimeType,
} from "./constants";

export interface KycDocumentUpload {
  kind: KycDocumentKind;
  bytes: Buffer;
}

export interface SubmitKycInput {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: Date;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  documentType: KycDocumentType;
}

// ---------------------------------------------------------------------------
// Player-facing
// ---------------------------------------------------------------------------

/**
 * Record a verification packet and move the user to PENDING.
 *
 * Documents are encrypted before they touch the database, so the plaintext
 * bytes never outlive this call.
 */
export async function submitKyc(
  userId: string,
  input: SubmitKycInput,
  uploads: KycDocumentUpload[],
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, kycStatus: true, emailVerified: true },
  });
  if (!user) throw new NotFoundError("User not found");

  if (user.kycStatus === KycStatus.VERIFIED) {
    throw new ConflictError("Your identity is already verified");
  }
  if (user.kycStatus === KycStatus.PENDING) {
    throw new ConflictError(
      "You already have a verification under review. Wait for a decision before submitting again.",
    );
  }
  if (!user.emailVerified) {
    throw new ConflictError(
      "Verify your email address before submitting identity documents",
    );
  }

  if (ageInYears(input.dateOfBirth) < MINIMUM_AGE_YEARS) {
    throw new ValidationError(
      `You must be at least ${MINIMUM_AGE_YEARS} to hold a funded PlayStake account`,
    );
  }

  const required = REQUIRED_DOCUMENT_KINDS[input.documentType];
  const provided = new Set(uploads.map((upload) => upload.kind));

  if (provided.size !== uploads.length) {
    throw new ValidationError("Each document may only be uploaded once");
  }
  for (const kind of required) {
    if (!provided.has(kind)) {
      throw new ValidationError(`Missing required document: ${kind}`);
    }
  }
  for (const kind of provided) {
    if (!required.includes(kind)) {
      throw new ValidationError(
        `${kind} is not accepted for a ${input.documentType} submission`,
      );
    }
  }

  const documents = uploads.map((upload) => {
    if (upload.bytes.length === 0) {
      throw new ValidationError(`${upload.kind} is empty`);
    }
    if (upload.bytes.length > MAX_DOCUMENT_BYTES) {
      throw new ValidationError(
        `${upload.kind} exceeds the ${Math.floor(
          MAX_DOCUMENT_BYTES / (1024 * 1024),
        )}MB limit`,
      );
    }

    // Trust the bytes, not the browser-supplied Content-Type.
    const mimeType = sniffMimeType(upload.bytes);
    if (!mimeType) {
      throw new ValidationError(
        `${upload.kind} must be a JPEG, PNG, WebP or PDF file`,
      );
    }

    const blob = encryptDocument(upload.bytes);
    return {
      kind: upload.kind,
      mimeType,
      byteSize: upload.bytes.length,
      sha256: hashDocument(upload.bytes),
      // Prisma's Bytes maps to Uint8Array; copy out of the Buffer view.
      ciphertext: new Uint8Array(blob.ciphertext),
      iv: new Uint8Array(blob.iv),
      authTag: new Uint8Array(blob.authTag),
    };
  });

  return withTransaction(async (tx) => {
    const submission = await tx.kycSubmission.create({
      data: {
        userId,
        status: KycSubmissionStatus.PENDING,
        legalFirstName: input.legalFirstName,
        legalLastName: input.legalLastName,
        dateOfBirth: input.dateOfBirth,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city: input.city,
        region: input.region ?? null,
        postalCode: input.postalCode,
        country: input.country.toUpperCase(),
        documentType: input.documentType,
        documents: { create: documents },
      },
      select: { id: true, status: true, createdAt: true },
    });

    await tx.user.update({
      where: { id: userId },
      data: { kycStatus: KycStatus.PENDING },
    });

    return submission;
  });
}

/** Everything the player's verification screen needs to render. */
export async function getKycState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true, emailVerified: true },
  });
  if (!user) throw new NotFoundError("User not found");

  const submission = await prisma.kycSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      documentType: true,
      reviewNotes: true,
      reviewedAt: true,
      createdAt: true,
      documents: { select: { kind: true }, orderBy: { kind: "asc" } },
    },
  });

  return {
    kycStatus: user.kycStatus,
    emailVerified: user.emailVerified,
    // A rejected packet can be replaced; a pending or approved one cannot.
    canSubmit:
      user.emailVerified &&
      user.kycStatus !== KycStatus.PENDING &&
      user.kycStatus !== KycStatus.VERIFIED,
    submission: submission
      ? {
          ...submission,
          documents: submission.documents.map((document) => document.kind),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

export interface ReviewSubmissionInput {
  submissionId: string;
  reviewerId: string;
  approve: boolean;
  reviewNotes?: string | null;
}

/**
 * Apply an admin decision. Updates the submission and the denormalised
 * `User.kycStatus` the money paths gate on, in one transaction.
 */
export async function reviewSubmission(input: ReviewSubmissionInput) {
  return withTransaction(async (tx) => {
    const submission = await tx.kycSubmission.findUnique({
      where: { id: input.submissionId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { email: true, displayName: true } },
      },
    });
    if (!submission) throw new NotFoundError("Submission not found");

    if (submission.status !== KycSubmissionStatus.PENDING) {
      throw new ConflictError(
        `Submission has already been ${submission.status.toLowerCase()}`,
      );
    }
    if (!input.approve && !input.reviewNotes?.trim()) {
      throw new ValidationError("A rejection must include a reason");
    }

    const updated = await tx.kycSubmission.update({
      where: { id: submission.id },
      data: {
        status: input.approve
          ? KycSubmissionStatus.APPROVED
          : KycSubmissionStatus.REJECTED,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes?.trim() || null,
      },
      select: { id: true, status: true, reviewedAt: true, reviewNotes: true },
    });

    await tx.user.update({
      where: { id: submission.userId },
      data: {
        kycStatus: input.approve ? KycStatus.VERIFIED : KycStatus.REJECTED,
      },
    });

    return { ...updated, user: submission.user };
  });
}

/**
 * Decrypt a stored document for an admin reviewer. Kept out of the list and
 * detail payloads so document bytes are only ever fetched deliberately.
 */
export async function loadDocumentForReview(
  submissionId: string,
  documentId: string,
) {
  const document = await prisma.kycDocument.findFirst({
    where: { id: documentId, submissionId },
    select: {
      mimeType: true,
      sha256: true,
      ciphertext: true,
      iv: true,
      authTag: true,
    },
  });
  if (!document) throw new NotFoundError("Document not found");

  const bytes = decryptDocument({
    ciphertext: Buffer.from(document.ciphertext),
    iv: Buffer.from(document.iv),
    authTag: Buffer.from(document.authTag),
  });

  if (hashDocument(bytes) !== document.sha256) {
    throw new ConflictError("Stored document failed its integrity check");
  }

  return { bytes, mimeType: document.mimeType };
}
