// =============================================================================
// Integration Tests: identity checks through Didit
// =============================================================================
// Didit's API is simulated with a stubbed fetch; everything on our side
// (routes, signatures, screening, decisions) runs for real.
// =============================================================================

import { describe, it, expect, afterAll, afterEach, beforeEach, vi } from "vitest";
import { createHmac, randomUUID } from "crypto";
import {
  callApi,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";
import type { DiditDecision } from "../../src/lib/kyc/didit.js";

const prisma = getTestPrisma();
const createdUserIds: string[] = [];
const SECRET = "test-webhook-secret";
const decisions = new Map<string, DiditDecision>();
const createdSessions: Array<Record<string, unknown>> = [];

beforeEach(() => {
  vi.stubEnv("DIDIT_API_KEY", "test-key");
  vi.stubEnv("DIDIT_WORKFLOW_ID", "11111111-1111-1111-1111-111111111111");
  vi.stubEnv("DIDIT_WEBHOOK_SECRET", SECRET);
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/v3/session/") && init?.method === "POST") {
      createdSessions.push(JSON.parse(String(init.body)));
      return Response.json({ session_id: randomUUID(), url: "https://verify.didit.me/session/test" }, { status: 201 });
    }
    const match = url.match(/\/v3\/session\/([^/]+)\/decision\/$/);
    if (match && decisions.has(match[1])) return Response.json(decisions.get(match[1]));
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await purgeComplianceRecords(prisma, createdUserIds);
  await disconnectTestPrisma();
});

let ipCounter = 0;
async function player(dateOfBirth = "1990-05-20") {
  const user = await createTestUser(prisma as unknown as TxClient);
  await prisma.user.update({ where: { id: user.id }, data: { dateOfBirth: new Date(dateOfBirth) } });
  createdUserIds.push(user.id);
  const { sessionToken } = await createTestSession(prisma as unknown as TxClient, user.id);
  return { ...user, token: sessionToken, ip: `10.90.0.${++ipCounter}` };
}

function decision(userId: string, status: string, overrides: Partial<DiditDecision> = {}): DiditDecision {
  const sessionId = randomUUID();
  const value: DiditDecision = {
    session_id: sessionId,
    status,
    vendor_data: userId,
    id_verifications: [
      {
        status,
        document_type: "Passport",
        // Unique per test, so shared-identity screening doesn't link players.
        first_name: "Ada",
        last_name: `Lovelace-${sessionId.slice(0, 6)}`,
        date_of_birth: "1990-05-20",
        issuing_state: "GBR",
        warnings: status === "Declined" ? [{ risk: "DOCUMENT_EXPIRED", short_description: "The document has expired" }] : [],
      },
    ],
    poa_verifications: [
      {
        status: "Approved",
        document_type: "UTILITY_BILL",
        poa_formatted_address: "1 High Street, London, EC1A 1BB",
        poa_parsed_address: { street_1: "1 High Street", city: "London", postal_code: "EC1A 1BB", country: "GB" },
      },
    ],
    liveness_checks: [{ status: "Approved", score: 97 }],
    face_matches: [{ status: "Approved", score: 92 }],
    aml_screenings: [{ status: status === "In Review" ? "In Review" : "Approved", total_hits: status === "In Review" ? 1 : 0 }],
    ...overrides,
  };
  decisions.set(sessionId, value);
  return value;
}

function webhook(sessionId: string, opts: { secret?: string; age?: number; v2?: boolean } = {}) {
  const body = { webhook_type: "status.updated", session_id: sessionId, status: "Approved", event_id: randomUUID() };
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000) - (opts.age ?? 0));
  const signature = createHmac("sha256", opts.secret ?? SECRET).update(raw).digest("hex");
  const headers: Record<string, string> = { "x-timestamp": timestamp };
  if (opts.v2) {
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b))));
    headers["x-signature-v2"] = createHmac("sha256", SECRET).update(canonical).digest("hex");
  } else {
    headers["x-signature"] = signature;
  }
  return callApi("POST", "/api/webhooks/didit", { body, headers });
}

describe("starting a Didit check", () => {
  it("creates a session for the player with their declared date of birth", async () => {
    const user = await player();
    const res = await callApi("POST", "/api/kyc/didit", { sessionToken: user.token, headers: { "x-forwarded-for": user.ip } });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://verify.didit.me/session/test");
    expect(createdSessions[createdSessions.length - 1]).toMatchObject({
      vendor_data: user.id,
      expected_details: { date_of_birth: "1990-05-20" },
    });
  });

  it("needs a confirmed email first", async () => {
    const user = await player();
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: false } });
    const res = await callApi("POST", "/api/kyc/didit", { sessionToken: user.token, headers: { "x-forwarded-for": user.ip } });
    expect(res.status).toBe(409);
  });
});

describe("Didit webhook", () => {
  it("verifies an approved, adult player automatically, once", async () => {
    const user = await player();
    const result = decision(user.id, "Approved");

    const res = await webhook(result.session_id);
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("approved");

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.kycStatus).toBe("VERIFIED");
    const submission = await prisma.kycSubmission.findUniqueOrThrow({ where: { providerSessionId: result.session_id } });
    expect(submission).toMatchObject({ provider: "DIDIT", status: "APPROVED", documentType: "PASSPORT", country: "GB", postalCode: "EC1A 1BB" });

    // Didit retries; the second delivery changes nothing.
    expect((await webhook(result.session_id)).body.outcome).toBe("unchanged");
  });

  it("rejects a declined check with Didit's reasons so the player can retry", async () => {
    const user = await player();
    const result = decision(user.id, "Declined");
    expect((await webhook(result.session_id)).body.outcome).toBe("rejected");
    const submission = await prisma.kycSubmission.findUniqueOrThrow({ where: { providerSessionId: result.session_id } });
    expect(submission.status).toBe("REJECTED");
    expect(submission.reviewNotes).toMatch(/document has expired/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).kycStatus).toBe("REJECTED");
  });

  it("leaves an in-review check for staff", async () => {
    const user = await player();
    const result = decision(user.id, "In Review");
    expect((await webhook(result.session_id)).body.outcome).toBe("pending");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).kycStatus).toBe("PENDING");
  });

  it("holds an approved check for staff if the date of birth differs from sign-up", async () => {
    const user = await player("1988-01-01");
    const result = decision(user.id, "Approved");
    expect((await webhook(result.session_id)).body.outcome).toBe("pending");
    expect(await prisma.amlCase.count({ where: { userId: user.id, type: "DOB_MISMATCH" } })).toBe(1);
  });

  it("never auto-approves someone under 18, whatever Didit says", async () => {
    const dob = new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10);
    const user = await player(dob);
    const result = decision(user.id, "Approved");
    result.id_verifications![0].date_of_birth = dob;
    expect((await webhook(result.session_id)).body.outcome).toBe("pending");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).kycStatus).not.toBe("VERIFIED");
  });

  it("refuses bad signatures and stale timestamps, and accepts the V2 signature", async () => {
    const user = await player();
    const result = decision(user.id, "Approved");
    expect((await webhook(result.session_id, { secret: "wrong" })).status).toBe(401);
    expect((await webhook(result.session_id, { age: 600 })).status).toBe(401);
    expect(await prisma.kycSubmission.count({ where: { providerSessionId: result.session_id } })).toBe(0);
    expect((await webhook(result.session_id, { v2: true })).body.outcome).toBe("approved");
  });
});

describe("returning from Didit", () => {
  it("applies the player's own result, and ignores someone else's session", async () => {
    const user = await player();
    const other = await player();
    const mine = decision(user.id, "Approved");
    const theirs = decision(other.id, "Approved");

    const ignored = await callApi("POST", "/api/kyc/didit/sync", { sessionToken: user.token, body: { sessionId: theirs.session_id } });
    expect(ignored.body.outcome).toBe("ignored");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).kycStatus).not.toBe("VERIFIED");

    const synced = await callApi("POST", "/api/kyc/didit/sync", { sessionToken: user.token, body: { sessionId: mine.session_id } });
    expect(synced.body.outcome).toBe("approved");
    expect(synced.body.state.kycStatus).toBe("VERIFIED");
  });
});
