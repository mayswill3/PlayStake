// =============================================================================
// Unit Tests: createChallenge input validation
// =============================================================================
// The stake is validated before any database access, so these run without
// touching a streamer record. DB-dependent guards (self / offline / no declared
// game) live in tests/integration/challenge.test.ts.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { createChallenge } from "../../../src/lib/lobby/service.js";
import { ValidationError } from "../../../src/lib/errors/index.js";
import { disconnectTestPrisma } from "../../integration/helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("createChallenge — stake validation (fast-fail, no DB)", () => {
  const base = {
    challengerUserId: "00000000-0000-0000-0000-000000000000",
    streamerChannelSlug: "some-streamer",
  };

  it("rejects a zero stake", async () => {
    await expect(
      createChallenge({ ...base, stakeAmount: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a negative stake", async () => {
    await expect(
      createChallenge({ ...base, stakeAmount: -100 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a non-integer (sub-cent) stake", async () => {
    await expect(
      createChallenge({ ...base, stakeAmount: 10.5 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
