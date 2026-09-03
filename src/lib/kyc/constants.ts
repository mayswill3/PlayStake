import { KycDocumentKind, KycDocumentType } from "../../../generated/prisma/client";

/** Hard ceiling per uploaded file. Phone camera photos land well under this. */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

/** Minimum age to hold a funded PlayStake account. */
export const MINIMUM_AGE_YEARS = 18;

/**
 * Which document images each document type requires. A passport is a single
 * page; licences and national ID cards carry data on both sides.
 */
export const REQUIRED_DOCUMENT_KINDS: Record<
  KycDocumentType,
  KycDocumentKind[]
> = {
  [KycDocumentType.PASSPORT]: [
    KycDocumentKind.DOCUMENT_FRONT,
    KycDocumentKind.SELFIE,
  ],
  [KycDocumentType.DRIVERS_LICENCE]: [
    KycDocumentKind.DOCUMENT_FRONT,
    KycDocumentKind.DOCUMENT_BACK,
    KycDocumentKind.SELFIE,
  ],
  [KycDocumentType.NATIONAL_ID]: [
    KycDocumentKind.DOCUMENT_FRONT,
    KycDocumentKind.DOCUMENT_BACK,
    KycDocumentKind.SELFIE,
  ],
};

/**
 * Leading bytes for each accepted format. A browser-supplied Content-Type is
 * only a hint, so uploads are sniffed before anything is written.
 */
const MAGIC_BYTES: Record<AllowedDocumentMimeType, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // RIFF....WEBP — the 4 size bytes in between are skipped by the matcher.
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
};

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * Detect the real format of an upload, returning null when the bytes do not
 * match any accepted type.
 */
export function sniffMimeType(buffer: Buffer): AllowedDocumentMimeType | null {
  for (const mimeType of ALLOWED_DOCUMENT_MIME_TYPES) {
    for (const signature of MAGIC_BYTES[mimeType]) {
      if (!startsWith(buffer, signature)) continue;
      // RIFF is also used by WAV/AVI, so confirm the WEBP form marker.
      if (mimeType === "image/webp") {
        if (buffer.length < 12 || buffer.toString("ascii", 8, 12) !== "WEBP") {
          continue;
        }
      }
      return mimeType;
    }
  }
  return null;
}

/** Age in whole years on a given reference date. */
export function ageInYears(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}
