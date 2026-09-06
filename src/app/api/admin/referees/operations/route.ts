import { withRoleGuard } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import {
  MIN_DECISIONS_FOR_RATE,
  getRefereeCapacity,
  getRefereePerformance,
} from "@/lib/referees/metrics";
import { UserRole } from "../../../../../../generated/prisma/client";

/** Coverage and decision-quality view behind referee operations. */
export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  try {
    const windowParam = new URL(request.url).searchParams.get("windowDays");
    const parsed = Number(windowParam);
    const windowDays =
      Number.isInteger(parsed) && parsed >= 1 && parsed <= 90 ? parsed : 7;

    const [capacity, performance] = await Promise.all([
      getRefereeCapacity(windowDays),
      getRefereePerformance(),
    ]);

    return Response.json({
      capacity,
      performance,
      minDecisionsForRate: MIN_DECISIONS_FOR_RATE,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
