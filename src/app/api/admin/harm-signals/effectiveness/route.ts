import { withRoleGuard } from "@/lib/middleware/auth";
import { UserRole } from "../../../../../../generated/prisma/client";
import { interactionEffectiveness } from "@/lib/responsible-play/interaction";

/** GET /api/admin/harm-signals/effectiveness — interaction outcomes by marker type. */
export const GET = withRoleGuard([UserRole.ADMIN], async () => {
  return Response.json({ rows: await interactionEffectiveness() });
});
