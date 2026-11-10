// =============================================================================
// Integration Tests: resending the beta sign-up confirmation
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { callApi, disconnectTestPrisma, getTestPrisma } from "./helpers.js";

const prisma = getTestPrisma();
const emails: string[] = [];

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { toEmail: { in: emails } } });
  await prisma.betaSignup.deleteMany({ where: { email: { in: emails } } });
  await disconnectTestPrisma();
});

let ip = 0;
const resend = (email: string) =>
  callApi("POST", "/api/beta-signup/resend", { body: { email }, headers: { "x-forwarded-for": `10.88.${++ip}.1` } });
const sent = (email: string) => prisma.emailOutbox.count({ where: { toEmail: email, template: "beta.signup-received" } });

describe("Resending the beta confirmation", () => {
  it("sends it again for someone on the list, up to 3 a day", async () => {
    const email = `beta-resend-${randomUUID().slice(0, 8)}@playstake-test.com`;
    emails.push(email);
    await prisma.betaSignup.create({ data: { email, playerType: "PLAYER", consentedAt: new Date() } });
    await prisma.emailOutbox.create({ data: { toEmail: email, template: "beta.signup-received", payload: { name: "" }, dedupeKey: `beta-first-${email}` } });

    expect((await resend(email)).status).toBe(200);
    expect(await sent(email)).toBe(2);
    await resend(email);
    await resend(email);
    expect(await sent(email)).toBe(3); // capped at 3 in 24 hours
  });

  it("answers the same way for an address that isn't on the list, without sending anything", async () => {
    const email = `beta-resend-${randomUUID().slice(0, 8)}@playstake-test.com`;
    emails.push(email);
    const res = await resend(email);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If you're on the list/);
    expect(await sent(email)).toBe(0);
  });
});
