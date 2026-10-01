// =============================================================================
// Integration Tests: Referee Code of Conduct acceptance
// =============================================================================
// Applying to referee records acceptance of the current Code; an approved
// referee who hasn't accepted it can't go available or claim a match.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import * as crypto from "crypto";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import { RefereeProfileStatus } from "../../generated/prisma/client.js";
import { applyToReferee, setRefereeAvailability } from "../../src/lib/referees/service.js";
import { refereeApplySchema } from "../../src/lib/validation/schemas.js";
import { REFEREE_CODE_VERSION } from "../../src/lib/rules.js";

const prisma = getTestPrisma();

afterAll(async () => {
  await disconnectTestPrisma();
});

async function refereeCandidate() {
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `refcode-${uid}@playstake-test.com`,
      displayName: `Ref ${uid}`,
      role: "PLAYER",
      emailVerified: true,
      kycStatus: "VERIFIED",
    },
  });
  await prisma.kickAccount.create({
    data: {
      userId: user.id,
      kickUserId: `kick-${uid}`,
      channelSlug: `ref-${uid}`,
      displayName: "Ref",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
    },
  });
  return user;
}

describe("Referee Code of Conduct", () => {
  it("an application must accept the Code", () => {
    const gameIds = [crypto.randomUUID()];
    expect(refereeApplySchema.safeParse({ gameIds }).success).toBe(false);
    expect(refereeApplySchema.safeParse({ gameIds, acceptCode: false }).success).toBe(false);
    expect(refereeApplySchema.safeParse({ gameIds, acceptCode: true }).success).toBe(true);
  });

  it("applying records the accepted version", async () => {
    const user = await refereeCandidate();
    const game = await prisma.game.findFirstOrThrow({ where: { isActive: true } });
    const profile = await applyToReferee({ userId: user.id, gameIds: [game.id] });
    expect(profile.codeVersion).toBe(REFEREE_CODE_VERSION);
    expect(profile.codeAcceptedAt).not.toBeNull();
  });

  it("an approved referee without the current Code can't go available until they accept", async () => {
    const user = await refereeCandidate();
    await prisma.refereeProfile.create({
      data: { userId: user.id, status: RefereeProfileStatus.APPROVED, approvedAt: new Date() },
    });

    await expect(setRefereeAvailability(user.id, true)).rejects.toMatchObject({
      code: "REFEREE_CODE_REQUIRED",
    });
    // Going unavailable is always allowed.
    await expect(setRefereeAvailability(user.id, false)).resolves.toBeTruthy();

    const updated = await setRefereeAvailability(user.id, true, true);
    expect(updated.isAvailable).toBe(true);
    expect(updated.codeVersion).toBe(REFEREE_CODE_VERSION);
  });
});
