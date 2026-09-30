import { withRoleGuard } from "@/lib/middleware/auth";
import { UserRole } from "../../../../../generated/prisma/client";
import { listComplaintsForStaff } from "@/lib/complaints/service";

/** GET /api/admin/complaints?status=open|closed|all */
export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  const status = new URL(request.url).searchParams.get("status");
  const scope = status === "closed" || status === "all" ? status : "open";
  return Response.json({ complaints: await listComplaintsForStaff(scope) });
});
