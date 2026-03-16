import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "../../../../../lib/auth/dev-api";
import { prisma } from "../../../../../lib/db/client";
import { apiRateLimit } from "../../../../../lib/middleware/rate-limit";
import { validateBody } from "../../../../../lib/middleware/validate";
import { updateWebhookSchema } from "../../../../../lib/validation/schemas";
import {
  errorResponse,
  NotFoundError,
  AuthorizationError,
} from "../../../../../lib/errors/index";
import { WebhookEventType } from "../../../../../../generated/prisma/client";

// ---------------------------------------------------------------------------
// Helper: load and authorize webhook config
// ---------------------------------------------------------------------------

async function loadAndAuthorizeWebhook(
  developerProfileId: string,
  webhookId: string
) {
  const config = await prisma.webhookConfig.findUnique({
    where: { id: webhookId },
    include: {
      game: { select: { developerProfileId: true } },
    },
  });

  if (!config) {
    throw new NotFoundError(`Webhook config ${webhookId} not found`);
  }

  if (config.game.developerProfileId !== developerProfileId) {
    throw new AuthorizationError(
      "Webhook config does not belong to a game owned by this developer"
    );
  }

  return config;
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/webhooks/:id - Update webhook config
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["webhook:manage"]);
    const { id } = await params;

    const body = await request.json();
    const input = validateBody(updateWebhookSchema, body);

    // Load and verify ownership
    await loadAndAuthorizeWebhook(auth.developerProfileId, id);

    const updateData: Record<string, unknown> = {};
    if (input.url !== undefined) updateData.url = input.url;
    if (input.events !== undefined)
      updateData.events = input.events as WebhookEventType[];
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const updated = await prisma.webhookConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      gameId: updated.gameId,
      url: updated.url,
      events: updated.events,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/webhooks/:id - Deactivate webhook (soft delete)
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["webhook:manage"]);
    const { id } = await params;

    // Load and verify ownership
    await loadAndAuthorizeWebhook(auth.developerProfileId, id);

    await prisma.webhookConfig.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
