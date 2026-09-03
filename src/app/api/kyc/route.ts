import { withSessionAuth } from "@/lib/middleware/auth";
import { kycSubmissionRateLimit } from "@/lib/middleware/rate-limit";
import { kycSubmissionSchema } from "@/lib/validation/schemas";
import { errorResponse, ValidationError } from "@/lib/errors";
import { getKycState, submitKyc } from "@/lib/kyc/service";
import type { KycDocumentUpload } from "@/lib/kyc/service";
import { MAX_DOCUMENT_BYTES } from "@/lib/kyc/constants";
import {
  KycDocumentKind,
  KycDocumentType,
} from "../../../../generated/prisma/client";

export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return Response.json(await getKycState(auth.userId));
  } catch (error) {
    return errorResponse(error);
  }
});

const UPLOAD_FIELDS: Array<{ field: string; kind: KycDocumentKind }> = [
  { field: "documentFront", kind: KycDocumentKind.DOCUMENT_FRONT },
  { field: "documentBack", kind: KycDocumentKind.DOCUMENT_BACK },
  { field: "selfie", kind: KycDocumentKind.SELFIE },
];

export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const limited = kycSubmissionRateLimit(request);
    if (limited) return limited;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Expected a multipart/form-data upload");
    }

    const fields = Object.fromEntries(
      Object.entries({
        legalFirstName: form.get("legalFirstName"),
        legalLastName: form.get("legalLastName"),
        dateOfBirth: form.get("dateOfBirth"),
        addressLine1: form.get("addressLine1"),
        addressLine2: form.get("addressLine2"),
        city: form.get("city"),
        region: form.get("region"),
        postalCode: form.get("postalCode"),
        country: form.get("country"),
        documentType: form.get("documentType"),
      }).filter(([, value]) => value !== null),
    );

    const parsed = kycSubmissionSchema.safeParse(fields);
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid verification details",
        parsed.error.flatten().fieldErrors,
      );
    }

    const uploads: KycDocumentUpload[] = [];
    for (const { field, kind } of UPLOAD_FIELDS) {
      const value = form.get(field);
      if (!value) continue;
      if (!(value instanceof File)) {
        throw new ValidationError(`${field} must be a file`);
      }
      // Reject oversized files before buffering them into memory.
      if (value.size > MAX_DOCUMENT_BYTES) {
        throw new ValidationError(
          `${field} exceeds the ${Math.floor(
            MAX_DOCUMENT_BYTES / (1024 * 1024),
          )}MB limit`,
        );
      }
      uploads.push({
        kind,
        bytes: Buffer.from(await value.arrayBuffer()),
      });
    }

    const submission = await submitKyc(
      auth.userId,
      {
        legalFirstName: parsed.data.legalFirstName,
        legalLastName: parsed.data.legalLastName,
        dateOfBirth: new Date(`${parsed.data.dateOfBirth}T00:00:00Z`),
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 || null,
        city: parsed.data.city,
        region: parsed.data.region || null,
        postalCode: parsed.data.postalCode,
        country: parsed.data.country,
        documentType: parsed.data.documentType as KycDocumentType,
      },
      uploads,
    );

    return Response.json(submission, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
