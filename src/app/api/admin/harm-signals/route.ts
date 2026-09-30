import { withRoleGuard } from "@/lib/middleware/auth";
import { PlayerRiskStatus, UserRole } from "../../../../../generated/prisma/client";
import { listSignalsForStaff } from "@/lib/responsible-play/interaction";

/** GET /api/admin/harm-signals?status=OPEN|REVIEWED|DISMISSED|all */
export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  const status = new URL(request.url).searchParams.get("status");
  const scope =
    status === "all" || status === "REVIEWED" || status === "DISMISSED"
      ? (status as PlayerRiskStatus | "all")
      : PlayerRiskStatus.OPEN;
  return Response.json({ signals: await listSignalsForStaff(scope) });
});
