import { NextRequest } from "next/server";
import { errorResponse, AuthorizationError } from "@/lib/errors";
import { getRecorderView } from "@/lib/recordings/service";
import { verifyRecorderToken } from "@/lib/recordings/token";

export const dynamic = "force-dynamic";

/** GET /api/recorder/:betId?token= — what the recording view shows. Recorder only. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ betId: string }> }) {
  try {
    const { betId } = await params;
    if (!verifyRecorderToken(betId, new URL(request.url).searchParams.get("token"))) {
      throw new AuthorizationError("Recorder access only");
    }
    return Response.json(await getRecorderView(betId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
