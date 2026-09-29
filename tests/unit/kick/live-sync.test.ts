import { describe, it, expect } from "vitest";
import { isChannelLiveNow } from "../../../src/lib/kick/live-sync.js";

const NOW = new Date("2026-09-29T12:00:00Z");
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);

describe("isChannelLiveNow", () => {
  it("follows Kick's API when it reports live", () => {
    expect(isChannelLiveNow({ isLive: false, lastLiveAt: null }, true, NOW)).toBe(true);
  });

  it("keeps a just-webhooked live flag while Kick's API still reads offline", () => {
    expect(isChannelLiveNow({ isLive: true, lastLiveAt: secondsAgo(5) }, false, NOW)).toBe(true);
  });

  it("drops a live flag once the grace window has passed", () => {
    expect(isChannelLiveNow({ isLive: true, lastLiveAt: secondsAgo(120) }, false, NOW)).toBe(false);
  });

  it("stays offline when the webhook already marked the channel offline", () => {
    expect(isChannelLiveNow({ isLive: false, lastLiveAt: secondsAgo(5) }, false, NOW)).toBe(false);
  });

  it("falls back to the stored flag when Kick's API is unreachable", () => {
    expect(isChannelLiveNow({ isLive: true, lastLiveAt: secondsAgo(600) }, null, NOW)).toBe(true);
    expect(isChannelLiveNow({ isLive: false, lastLiveAt: null }, null, NOW)).toBe(false);
  });
});
