import { afterEach, describe, expect, it, vi } from "vitest";

async function load(level?: string) {
  vi.resetModules();
  if (level === undefined) delete process.env.FUNDS_PROTECTION_LEVEL;
  else process.env.FUNDS_PROTECTION_LEVEL = level;
  return import("../../../src/lib/compliance/funds-protection.js");
}

afterEach(() => {
  delete process.env.FUNDS_PROTECTION_LEVEL;
  vi.resetModules();
});

describe("funds protection rating", () => {
  it("defaults to no segregation until the client account is in place", async () => {
    const fp = await load();
    expect(fp.FUNDS_PROTECTION_LEVEL).toBe("NOT_PROTECTED_NO_SEGREGATION");
    expect(fp.FUNDS_PROTECTION_STATEMENT).toMatch(/do not keep customer funds separate/);
  });

  it("switches wording and version for a segregated client account", async () => {
    const before = (await load()).FUNDS_PROTECTION_VERSION;
    const fp = await load("NOT_PROTECTED_SEGREGATION");
    expect(fp.FUNDS_PROTECTION_LEVEL_LABEL).toBe("not protected – segregation of customer funds");
    expect(fp.FUNDS_PROTECTION_STATEMENT).toMatch(/separate from company funds.*not protected/);
    // A new version means every customer must acknowledge the new arrangement.
    expect(fp.FUNDS_PROTECTION_VERSION).not.toBe(before);
    const old = { fundsProtectionVersion: before, fundsProtectionAcknowledgedAt: new Date() };
    expect(fp.hasAcknowledgedFundsProtection(old)).toBe(false);
    expect(fp.fundsProtectionReason(old)).toBe("changed");
  });

  it("refuses a level without approved wording and falls back to the honest default", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fp = await load("HIGH");
    expect(fp.FUNDS_PROTECTION_LEVEL).toBe("NOT_PROTECTED_NO_SEGREGATION");
  });
});
