import { withRoleGuard } from "@/lib/middleware/auth";
import { UserRole } from "../../../../../generated/prisma/client";
import { listRecordingAccess } from "@/lib/recordings/admin-access";

/** GET /api/admin/recording-access — who opened which recording, when and why. */
export const GET = withRoleGuard([UserRole.ADMIN], async () => Response.json({ entries: await listRecordingAccess() }));
