import { describe, expect, it } from "vitest";
import { shouldSwallowClick } from "@/components/particle-nav/introSignal";

/* The bug this pins: on a phone the eight orbit links are `display: none`, so
   the guard that used to sit on their click handler protected nothing. The real
   mobile destinations are ordinary links inside the navigation, and the largest
   of them is a full-width card to the Geopolitical Brief across the middle of
   the screen. */
describe("handoff click guard", () => {
  const NAV_LIVE_AT = 1_000;

  it("lets every click through on a route that never ran an intro", () => {
    // navLiveAt stays 0 on the eight section pages and on /particle-demo.
    expect(shouldSwallowClick(0, 0)).toBe(false);
    expect(shouldSwallowClick(5_000, 0)).toBe(false);
  });

  it("swallows a gesture that began before the navigation existed", () => {
    // A finger resting on the screen through the intro's outro.
    expect(shouldSwallowClick(120, NAV_LIVE_AT)).toBe(true);
  });

  it("swallows a gesture that began while the navigation was still inert", () => {
    /* The case a time-based guard cannot catch: down at 950ms, up at 1_020ms.
       The touch starts against an inert tree and is dispatched against a live
       one, because WebKit hit-tests at touchend. */
    expect(shouldSwallowClick(950, NAV_LIVE_AT)).toBe(true);
  });

  it("swallows a click with no gesture behind it at all", () => {
    expect(shouldSwallowClick(0, NAV_LIVE_AT)).toBe(true);
  });

  it("allows the first deliberate gesture after the navigation goes live", () => {
    expect(shouldSwallowClick(NAV_LIVE_AT + 1, NAV_LIVE_AT)).toBe(false);
    expect(shouldSwallowClick(NAV_LIVE_AT + 4_000, NAV_LIVE_AT)).toBe(false);
  });

  it("stops guarding once the user has taken a turn", () => {
    // It is one-shot by construction: any later gesture postdates navLiveAt.
    const later = [NAV_LIVE_AT + 10, NAV_LIVE_AT + 50, NAV_LIVE_AT + 9_999];
    later.forEach((at) => expect(shouldSwallowClick(at, NAV_LIVE_AT)).toBe(false));
  });
});
