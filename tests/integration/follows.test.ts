// =============================================================================
// Integration Tests: following streamers
// =============================================================================
// Follow and unfollow, privacy (only the streamer sees a count, nobody sees
// names), live-first lists, in-app alerts held back during a break, and
// go-live emails that need marketing consent and arrive once a day.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { callApi, createTestSession, disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  liveFollowedForAlerts,
  listFollowing,
  notifyFollowersWentLive,
} from "../../src/lib/follows/service.js";

const prisma = getTestPrisma();

async function makeUser(name: string, extra: Record<string, unknown> = {}) {
  const uid = crypto.randomUUID().substring(0, 8);
  return prisma.user.create({
    data: {
      email: `follow-${uid}@playstake-test.com`,
      displayName: `${name} ${uid}`,
      role: "PLAYER",
      emailVerified: true,
      kycStatus: "VERIFIED",
      ...extra,
    },
  });
}

async function makeStreamer(name: string, isLive: boolean) {
  const user = await makeUser(name);
  const slug = `${name.toLowerCase()}-${crypto.randomUUID().substring(0, 8)}`;
  await prisma.kickAccount.create({
    data: {
      userId: user.id,
      kickUserId: `kick-${slug}`,
      channelSlug: slug,
      displayName: name,
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive,
    },
  });
  return { ...user, slug };
}

const token = async (userId: string) => (await createTestSession(prisma as never, userId)).sessionToken;

let liveStreamer: Awaited<ReturnType<typeof makeStreamer>>;
let offlineStreamer: Awaited<ReturnType<typeof makeStreamer>>;

beforeAll(async () => {
  liveStreamer = await makeStreamer("Live", true);
  offlineStreamer = await makeStreamer("Offline", false);
});

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("following streamers", () => {
  it("follows and unfollows, idempotently, and never yourself", async () => {
    const fan = await makeUser("Fan");
    const t = await token(fan.id);

    expect((await callApi("POST", `/api/streamers/${liveStreamer.slug}/follow`, { sessionToken: t })).status).toBe(200);
    expect((await callApi("POST", `/api/streamers/${liveStreamer.slug}/follow`, { sessionToken: t })).status).toBe(200);
    expect(await prisma.streamerFollow.count({ where: { followerId: fan.id } })).toBe(1);

    expect((await callApi("DELETE", `/api/streamers/${liveStreamer.slug}/follow`, { sessionToken: t })).status).toBe(200);
    expect(await prisma.streamerFollow.count({ where: { followerId: fan.id } })).toBe(0);

    const self = await callApi("POST", `/api/streamers/${liveStreamer.slug}/follow`, {
      sessionToken: await token(liveStreamer.id),
    });
    expect(self.status).toBe(422);

    const missing = await callApi("POST", `/api/streamers/no-such-channel/follow`, { sessionToken: t });
    expect(missing.status).toBe(404);
  });

  it("keeps follows private: viewers see only their own status, the streamer only a count", async () => {
    const fan = await makeUser("Private fan");
    const t = await token(fan.id);
    await callApi("POST", `/api/streamers/${offlineStreamer.slug}/follow`, { sessionToken: t });

    const asFan = await callApi("GET", `/api/streamers/${offlineStreamer.slug}`, { sessionToken: t });
    expect(asFan.body.streamer.isFollowing).toBe(true);
    expect(asFan.body.streamer.followerCount).toBeNull();

    const asStreamer = await callApi("GET", `/api/streamers/${offlineStreamer.slug}`, {
      sessionToken: await token(offlineStreamer.id),
    });
    expect(asStreamer.body.streamer.followerCount).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(asStreamer.body)).not.toContain(fan.displayName);
  });

  it("lists live streamers first", async () => {
    const fan = await makeUser("Lister");
    await prisma.streamerFollow.createMany({
      data: [
        { followerId: fan.id, streamerId: offlineStreamer.id },
        { followerId: fan.id, streamerId: liveStreamer.id },
      ],
    });
    const list = await listFollowing(fan.id);
    expect(list.map((s) => s.channelSlug)).toEqual([liveStreamer.slug, offlineStreamer.slug]);

    const api = await callApi("GET", "/api/follows", { sessionToken: await token(fan.id) });
    expect(api.body.following[0].isLive).toBe(true);
  });

  it("holds back live alerts while the follower is on a break", async () => {
    const fan = await makeUser("Break fan");
    await prisma.streamerFollow.create({ data: { followerId: fan.id, streamerId: liveStreamer.id } });
    expect((await liveFollowedForAlerts(fan.id)).map((s) => s.channelSlug)).toEqual([liveStreamer.slug]);

    await prisma.playBreak.create({
      data: { userId: fan.id, type: "COOL_OFF", startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) },
    });
    expect(await liveFollowedForAlerts(fan.id)).toEqual([]);
  });
});

describe("go-live emails", () => {
  it("emails only followers who opted in to marketing and these emails, once a day", async () => {
    const streamer = await makeStreamer("Emailer", true);
    const consenting = await makeUser("Yes", { marketingConsent: true });
    const noConsent = await makeUser("NoMarketing", { marketingConsent: false });
    const optedOut = await makeUser("NoFollowEmails", { marketingConsent: true, followLiveEmails: false });
    const onBreak = await makeUser("OnBreak", { marketingConsent: true });
    await prisma.playBreak.create({
      data: { userId: onBreak.id, type: "COOL_OFF", startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) },
    });
    await prisma.streamerFollow.createMany({
      data: [consenting, noConsent, optedOut, onBreak].map((u) => ({ followerId: u.id, streamerId: streamer.id })),
    });

    await notifyFollowersWentLive([streamer.id]);
    await notifyFollowersWentLive([streamer.id]); // a second go-live the same day

    const sent = await prisma.emailOutbox.findMany({
      where: { template: "follow.streamer-live", userId: { in: [consenting.id, noConsent.id, optedOut.id, onBreak.id] } },
      select: { userId: true },
    });
    expect(sent.map((row) => row.userId)).toEqual([consenting.id]);
  });
});
