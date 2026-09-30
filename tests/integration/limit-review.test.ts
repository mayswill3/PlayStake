// =============================================================================
// Integration Tests: six-monthly deposit limit review (RTS 12)
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { createTestUser, disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  getLimitReviewStatus,
  recordLimitReview,
} from "../../src/lib/responsible-play/limit-review.js";

const prisma = getTestPrisma();
const DAY = 24 * 60 * 60 * 1000;

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("limit review reminder", () => {
  it("is not due before the customer has been asked about limits at all", async () => {
    const user = await createTestUser(prisma as never);
    expect((await getLimitReviewStatus(user.id)).due).toBe(false);
  });

  it("is due six months after the first-deposit prompt, and answering resets it", async () => {
    const user = await createTestUser(prisma as never);
    await prisma.responsiblePlaySettings.create({
      data: { userId: user.id, depositLimitPromptedAt: new Date(Date.now() - 190 * DAY) },
    });
    const before = await getLimitReviewStatus(user.id);
    expect(before.due).toBe(true);
    expect(before.hasLimits).toBe(false);

    await recordLimitReview(user.id);
    expect((await getLimitReviewStatus(user.id)).due).toBe(false);
    expect((await getLimitReviewStatus(user.id, new Date(Date.now() + 183 * DAY))).due).toBe(true);
  });

  it("changing a limit counts as reviewing it", async () => {
    const user = await createTestUser(prisma as never);
    await prisma.responsiblePlaySettings.create({
      data: { userId: user.id, depositLimitPromptedAt: new Date(Date.now() - 400 * DAY) },
    });
    await prisma.depositLimit.create({
      data: { userId: user.id, period: "WEEKLY", amount: new Decimal("100.00") },
    });
    const status = await getLimitReviewStatus(user.id);
    expect(status.due).toBe(false);
    expect(status.hasLimits).toBe(true);
  });
});
