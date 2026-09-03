// =============================================================================
// Integration Tests: KYC gating and manual review
// =============================================================================
// Covers the full path: an unverified player is blocked from the money paths,
// submits a packet, an admin reviews it, and the gate opens (or stays shut).
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  callApi,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";

const prisma = getTestPrisma();

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];

function jpegFile(name: string): File {
  const bytes = new Uint8Array([...JPEG_HEADER, ...new Array(64).fill(0x41)]);
  return new File([bytes], name, { type: "image/jpeg" });
}

function submissionForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const fields: Record<string, string> = {
    legalFirstName: "Ada",
    legalLastName: "Lovelace",
    dateOfBirth: "1990-12-10",
    addressLine1: "12 Analytical Way",
    city: "London",
    postalCode: "EC1A 1BB",
    country: "GB",
    documentType: "PASSPORT",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== "") form.set(key, value);
  }
  form.set("documentFront", jpegFile("passport.jpg"));
  form.set("selfie", jpegFile("selfie.jpg"));
  return form;
}

/** Users are created outside a rollback so route handlers can see them. */
const createdUserIds: string[] = [];

// The submission and deposit limiters key on client IP, so every test actor
// gets its own address rather than sharing 127.0.0.1.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 250)}.${ipCounter % 250}.1`;
}

interface TestActor {
  user: Awaited<ReturnType<typeof createTestUser>>;
  sessionToken: string;
  headers: Record<string, string>;
}

async function makePlayer(
  overrides: Parameters<typeof createTestUser>[1] = {},
): Promise<TestActor> {
  const user = await createTestUser(prisma as unknown as TxClient, overrides);
  createdUserIds.push(user.id);
  const session = await createTestSession(
    prisma as unknown as TxClient,
    user.id,
  );
  return {
    user,
    sessionToken: session.sessionToken,
    headers: { "x-forwarded-for": nextIp() },
  };
}

/** Auth + source-IP options for a call made as this actor. */
function as(actor: TestActor) {
  return { sessionToken: actor.sessionToken, headers: actor.headers };
}

beforeAll(async () => {
  if (!process.env.KYC_DOCUMENT_ENCRYPTION_KEY) {
    throw new Error(
      "KYC_DOCUMENT_ENCRYPTION_KEY must be set to run the KYC integration tests",
    );
  }
});

afterAll(async () => {
  // KYC submissions and their documents cascade with the user; sessions and
  // ledger accounts do not, so clear those first.
  await prisma.session.deleteMany({
    where: { userId: { in: createdUserIds } },
  });
  await prisma.ledgerAccount.deleteMany({
    where: { userId: { in: createdUserIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

describe("KYC: money paths are gated", () => {
  it("blocks a deposit from an unverified player", async () => {
    const actor = await makePlayer();

    const res = await callApi("POST", "/api/wallet/deposit", {
      ...as(actor),
      body: {
        amount: 5000,
        idempotencyKey: `kyc-gate-${Date.now()}`,
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("KYC_REQUIRED");
  });

  it("blocks a withdrawal from an unverified player", async () => {
    const actor = await makePlayer();

    const res = await callApi("POST", "/api/wallet/withdraw", {
      ...as(actor),
      body: {
        amount: 5000,
        idempotencyKey: `kyc-gate-w-${Date.now()}`,
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("KYC_REQUIRED");
  });
});

describe("KYC: submission", () => {
  it("accepts a packet and moves the user to PENDING", async () => {
    const actor = await makePlayer();

    const res = await callApi("POST", "/api/kyc", {
      ...as(actor),
      formData: submissionForm(),
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: actor.user.id },
      select: { kycStatus: true },
    });
    expect(stored.kycStatus).toBe("PENDING");

    const documents = await prisma.kycDocument.findMany({
      where: { submissionId: res.body.id },
    });
    expect(documents).toHaveLength(2);
    // Bytes must never be readable straight out of the table.
    for (const document of documents) {
      expect(Buffer.from(document.ciphertext).subarray(0, 3)).not.toEqual(
        Buffer.from(JPEG_HEADER.slice(0, 3)),
      );
    }
  });

  it("rejects an applicant under 18", async () => {
    const actor = await makePlayer();
    const underage = new Date();
    underage.setUTCFullYear(underage.getUTCFullYear() - 17);

    const res = await callApi("POST", "/api/kyc", {
      ...as(actor),
      formData: submissionForm({
        dateOfBirth: underage.toISOString().slice(0, 10),
      }),
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/at least 18/i);
  });

  it("rejects a file whose bytes are not a real image or PDF", async () => {
    const actor = await makePlayer();
    const form = submissionForm();
    form.set(
      "documentFront",
      new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.jpg", {
        type: "image/jpeg",
      }),
    );

    const res = await callApi("POST", "/api/kyc", {
      ...as(actor),
      formData: form,
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/JPEG, PNG, WebP or PDF/);
  });

  it("requires both sides of a driving licence", async () => {
    const actor = await makePlayer();

    const res = await callApi("POST", "/api/kyc", {
      ...as(actor),
      formData: submissionForm({ documentType: "DRIVERS_LICENCE" }),
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/DOCUMENT_BACK/);
  });

  it("refuses a second packet while one is under review", async () => {
    const actor = await makePlayer();

    const first = await callApi("POST", "/api/kyc", {
      ...as(actor),
      formData: submissionForm(),
    });
    expect(first.status).toBe(201);

    const second = await callApi("POST", "/api/kyc", {
      ...as(actor),
      formData: submissionForm(),
    });
    expect(second.status).toBe(409);
  });
});

describe("KYC: admin review", () => {
  it("approving unlocks the money paths", async () => {
    const player = await makePlayer();
    const admin = await makePlayer({ role: "ADMIN" });

    const submitted = await callApi("POST", "/api/kyc", {
      ...as(player),
      formData: submissionForm(),
    });
    expect(submitted.status).toBe(201);

    const reviewed = await callApi(
      "PATCH",
      `/api/admin/kyc/${submitted.body.id}`,
      {
        ...as(admin),
        body: { decision: "APPROVE" },
      },
    );

    expect(reviewed.status).toBe(200);
    expect(reviewed.body.status).toBe("APPROVED");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: player.user.id },
      select: { kycStatus: true },
    });
    expect(stored.kycStatus).toBe("VERIFIED");

    // The deposit no longer trips the KYC gate.
    const deposit = await callApi("POST", "/api/wallet/deposit", {
      ...as(player),
      body: { amount: 5000, idempotencyKey: `kyc-ok-${Date.now()}` },
    });
    expect(deposit.status).not.toBe(403);
  });

  it("rejecting records the reason and lets the player resubmit", async () => {
    const player = await makePlayer();
    const admin = await makePlayer({ role: "ADMIN" });

    const submitted = await callApi("POST", "/api/kyc", {
      ...as(player),
      formData: submissionForm(),
    });

    const reviewed = await callApi(
      "PATCH",
      `/api/admin/kyc/${submitted.body.id}`,
      {
        ...as(admin),
        body: { decision: "REJECT", reviewNotes: "Photo is cut off" },
      },
    );

    expect(reviewed.status).toBe(200);
    expect(reviewed.body.status).toBe("REJECTED");
    expect(reviewed.body.reviewNotes).toBe("Photo is cut off");

    const state = await callApi("GET", "/api/kyc", {
      ...as(player),
    });
    expect(state.body.kycStatus).toBe("REJECTED");
    expect(state.body.canSubmit).toBe(true);

    const resubmitted = await callApi("POST", "/api/kyc", {
      ...as(player),
      formData: submissionForm(),
    });
    expect(resubmitted.status).toBe(201);
  });

  it("refuses a rejection with no reason", async () => {
    const player = await makePlayer();
    const admin = await makePlayer({ role: "ADMIN" });

    const submitted = await callApi("POST", "/api/kyc", {
      ...as(player),
      formData: submissionForm(),
    });

    const reviewed = await callApi(
      "PATCH",
      `/api/admin/kyc/${submitted.body.id}`,
      {
        ...as(admin),
        body: { decision: "REJECT" },
      },
    );

    expect(reviewed.status).toBe(422);
  });

  it("refuses review by a non-admin", async () => {
    const player = await makePlayer();
    const other = await makePlayer();

    const submitted = await callApi("POST", "/api/kyc", {
      ...as(player),
      formData: submissionForm(),
    });

    const reviewed = await callApi(
      "PATCH",
      `/api/admin/kyc/${submitted.body.id}`,
      {
        ...as(other),
        body: { decision: "APPROVE" },
      },
    );

    expect(reviewed.status).toBe(403);
  });
});
