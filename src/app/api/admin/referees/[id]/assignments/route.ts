import { UserRole } from "@/../generated/prisma/client";
import { withRoleGuard } from "@/lib/middleware/auth";
import { ADMIN_HISTORY_LIMIT, listRefereeHistoryForAdmin } from "@/lib/referees/admin-history";

/** A referee's assignment history with decision notes and audit trail. */
export const GET = withRoleGuard([UserRole.ADMIN], async (_request, context) => {
  const id = context.params?.id;
  if (!id) return Response.json({ error: "Referee profile ID required" }, { status: 400 });

  const history = await listRefereeHistoryForAdmin(id);
  if (!history) {
    return Response.json({ error: "Referee profile not found" }, { status: 404 });
  }
  return Response.json({ ...history, limit: ADMIN_HISTORY_LIMIT });
});
