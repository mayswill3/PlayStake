// =============================================================================
// Integration Tests: Complaints procedure
// =============================================================================
// Every complaint gets a reference and an immediate acknowledgement, a final
// response within 8 weeks, and — in that final response — the route to IBAS.
// Staff actions are audited. Also covers admin resolution of a dispute on a
// bet with no referee, which used to leave the stakes in escrow.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import {
  callApi,
  createFullScenario,
  createTestSession,
  createTestUser,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import { BetMatchType, BetStatus } from "../../generated/prisma/client.js";
import { holdEscrow } from "../../src/lib/ledger/escrow.js";
import { renderEmail } from "../../src/lib/email/templates.js";
import type { TxClient } from "../../src/lib/db/client.js";

const prisma = getTestPrisma();
const tx = prisma as unknown as TxClient;
const createdUserIds: string[] = [];
const guestEmails: string[] = [];
let adminToken: string;
let playerToken: string;

let ip = 0;
const nextIp = () => ({ "x-forwarded-for": `10.88.${++ip}.1` });

beforeAll(async () => {
  const admin = await createTestUser(tx, { role: "ADMIN", displayName: "Complaints Admin" });
  const player = await createTestUser(tx, { displayName: "Complainant" });
  createdUserIds.push(admin.id, player.id);
  adminToken = (await createTestSession(tx, admin.id)).sessionToken;
  playerToken = (await createTestSession(tx, player.id)).sessionToken;
});

afterAll(async () => {
  const emails = [...guestEmails];
  const guestComplaints = await prisma.complaint.findMany({
    where: { email: { in: emails }, userId: null },
    select: { id: true },
  });
  await prisma.complaintEvent.deleteMany({
    where: { complaintId: { in: guestComplaints.map((complaint) => complaint.id) } },
  });
  await prisma.complaint.deleteMany({ where: { id: { in: guestComplaints.map((complaint) => complaint.id) } } });
  await prisma.emailOutbox.deleteMany({ where: { toEmail: { in: emails } } });
  await purgeComplianceRecords(prisma, createdUserIds);
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await disconnectTestPrisma();
});

async function fileAsGuest() {
  const email = `guest-${crypto.randomUUID().slice(0, 8)}@playstake-test.com`;
  guestEmails.push(email);
  const res = await callApi("POST", "/api/complaints", {
    headers: nextIp(),
    body: {
      name: "Guest Customer",
      email,
      category: "WITHDRAWALS",
      description: "My withdrawal has been pending for over a week with no update.",
    },
  });
  return { res, email };
}

describe("Complaints: filing", () => {
  it("issues a reference, acknowledges at once and sets an 8-week deadline", async () => {
    const { res, email } = await fileAsGuest();
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^PS-C-\d{4}-\d{6}$/);

    const complaint = await prisma.complaint.findUniqueOrThrow({ where: { reference: res.body.reference } });
    expect(complaint.acknowledgedAt).not.toBeNull();
    const weeks = (complaint.finalResponseDueAt.getTime() - complaint.receivedAt.getTime()) / (7 * 24 * 3600 * 1000);
    expect(weeks).toBe(8);

    const acknowledgement = await prisma.emailOutbox.findFirst({
      where: { toEmail: email, template: "complaint.received" },
    });
    expect(acknowledgement).not.toBeNull();
  });

  it("links a signed-in customer's complaint to their account", async () => {
    const res = await callApi("POST", "/api/complaints", {
      sessionToken: playerToken,
      headers: nextIp(),
      body: { category: "ACCOUNT", description: "I cannot change my display name from settings." },
    });
    expect(res.status).toBe(201);
    const mine = await callApi("GET", "/api/complaints", { sessionToken: playerToken });
    expect(mine.body.complaints.map((c: { reference: string }) => c.reference)).toContain(res.body.reference);
  });

  it("won't attach a bet the customer wasn't in", async () => {
    const res = await callApi("POST", "/api/complaints", {
      sessionToken: playerToken,
      headers: nextIp(),
      body: {
        category: "BET_OR_RESULT",
        description: "This result looks wrong to me, please review it.",
        betId: crypto.randomUUID(),
      },
    });
    expect(res.status).toBe(422);
  });
});

describe("Complaints: staff handling", () => {
  it("issues a final response that points to IBAS, once, and audits it", async () => {
    const { res, email } = await fileAsGuest();
    const complaint = await prisma.complaint.findUniqueOrThrow({ where: { reference: res.body.reference } });

    const final = await callApi("POST", `/api/admin/complaints/${complaint.id}`, {
      sessionToken: adminToken,
      body: {
        kind: "final_response",
        outcome: "UPHELD",
        response:
          "We found your withdrawal was held in error by our payment provider. It has now been paid and we have added a goodwill credit.",
      },
    });
    expect(final.status).toBe(200);
    expect(final.body.status).toBe("FINAL_RESPONSE_ISSUED");

    const outbox = await prisma.emailOutbox.findFirstOrThrow({
      where: { toEmail: email, template: "complaint.final-response" },
    });
    const rendered = renderEmail("complaint.final-response", outbox.payload as never);
    expect(rendered.text).toMatch(/IBAS/);
    expect(rendered.text).toMatch(/ibas-uk\.com/);

    const again = await callApi("POST", `/api/admin/complaints/${complaint.id}`, {
      sessionToken: adminToken,
      body: { kind: "note", body: "Late note" },
    });
    expect(again.status).toBe(409);

    const audit = await prisma.adminAuditLog.findFirst({
      where: { action: "complaint.final_response", targetId: complaint.id },
    });
    expect(audit).not.toBeNull();
  });

  it("keeps the queue to staff", async () => {
    const res = await callApi("GET", "/api/admin/complaints", { sessionToken: playerToken });
    expect(res.status).toBe(403);
  });
});

describe("Disputes without a referee", () => {
  it("turn the admin's decision into a result the settlement worker pays out", async () => {
    const scenario = await createFullScenario(tx, {
      playerABalance: 100,
      playerBBalance: 100,
      platformFeePercent: 0,
      revSharePercent: 0,
    });
    const stake = new Decimal("5.00");
    const bet = await prisma.bet.create({
      data: {
        gameId: scenario.game.id,
        playerAId: scenario.playerA.id,
        amount: stake,
        status: BetStatus.PENDING_CONSENT,
        matchType: BetMatchType.GAME_LOBBY,
        platformFeePercent: 0,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    await holdEscrow(tx, { playerId: scenario.playerA.id, betId: bet.id, amount: stake, idempotencyKey: `c_a_${bet.id}` });
    await prisma.bet.update({ where: { id: bet.id }, data: { status: BetStatus.OPEN } });
    await holdEscrow(tx, { playerId: scenario.playerB.id, betId: bet.id, amount: stake, idempotencyKey: `c_b_${bet.id}` });
    await prisma.bet.update({
      where: { id: bet.id },
      data: { status: BetStatus.DISPUTED, playerBId: scenario.playerB.id, outcome: "PLAYER_B_WIN" },
    });
    const dispute = await prisma.dispute.create({
      data: { betId: bet.id, filedById: scenario.playerA.id, reason: "I won that game clearly" },
    });

    const res = await callApi("PATCH", `/api/admin/disputes/${dispute.id}`, {
      sessionToken: adminToken,
      body: { status: "RESOLVED_PLAYER_A", resolution: "Game log shows player A won" },
    });
    expect(res.status).toBe(200);

    const updated = await prisma.bet.findUniqueOrThrow({ where: { id: bet.id } });
    expect(updated.status).toBe(BetStatus.RESULT_REPORTED);
    expect(updated.outcome).toBe("PLAYER_A_WIN");
    expect(updated.resultVerified).toBe(true);
  });
});
