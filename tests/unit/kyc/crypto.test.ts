// =============================================================================
// Unit Tests: KYC document encryption and upload validation
// =============================================================================

import "dotenv/config";
import { describe, it, expect } from "vitest";
import {
  decryptDocument,
  encryptDocument,
  hashDocument,
} from "../../../src/lib/kyc/crypto.js";
import {
  MINIMUM_AGE_YEARS,
  ageInYears,
  sniffMimeType,
} from "../../../src/lib/kyc/constants.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function webp(): Buffer {
  const buffer = Buffer.alloc(16);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(8, 4);
  buffer.write("WEBP", 8, "ascii");
  return buffer;
}

describe("KYC: document encryption", () => {
  it("round-trips document bytes", () => {
    const plaintext = Buffer.from("a passport scan, more or less");
    const blob = encryptDocument(plaintext);

    expect(blob.ciphertext.equals(plaintext)).toBe(false);
    expect(decryptDocument(blob).equals(plaintext)).toBe(true);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plaintext = Buffer.from("same input");
    const first = encryptDocument(plaintext);
    const second = encryptDocument(plaintext);

    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it("rejects tampered ciphertext", () => {
    const blob = encryptDocument(Buffer.from("original bytes"));
    blob.ciphertext[0] ^= 0xff;

    expect(() => decryptDocument(blob)).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    const blob = encryptDocument(Buffer.from("original bytes"));
    blob.authTag[0] ^= 0xff;

    expect(() => decryptDocument(blob)).toThrow();
  });

  it("hashes content stably", () => {
    const plaintext = Buffer.from("stable");
    expect(hashDocument(plaintext)).toBe(hashDocument(Buffer.from("stable")));
    expect(hashDocument(plaintext)).not.toBe(hashDocument(Buffer.from("other")));
  });
});

describe("KYC: upload sniffing", () => {
  it("recognises the accepted formats", () => {
    expect(sniffMimeType(JPEG)).toBe("image/jpeg");
    expect(sniffMimeType(PNG)).toBe("image/png");
    expect(sniffMimeType(webp())).toBe("image/webp");
    expect(sniffMimeType(PDF)).toBe("application/pdf");
  });

  it("rejects content that is not an accepted format", () => {
    expect(sniffMimeType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffMimeType(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffMimeType(Buffer.alloc(0))).toBeNull();
  });

  it("does not mistake other RIFF containers for WebP", () => {
    const wav = Buffer.alloc(16);
    wav.write("RIFF", 0, "ascii");
    wav.write("WAVE", 8, "ascii");

    expect(sniffMimeType(wav)).toBeNull();
  });
});

describe("KYC: age check", () => {
  it("counts whole years", () => {
    const now = new Date("2026-09-03T00:00:00Z");

    expect(ageInYears(new Date("2000-09-03T00:00:00Z"), now)).toBe(26);
    // Birthday is tomorrow — still a year short.
    expect(ageInYears(new Date("2008-09-04T00:00:00Z"), now)).toBe(17);
    // Birthday is today — counts.
    expect(ageInYears(new Date("2008-09-03T00:00:00Z"), now)).toBe(18);
  });

  it("puts the minimum age at the legal threshold", () => {
    expect(MINIMUM_AGE_YEARS).toBe(18);
  });
});
