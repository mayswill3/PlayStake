// =============================================================================
// Integration Tests: verified customers updating their address
// =============================================================================

import { describe, it, expect, afterAll, afterEach, beforeEach, vi } from "vitest";
import { randomUUID } from "crypto";
import { callApi, createTestSession, createTestUser, disconnectTestPrisma, getTestPrisma, purgeComplianceRecords } from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";
import type { DiditDecision } from "../../src/lib/kyc/didit.js";
import { applyDiditDecision } from "../../src/lib/kyc/didit-decisions.js";
import { reviewSubmission } from "../../src/lib/kyc/service.js";
import { assertCanWager } from "../../src/lib/responsible-play/policy.js";

const prisma = getTestPrisma();
const tx = prisma as unknown as TxClient;
const createdUserIds: string[] = [];
const sessions: string[] = [];

beforeEach(() => {
  vi.stubEnv("DIDIT_API_KEY", "test-key");
  vi.stubEnv("DIDIT_WORKFLOW_ID", "11111111-1111-1111-1111-111111111111");
  vi.stubEnv("DIDIT_ADDRESS_WORKFLOW_ID", "22222222-2222-2222-2222-222222222222");
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    if (String(input).endsWith("/v3/session/") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      expect(body.workflow_id).toBe("22222222-2222-2222-2222-222222222222");
      const id = randomUUID();
      sessions.push(id);
      return Response.json({ session_id: id, url: "https://verify.didit.me/session/test" }, { status: 201 });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await prisma.kycSubmission.deleteMany({ where: { userId: { in: createdUserIds } } });
  await purgeComplianceRecords(prisma, createdUserIds);
  await disconnectTestPrisma();
});

/** A verified customer with an approved identity check at a London address. */
async function verifiedCustomer() {
  const user = await createTestUser(tx);
  createdUserIds.push(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { kycStatus: "VERIFIED", emailVerified: true } });
  await prisma.kycSubmission.create({
    data: {
      userId: user.id, status: "APPROVED", legalFirstName: "Ada", legalLastName: "Lovelace", dateOfBirth: new Date("1990-05-20T00:00:00Z"),
      addressLine1: "1 High Street", city: "London", postalCode: "EC1A 1BB", country: "GB", documentType: "PASSPORT",
      reviewedAt: new Date(Date.now() - 60_000),
    },
  });
  const { sessionToken } = await createTestSession(tx, user.id);
  return { ...user, token: sessionToken };
}

function poaDecision(userId: string, sessionId: string, status: string, address: Record<string, string>, extra: Partial<DiditDecision> = {}): DiditDecision {
  return {
    session_id: sessionId,
    status,
    vendor_data: userId,
    poa_verifications: [
      {
        status,
        document_type: "Utility bill",
        poa_formatted_address: `${address.street_1}, ${address.city}, ${address.postal_code}`,
        poa_parsed_address: address,
        warnings: status === "Declined" ? [{ risk: "POA_OLD", short_description: "The document is older than 3 months" }] : [],
      },
    ],
    ...extra,
  } as DiditDecision;
}

async function start(customer: { id: string; token: string }) {
  const res = await callApi("POST", "/api/kyc/address", { sessionToken: customer.token, headers: { "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.1` } });
  expect(res.status).toBe(200);
  return sessions[sessions.length - 1];
}

const latestApproved = (userId: string) =>
  prisma.kycSubmission.findFirstOrThrow({ where: { userId, status: "APPROVED" }, orderBy: { reviewedAt: "desc" } });

describe("Updating an address", () => {
  it("starts a proof-of-address check that staff don't see until Didit replies, one at a time", async () => {
    const customer = await verifiedCustomer();
    const sessionId = await start(customer);
    const pending = await prisma.kycSubmission.findUniqueOrThrow({ where: { providerSessionId: sessionId } });
    expect(pending).toMatchObject({ purpose: "ADDRESS_UPDATE", status: "PENDING", legalLastName: "Lovelace", postalCode: "EC1A 1BB" });
    expect(await prisma.kycSubmission.count({ where: { id: pending.id, NOT: { purpose: "ADDRESS_UPDATE", providerStatus: null } } })).toBe(0);

    const again = await callApi("POST", "/api/kyc/address", { sessionToken: customer.token, headers: { "x-forwarded-for": "10.78.0.1" } });
    expect(again.status).toBe(409);
  });

  it("replaces the address when Didit approves it, keeping the customer verified and the old address on record", async () => {
    const customer = await verifiedCustomer();
    const sessionId = await start(customer);
    const outcome = await applyDiditDecision(
      poaDecision(customer.id, sessionId, "Approved", { street_1: "5 Deansgate", city: "Manchester", postal_code: "M3 2BW", country: "GBR" }),
    );
    expect(outcome).toBe("approved");
    expect(await latestApproved(customer.id)).toMatchObject({ purpose: "ADDRESS_UPDATE", city: "Manchester", postalCode: "M3 2BW", country: "GB" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).kycStatus).toBe("VERIFIED");
    expect(await prisma.kycSubmission.count({ where: { userId: customer.id, status: "APPROVED" } })).toBe(2);
    const status = await callApi("GET", "/api/kyc/address", { sessionToken: customer.token });
    expect(status.body.current).toMatchObject({ city: "Manchester", inGreatBritain: true });
  });

  it("keeps the previous address when the check is declined", async () => {
    const customer = await verifiedCustomer();
    const sessionId = await start(customer);
    expect(await applyDiditDecision(poaDecision(customer.id, sessionId, "Declined", { street_1: "9 Road", city: "Leeds", postal_code: "LS1 1AA", country: "GB" }))).toBe("rejected");
    expect((await latestApproved(customer.id)).city).toBe("London");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).kycStatus).toBe("VERIFIED");
    const status = await callApi("GET", "/api/kyc/address", { sessionToken: customer.token });
    expect(status.body.update).toMatchObject({ status: "REJECTED" });
    expect(status.body.update.notes).toMatch(/older than 3 months/);
  });

  it("records a move to Northern Ireland truthfully: withdrawals only from then on", async () => {
    const customer = await verifiedCustomer();
    const sessionId = await start(customer);
    await applyDiditDecision(poaDecision(customer.id, sessionId, "Approved", { street_1: "2 Donegall Place", city: "Belfast", postal_code: "BT1 5GS", country: "GB" }));
    expect((await latestApproved(customer.id)).postalCode).toBe("BT1 5GS");
    await expect(assertCanWager(customer.id)).rejects.toMatchObject({ code: "OUTSIDE_LAUNCH_SCOPE" });
  });

  it("sends a different identity to staff, whose rejection leaves the customer verified", async () => {
    const customer = await verifiedCustomer();
    const sessionId = await start(customer);
    const outcome = await applyDiditDecision(
      poaDecision(customer.id, sessionId, "Approved", { street_1: "3 Queen St", city: "Cardiff", postal_code: "CF10 2BU", country: "GB" }, {
        id_verifications: [{ status: "Approved", document_type: "Passport", first_name: "Someone", last_name: "Else", date_of_birth: "1985-01-01" }],
      } as Partial<DiditDecision>),
    );
    expect(outcome).toBe("pending");
    const pending = await prisma.kycSubmission.findUniqueOrThrow({ where: { providerSessionId: sessionId } });
    expect(pending.reviewNotes).toMatch(/doesn't match/);
    const admin = await createTestUser(tx, { role: "ADMIN" });
    createdUserIds.push(admin.id);
    await reviewSubmission({ submissionId: pending.id, reviewerId: admin.id, approve: false, reviewNotes: "Different person on the check" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).kycStatus).toBe("VERIFIED");
    expect((await latestApproved(customer.id)).city).toBe("London");
  });

  it("isn't available before the customer is verified", async () => {
    const user = await createTestUser(tx);
    createdUserIds.push(user.id);
    const { sessionToken } = await createTestSession(tx, user.id);
    const res = await callApi("POST", "/api/kyc/address", { sessionToken, headers: { "x-forwarded-for": "10.79.0.1" } });
    expect(res.status).toBe(409);
  });
});
