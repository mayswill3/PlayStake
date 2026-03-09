import { describe, it, expect } from "vitest";
import {
  generateRandomToken,
  sha256Hash,
  constantTimeCompare,
} from "../../../src/lib/utils/crypto.js";

const BASE62_REGEX = /^[0-9A-Za-z]+$/;

describe("generateRandomToken", () => {
  it("returns a base62-encoded string", () => {
    const token = generateRandomToken(32);
    expect(token).toMatch(BASE62_REGEX);
  });

  it("returns a string with length equal to the byte count", () => {
    // Each byte maps to one base62 char in our implementation
    const token = generateRandomToken(32);
    expect(token).toHaveLength(32);
  });

  it("generates unique tokens on successive calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateRandomToken(32));
    }
    expect(tokens.size).toBe(100);
  });

  it("handles small lengths", () => {
    const token = generateRandomToken(1);
    expect(token).toHaveLength(1);
    expect(token).toMatch(BASE62_REGEX);
  });

  it("handles large lengths", () => {
    const token = generateRandomToken(128);
    expect(token).toHaveLength(128);
    expect(token).toMatch(BASE62_REGEX);
  });
});

describe("sha256Hash", () => {
  it("returns a 64-character hex string", () => {
    const hash = sha256Hash("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a known hash for a known input", () => {
    // SHA-256 of "hello" is well-known
    const expected =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    expect(sha256Hash("hello")).toBe(expected);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = sha256Hash("input_a");
    const h2 = sha256Hash("input_b");
    expect(h1).not.toBe(h2);
  });

  it("produces the same hash for the same input (deterministic)", () => {
    const h1 = sha256Hash("same_input");
    const h2 = sha256Hash("same_input");
    expect(h1).toBe(h2);
  });
});

describe("constantTimeCompare", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeCompare("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(constantTimeCompare("abc123", "abc124")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(constantTimeCompare("short", "longer_string")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(constantTimeCompare("", "")).toBe(true);
  });

  it("returns false for one empty and one non-empty string", () => {
    expect(constantTimeCompare("", "notempty")).toBe(false);
  });

  it("works with hash-length strings", () => {
    const hash1 = sha256Hash("test1");
    const hash2 = sha256Hash("test1");
    const hash3 = sha256Hash("test2");
    expect(constantTimeCompare(hash1, hash2)).toBe(true);
    expect(constantTimeCompare(hash1, hash3)).toBe(false);
  });
});
