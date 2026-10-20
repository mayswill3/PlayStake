// =============================================================================
// Integration Tests: finding players — usernames, search, profiles, follows,
// blocks
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import {
  callApi,
  createTestSession,
  disconnectTestPrisma,
  getTestPrisma,
  purgeComplianceRecords,
} from "./helpers.js";
import type { TxClient } from "../../src/lib/db/client.js";
import { MATCH_RULES_VERSION } from "../../src/lib/rules.js";
import { createChallenge } from "../../src/lib/lobby/service.js";
import { listFollowing } from "../../src/lib/follows/service.js";

const prisma = getTestPrisma();
const createdUserIds: string[] = [];
let gameId: string;
// Every name in this file shares a random prefix, so searches only match
// users this run created.
const RUN = `t${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;

beforeAll(async () => {
  const dev = await prisma.user.upsert({
    where: { email: "players-test-dev@playstake-test.com" },
    update: {},
    create: { email: "players-test-dev@playstake-test.com", role: "DEVELOPER", displayName: "Players Test Dev" },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: dev.id },
    update: {},
    create: { userId: dev.id, companyName: "Players Test", contactEmail: "players-test-dev@playstake-test.com", isApproved: true },
  });
  const game = await prisma.game.upsert({
    where: { slug: "darts-301" },
    update: {},
    create: { developerProfileId: profile.id, name: "Darts 301", slug: "darts-301", isActive: true, platformFeePercent: 0 },
  });
  gameId = game.id;
});

afterAll(async () => {
  await prisma.userBlock.deleteMany({ where: { blockerId: { in: createdUserIds } } });
  await prisma.kickAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await purgeComplianceRecords(prisma, createdUserIds);
  await disconnectTestPrisma();
});

async function makeUser(name: string, data: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email: `${name}-${crypto.randomUUID().slice(0, 6)}@playstake-test.com`,
      displayName: `${RUN} ${name}`,
      username: `${RUN}_${name}`.toLowerCase().slice(0, 20),
      role: "PLAYER",
      emailVerified: true,
      kycStatus: "VERIFIED",
      matchRulesVersion: MATCH_RULES_VERSION,
      ...data,
    },
  });
  createdUserIds.push(user.id);
  const { sessionToken } = await createTestSession(prisma as unknown as TxClient, user.id);
  return { ...user, username: user.username!, token: sessionToken };
}

async function makeLiveStreamer(name: string) {
  const user = await makeUser(name);
  await prisma.kickAccount.create({
    data: {
      userId: user.id,
      kickUserId: `kick-${crypto.randomUUID()}`,
      channelSlug: `${RUN}-${name}`.toLowerCase(),
      displayName: name,
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: true,
      declaredGameId: gameId,
    },
  });
  return user;
}

let ipCounter = 0;
const search = (token: string, q: string) =>
  callApi("GET", `/api/users/search?q=${encodeURIComponent(q)}`, {
    sessionToken: token,
    headers: { "x-forwarded-for": `10.88.0.${++ipCounter % 250}` },
  });
const names = (res: { body: { results: { username: string }[] } }) => res.body.results.map((r) => r.username);

describe("player search", () => {
  it("finds streamers and players who opted in, and no one else", async () => {
    const viewer = await makeUser("viewer");
    const streamer = await makeLiveStreamer("streamer");
    const open = await makeUser("open", { discoverable: true });
    const hidden = await makeUser("hidden");
    const suspended = await makeUser("suspended", { discoverable: true, accountStatus: "SUSPENDED" });
    const gamstop = await makeUser("gamstop", { discoverable: true, gamstopStatus: "EXCLUDED" });
    const onBreak = await makeUser("onbreak", { discoverable: true });
    await prisma.playBreak.create({
      data: { userId: onBreak.id, type: "COOL_OFF", startsAt: new Date(), endsAt: new Date(Date.now() + 864e5) },
    });

    const res = await search(viewer.token, RUN);
    expect(res.status).toBe(200);
    const found = names(res);
    expect(found).toContain(streamer.username);
    expect(found).toContain(open.username);
    for (const missing of [viewer, hidden, suspended, gamstop, onBreak]) {
      expect(found).not.toContain(missing.username);
    }
    // Live streamers come first, and results carry no money or match data.
    expect(res.body.results[0].username).toBe(streamer.username);
    expect(Object.keys(res.body.results[0]).sort()).toEqual(
      ["avatarUrl", "channelSlug", "displayName", "isLive", "isStreamer", "username"],
    );
  });

  it("ignores one-letter queries and needs a session", async () => {
    const viewer = await makeUser("short");
    expect((await search(viewer.token, "a")).body.results).toEqual([]);
    expect((await callApi("GET", "/api/users/search?q=abc")).status).toBe(401);
  });
});

describe("profiles and following", () => {
  it("shows identity only, and lets you follow a player who opted in", async () => {
    const viewer = await makeUser("fan");
    const player = await makeUser("friend", { discoverable: true });

    const profile = await callApi("GET", `/api/users/${player.username}`, { sessionToken: viewer.token });
    expect(profile.status).toBe(200);
    expect(profile.body.profile).toMatchObject({ username: player.username, isStreamer: false, isFollowing: false });
    expect(profile.body.profile).not.toHaveProperty("balance");

    expect((await callApi("POST", `/api/users/${player.username}/follow`, { sessionToken: viewer.token })).status).toBe(200);
    const following = await listFollowing(viewer.id);
    expect(following.map((f) => f.username)).toContain(player.username);

    // Turning findability off removes them from the follower's list.
    await prisma.user.update({ where: { id: player.id }, data: { discoverable: false } });
    expect((await listFollowing(viewer.id)).map((f) => f.username)).not.toContain(player.username);
  });

  it("hides players who haven't opted in", async () => {
    const viewer = await makeUser("nosy");
    const hidden = await makeUser("private");
    expect((await callApi("GET", `/api/users/${hidden.username}`, { sessionToken: viewer.token })).status).toBe(404);
    expect((await callApi("POST", `/api/users/${hidden.username}/follow`, { sessionToken: viewer.token })).status).toBe(404);
    // Your own profile always works.
    const own = await callApi("GET", `/api/users/${hidden.username}`, { sessionToken: hidden.token });
    expect(own.body.profile.isSelf).toBe(true);
  });
});

describe("blocking", () => {
  it("removes follows, hides the blocker, and stops challenges both ways", async () => {
    const streamer = await makeLiveStreamer("blocker");
    const pest = await makeUser("pest", { discoverable: true });
    await prisma.ledgerAccount.create({ data: { userId: pest.id, accountType: "PLAYER_BALANCE", balance: 50 } });

    await callApi("POST", `/api/users/${streamer.username}/follow`, { sessionToken: pest.token });
    const blocked = await callApi("POST", `/api/users/${pest.username}/block`, { sessionToken: streamer.token });
    expect(blocked.status).toBe(200);

    expect(await prisma.streamerFollow.count({ where: { followerId: pest.id, streamerId: streamer.id } })).toBe(0);
    expect(names(await search(pest.token, RUN))).not.toContain(streamer.username);
    expect((await callApi("GET", `/api/users/${streamer.username}`, { sessionToken: pest.token })).status).toBe(404);
    expect((await callApi("POST", `/api/users/${streamer.username}/follow`, { sessionToken: pest.token })).status).toBe(404);

    // The blocker can still open the profile, to unblock.
    const view = await callApi("GET", `/api/users/${pest.username}`, { sessionToken: streamer.token });
    expect(view.body.profile.blockedByMe).toBe(true);

    await expect(
      createChallenge({
        challengerUserId: pest.id,
        streamerChannelSlug: `${RUN}-blocker`.toLowerCase(),
        stakeAmount: 500,
        acceptMatchRules: true,
      }),
    ).rejects.toThrow(/can't challenge this player/);

    const list = await callApi("GET", "/api/users/blocked", { sessionToken: streamer.token });
    expect(list.body.blocked.map((b: { username: string }) => b.username)).toEqual([pest.username]);

    await callApi("DELETE", `/api/users/${pest.username}/block`, { sessionToken: streamer.token });
    expect(names(await search(pest.token, RUN))).toContain(streamer.username);
  });
});

describe("usernames", () => {
  it("validates, normalises and limits changes to once every 30 days", async () => {
    const user = await makeUser("renamer");
    const taken = await makeUser("taken");

    const bad = await callApi("PATCH", "/api/user/profile", { sessionToken: user.token, body: { username: "no spaces!" } });
    expect(bad.status).toBe(422);
    const clash = await callApi("PATCH", "/api/user/profile", { sessionToken: user.token, body: { username: taken.username } });
    expect(clash.status).toBe(409);
    const reserved = await callApi("PATCH", "/api/user/profile", { sessionToken: user.token, body: { username: "admin" } });
    expect(reserved.status).toBe(422);

    const fresh = `@${RUN}_New`;
    const ok = await callApi("PATCH", "/api/user/profile", { sessionToken: user.token, body: { username: fresh } });
    expect(ok.status).toBe(200);
    expect(ok.body.username).toBe(fresh.slice(1).toLowerCase());
    expect(ok.body.usernameChangeAvailableAt).not.toBeNull();

    const again = await callApi("PATCH", "/api/user/profile", { sessionToken: user.token, body: { username: `${RUN}_again` } });
    expect(again.status).toBe(409);
  });

  it("gives new accounts a username at sign-up", async () => {
    const email = `signup-${crypto.randomUUID().slice(0, 6)}@playstake-test.com`;
    const res = await callApi("POST", "/api/auth/register", {
      headers: { "x-forwarded-for": "10.89.0.1" },
      body: {
        email,
        password: "Str0ng!Passw0rd",
        displayName: "Kwasi 88",
        dateOfBirth: "1990-01-01",
        confirmAge: true,
        acceptTerms: true,
      },
    });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) createdUserIds.push(user.id);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(user?.username).toMatch(/^kwasi88(_[0-9a-f]{5})?$/);
  });
});
