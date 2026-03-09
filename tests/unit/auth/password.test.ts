import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../../../src/lib/auth/password.js";

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it successfully", async () => {
    const password = "SecureP@ss1";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    // bcrypt hashes start with $2b$ or $2a$
    expect(hash).toMatch(/^\$2[ab]\$/);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("CorrectPassword1!");
    const isValid = await verifyPassword("WrongPassword1!", hash);
    expect(isValid).toBe(false);
  });

  it("generates different hashes for the same password (due to salt)", async () => {
    const password = "SamePassword1!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);

    // Both should still verify
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("uses cost factor 12", async () => {
    const hash = await hashPassword("TestCost12!");
    // bcrypt hash format: $2b$12$...
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    const result = validatePasswordStrength("SecureP@ss1");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = validatePasswordStrength("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must be at least 8 characters long"
    );
  });

  it("rejects a password without uppercase letters", () => {
    const result = validatePasswordStrength("lowercase1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least 1 uppercase letter"
    );
  });

  it("rejects a password without numbers", () => {
    const result = validatePasswordStrength("NoNumbers!!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least 1 number"
    );
  });

  it("rejects a password without special characters", () => {
    const result = validatePasswordStrength("NoSpecial1A");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least 1 special character"
    );
  });

  it("accumulates multiple errors", () => {
    const result = validatePasswordStrength("ab");
    expect(result.valid).toBe(false);
    // Should have: too short, no uppercase, no number, no special
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("accepts a password with exactly 8 characters meeting all criteria", () => {
    const result = validatePasswordStrength("Abcde1!x");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("treats spaces as special characters", () => {
    const result = validatePasswordStrength("Has Space 1A");
    expect(result.valid).toBe(true);
  });
});
