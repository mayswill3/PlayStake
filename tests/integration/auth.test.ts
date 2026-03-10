// =============================================================================
// Integration Tests: Authentication Flows
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import {
  withRollback,
  callApi,
  createTestUser,
  createTestSession,
  disconnectTestPrisma,
} from "./helpers.js";
import { _resetStore } from "../../src/lib/auth/login-protection.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("Auth: Registration", () => {
  it("should register a new user with PLAYER role", async () => {
    const email = `reg-test-${Date.now()}@playstake-test.com`;

    const res = await callApi("POST", "/api/auth/register", {
      body: {
        email,
        password: "SecurePass1!",
        displayName: "NewTestPlayer",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.displayName).toBe("NewTestPlayer");
    expect(res.body.user.role).toBe("PLAYER");
    expect(res.body.user.id).toBeDefined();
  });

  it("should return 409 when registering with an existing email", async () => {
    const email = `dup-test-${Date.now()}@playstake-test.com`;

    // First registration
    const res1 = await callApi("POST", "/api/auth/register", {
      body: {
        email,
        password: "SecurePass1!",
        displayName: "First",
      },
    });
    expect(res1.status).toBe(201);

    // Duplicate registration
    const res2 = await callApi("POST", "/api/auth/register", {
      body: {
        email,
        password: "SecurePass1!",
        displayName: "Second",
      },
    });
    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe("CONFLICT");
  });

  it("should return 422 for a weak password", async () => {
    const res = await callApi("POST", "/api/auth/register", {
      body: {
        email: `weak-${Date.now()}@playstake-test.com`,
        password: "short",
        displayName: "WeakPw",
      },
    });

    // Could be 422 from password strength or from Zod min length
    expect(res.status).toBe(422);
  });

  it("should return 422 for missing display name", async () => {
    const res = await callApi("POST", "/api/auth/register", {
      body: {
        email: `nodisplay-${Date.now()}@playstake-test.com`,
        password: "SecurePass1!",
      },
    });

    expect(res.status).toBe(422);
  });
});

describe("Auth: Login", () => {
  it("should login with valid credentials and return session cookie", async () => {
    const email = `login-test-${Date.now()}@playstake-test.com`;
    const password = "SecurePass1!";

    // Register first
    await callApi("POST", "/api/auth/register", {
      body: { email, password, displayName: "LoginTest" },
    });

    // Login
    const res = await callApi("POST", "/api/auth/login", {
      body: { email, password },
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);

    // Verify session cookie is set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("playstake_session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("should return 401 for wrong password", async () => {
    const email = `wrongpw-${Date.now()}@playstake-test.com`;
    const password = "SecurePass1!";

    await callApi("POST", "/api/auth/register", {
      body: { email, password, displayName: "WrongPw" },
    });

    const res = await callApi("POST", "/api/auth/login", {
      body: { email, password: "WrongPassword1!" },
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 for non-existent user", async () => {
    const res = await callApi("POST", "/api/auth/login", {
      body: {
        email: `nonexistent-${Date.now()}@playstake-test.com`,
        password: "SecurePass1!",
      },
    });

    expect(res.status).toBe(401);
  });

  it("should lock account after 10 failed attempts (rate limit)", async () => {
    // Reset the in-memory store to avoid interference from other tests
    _resetStore();

    const email = `ratelimit-${Date.now()}@playstake-test.com`;
    const password = "SecurePass1!";

    await callApi("POST", "/api/auth/register", {
      body: { email, password, displayName: "RateLimit" },
    });

    // Make 10 failed attempts with the same IP
    for (let i = 0; i < 10; i++) {
      await callApi("POST", "/api/auth/login", {
        body: { email, password: "BadPassword1!" },
        headers: { "x-forwarded-for": "10.0.0.99" },
      });
    }

    // The 11th attempt should be rate limited (429 from rate limiter or 423 from login protection)
    const res = await callApi("POST", "/api/auth/login", {
      body: { email, password },
      headers: { "x-forwarded-for": "10.0.0.99" },
    });

    // Should be locked -- the code uses 429 for rate limit
    expect([423, 429]).toContain(res.status);

    // Cleanup
    _resetStore();
  });
});

describe("Auth: Logout", () => {
  it("should destroy session on logout", async () => {
    const email = `logout-${Date.now()}@playstake-test.com`;
    const password = "SecurePass1!";

    await callApi("POST", "/api/auth/register", {
      body: { email, password, displayName: "LogoutTest" },
    });

    // Login to get session
    const loginRes = await callApi("POST", "/api/auth/login", {
      body: { email, password },
    });
    expect(loginRes.status).toBe(200);

    // Extract session token from Set-Cookie
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const tokenMatch = setCookie.match(/playstake_session=([^;]+)/);
    expect(tokenMatch).toBeTruthy();
    const sessionToken = tokenMatch![1];

    // Logout
    const logoutRes = await callApi("POST", "/api/auth/logout", {
      sessionToken,
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.ok).toBe(true);

    // Verify the clear-cookie header is set
    const logoutCookie = logoutRes.headers.get("set-cookie");
    expect(logoutCookie).toContain("Max-Age=0");
  });
});
