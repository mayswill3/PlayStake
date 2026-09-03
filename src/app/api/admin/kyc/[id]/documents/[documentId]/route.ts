import { withRoleGuard } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { loadDocumentForReview } from "@/lib/kyc/service";
import { UserRole } from "../../../../../../../../generated/prisma/client";

/**
 * Stream a decrypted identity document to an admin reviewer.
 *
 * Never cached and never proxied through a CDN — the bytes are only ever
 * decrypted for the length of this response.
 */
export const GET = withRoleGuard([UserRole.ADMIN], async (_req, context) => {
  try {
    const submissionId = context?.params?.id;
    const documentId = context?.params?.documentId;
    if (!submissionId || !documentId) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const { bytes, mimeType } = await loadDocumentForReview(
      submissionId,
      documentId,
    );

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, private",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
