import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { authenticateApiKey } from "../../../../../../lib/auth/dev-api";
import { prisma } from "../../../../../../lib/db/client";
import { apiRateLimit } from "../../../../../../lib/middleware/rate-limit";
import {
  errorResponse,
  NotFoundError,
  AuthorizationError,
  AppError,
} from "../../../../../../lib/errors/index";

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/:id/test - Send a test webhook payload
// ---------------------------------------------------------------------------

export async function POST(
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

    if (!config.isActive) {
      throw new AppError(
        "Webhook config is not active",
        400,
        "WEBHOOK_INACTIVE"
      );
    }

    // Build test payload
    const timestamp = Math.floor(Date.now() / 1000);
    const testPayload = {
      event: "test",
      webhookConfigId: config.id,
      gameId: config.gameId,
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook delivery from PlayStake.",
      },
    };

    const payloadJson = JSON.stringify(testPayload);

    // Compute HMAC signature
    const signature = crypto
      .createHmac("sha256", config.secret)
      .update(`${timestamp}.${payloadJson}`)
      .digest("hex");

    // Send the webhook
    const startTime = Date.now();
    let httpStatus: number;
    let delivered: boolean;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PlayStake-Signature": `t=${timestamp},v1=${signature}`,
          "X-PlayStake-Event": "test",
          "X-PlayStake-Delivery": "test-" + config.id,
        },
        body: payloadJson,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      httpStatus = response.status;
      delivered = httpStatus >= 200 && httpStatus < 300;
    } catch {
      httpStatus = 0;
      delivered = false;
    }

    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json({
      delivered,
      httpStatus: httpStatus || null,
      responseTimeMs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
