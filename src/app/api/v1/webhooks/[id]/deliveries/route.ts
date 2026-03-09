import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "../../../../../../lib/auth/dev-api.js";
import { prisma } from "../../../../../../lib/db/client.js";
import { apiRateLimit } from "../../../../../../lib/middleware/rate-limit.js";
import {
  errorResponse,
  NotFoundError,
  AuthorizationError,
} from "../../../../../../lib/errors/index.js";

// ---------------------------------------------------------------------------
// GET /api/v1/webhooks/:id/deliveries - List recent delivery logs
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["webhook:manage"]);
    const { id } = await params;

    // Verify the webhook config exists and belongs to the developer
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
      include: {
        game: { select: { developerProfileId: true } },
      },
    });

    if (!config) {
      throw new NotFoundError(`Webhook config ${id} not found`);
    }

    if (config.game.developerProfileId !== auth.developerProfileId) {
      throw new AuthorizationError(
        "Webhook config does not belong to a game owned by this developer"
      );
    }

    // Parse pagination from query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const [deliveries, totalCount] = await Promise.all([
      prisma.webhookDeliveryLog.findMany({
        where: { webhookConfigId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          eventType: true,
          status: true,
          httpStatus: true,
          attemptCount: true,
          deliveredAt: true,
          createdAt: true,
        },
      }),
      prisma.webhookDeliveryLog.count({
        where: { webhookConfigId: id },
      }),
    ]);

    return NextResponse.json({
      data: deliveries.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        status: d.status,
        httpStatus: d.httpStatus,
        attemptCount: d.attemptCount,
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
