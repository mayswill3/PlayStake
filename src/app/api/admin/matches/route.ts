import { withRoleGuard } from "@/lib/middleware/auth";
import { UserRole } from "../../../../../generated/prisma/client";
import { listMatchesForAdmin } from "@/lib/recordings/admin-access";

/** GET /api/admin/matches?search=&userId= — recent refereed matches. */
export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  const params = new URL(request.url).searchParams;
  const matches = await listMatchesForAdmin({
    search: params.get("search") ?? undefined,
    userId: params.get("userId") ?? undefined,
  });
  return Response.json({ matches });
});
