import { describe, expect, it } from "vitest";
import { betaSignupSchema } from "../../../src/lib/validation/schemas.js";

const validSignup = {
  name: "Test Player",
  email: "Player@Example.com ",
  game: "Darts",
  playerType: "Player",
  consent: true,
};

describe("betaSignupSchema", () => {
  it("accepts a valid signup and normalises the email address", () => {
    const result = betaSignupSchema.parse(validSignup);

    expect(result.email).toBe("player@example.com");
  });

  it.each([
    "Call of Duty",
    "Grand Theft Auto V / GTA Online",
    "EA SPORTS FC 26",
    "Fortnite",
    "Tekken 8",
  ])("accepts the popular game option %s", (game) => {
    expect(betaSignupSchema.safeParse({ ...validSignup, game }).success).toBe(true);
  });

  it("requires explicit consent", () => {
    const result = betaSignupSchema.safeParse({
      ...validSignup,
      consent: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects values outside the available form choices", () => {
    const result = betaSignupSchema.safeParse({
      ...validSignup,
      game: "Unknown game",
      playerType: "Unknown type",
    });

    expect(result.success).toBe(false);
  });
});
