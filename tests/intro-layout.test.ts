import { describe, expect, it } from "vitest";
import {
  INTRO_ENTRY_LEGIBLE_FRACTION,
  INTRO_EXIT_LEGIBLE_FRACTION,
  INTRO_LINE_WIDTH_FRACTION,
  INTRO_SAFE_FRACTION,
  INTRO_TRAVEL_X_MIN,
  computeIntroLayout,
  introLayoutName,
  introLineBudget,
  introTravel,
  introTravelReach,
  quantizeIntroWidth,
} from "@/components/intro/introLayout";
import { ROLLING_STORY_LINES_BY_LAYOUT } from "@/components/intro/rolling-story-timeline";
import { viewSize } from "@/components/particle-nav/config";

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1254, 1254],
  [1440, 900],
  [2560, 1080],
] as const;

const PHONES = [
  [320, 568],
  [390, 844],
] as const;

describe("intro layout", () => {
  it.each(VIEWPORTS)("caps a line at 86vw of the frame at %sx%s", (width, height) => {
    const layout = computeIntroLayout(width, height);
    const { viewWidth } = viewSize(quantizeIntroWidth(width), height);
    expect(layout.lineMaxWidth).toBeLessThanOrEqual(
      viewWidth * INTRO_LINE_WIDTH_FRACTION + 1e-9,
    );
    expect(layout.lineMaxWidth).toBeGreaterThan(0);
  });

  /* The frame this camera sees is 6.79 world units tall at every viewport — the
     vertical extent does not depend on aspect. That is the reason only the
     horizontal solve is responsive, and it is worth failing loudly if the
     camera ever changes underneath that assumption. */
  it.each(VIEWPORTS)("keeps the vertical extent aspect-invariant at %sx%s", (width, height) => {
    expect(computeIntroLayout(width, height).halfHeight).toBeCloseTo(3.3966, 3);
  });

  it("puts the breakpoint at one place and reads the raw width for it", () => {
    expect(introLayoutName(719)).toBe("mobile");
    expect(introLayoutName(720)).toBe("desktop");
    // 719 buckets to 720, so a quantised width would have moved the breakpoint.
    expect(quantizeIntroWidth(719)).toBe(720);
    expect(computeIntroLayout(719, 844).name).toBe("mobile");
  });

  it("buckets the resample width without stepping backwards", () => {
    let previous = 0;
    const buckets = new Set<number>();
    for (let width = 320; width <= 720; width++) {
      const bucket = quantizeIntroWidth(width);
      expect(bucket).toBeGreaterThanOrEqual(previous);
      expect(quantizeIntroWidth(bucket)).toBe(bucket);
      previous = bucket;
      buckets.add(bucket);
    }
    // ~400 resize frames collapse to at most this many resamples.
    expect(buckets.size).toBeLessThanOrEqual(26);
  });
});

describe("intro travel", () => {
  /* The two legibility fractions were chosen as the widest windows at which the
     authored desktop spans still fit. If either moves, desktop changes — which
     is precisely the regression this pins. */
  it.each([
    [1440, 900],
    [2560, 1080],
  ])("leaves the authored desktop trajectory alone at %sx%s", (width, height) => {
    const layout = computeIntroLayout(width, height);
    const travel = introTravel(layout.halfWidth, layout.lineMaxWidth, layout.name);
    expect(travel.originBias).toEqual([-1.5, -0.725, -0.65]);
    expect(travel.originSpan).toEqual([-2.3, 1.45, 1.3]);
    expect(travel.windBias).toEqual([2.4, 1.7, -1.6]);
    expect(travel.windSpan).toEqual([3, 2.5, 3.2]);
  });

  it.each(PHONES)("keeps legible particles inside the frame at %sx%s", (width, height) => {
    const layout = computeIntroLayout(width, height);
    // The worst case is a line that uses the full cap.
    const travel = introTravel(layout.halfWidth, layout.lineMaxWidth, layout.name);
    const reach = introTravelReach(travel, layout.lineMaxWidth);
    const limit = layout.halfWidth * INTRO_SAFE_FRACTION;

    expect(reach.entry).toBeLessThanOrEqual(limit + 1e-6);
    expect(reach.exit).toBeLessThanOrEqual(limit + 1e-6);
  });

  it.each(PHONES)("still gives a phone a slide rather than a pop-in at %sx%s", (width, height) => {
    const layout = computeIntroLayout(width, height);
    const travel = introTravel(layout.halfWidth, layout.lineMaxWidth, layout.name);
    const entryX = Math.abs(travel.originBias[0]) + Math.abs(travel.originSpan[0]);
    expect(entryX).toBeGreaterThanOrEqual(INTRO_TRAVEL_X_MIN);
  });

  it("gives a short line the travel a full-width one cannot have", () => {
    const layout = computeIntroLayout(390, 844);
    const full = introTravel(layout.halfWidth, layout.lineMaxWidth, 'mobile');
    const short = introTravel(layout.halfWidth, layout.lineMaxWidth * 0.4, 'mobile');
    expect(Math.abs(short.originSpan[0])).toBeGreaterThan(Math.abs(full.originSpan[0]));
  });

  it("never scales the vertical spans, on any layout", () => {
    const phone = introTravel(computeIntroLayout(320, 568).halfWidth, 2.68, 'mobile');
    const desktop = introTravel(computeIntroLayout(1440, 900).halfWidth, 8.65, 'desktop');
    expect(phone.originBias[1]).toBe(desktop.originBias[1]);
    expect(phone.originSpan[1]).toBe(desktop.originSpan[1]);
    expect(phone.windBias[1]).toBe(desktop.windBias[1]);
    expect(phone.windSpan[1]).toBe(desktop.windSpan[1]);
  });

  it("bounds the fractions it solves against", () => {
    expect(INTRO_ENTRY_LEGIBLE_FRACTION).toBeGreaterThan(0);
    expect(INTRO_ENTRY_LEGIBLE_FRACTION).toBeLessThan(1);
    expect(INTRO_EXIT_LEGIBLE_FRACTION).toBeGreaterThan(0);
    expect(INTRO_EXIT_LEGIBLE_FRACTION).toBeLessThan(1);
  });
});

describe("intro line budget", () => {
  const effective = (line: string, budget: { maxParticles: number; density: number }) =>
    Math.min(budget.maxParticles, Math.max(850, line.length * budget.density));

  it.each(["mobile", "desktop"] as const)("thins the opening lines on %s", (name) => {
    const lines = ROLLING_STORY_LINES_BY_LAYOUT[name];
    const budgets = lines.map((_, index) => introLineBudget(index, lines.length, name, false));

    // Monotone in the dial. The effective count is not monotone and should not
    // be: it is `characters * density` capped, and the lines differ in length.
    budgets.forEach((budget, index) => {
      if (index === 0) return;
      expect(budget.density).toBeGreaterThanOrEqual(budgets[index - 1].density);
    });
    expect(budgets[0].density).toBeLessThan(budgets[budgets.length - 1].density * 0.85);

    /* The cap is what actually binds for the lines that carry the frame cost:
       the longest line of each layout asks for well over it, so a ramp that
       moved `density` alone would not change what is drawn. */
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a));
    const longestBudget = budgets[lines.indexOf(longest)];
    expect(longest.length * longestBudget.density).toBeGreaterThan(longestBudget.maxParticles);
    expect(effective(longest, longestBudget)).toBe(longestBudget.maxParticles);
  });

  /* The lightweight branch is a GPU-tier decision and does not consult the
     layout, so on a phone it can sit above the mobile figure — every coarse
     pointer is lightweight anyway, which makes the mobile branch unreachable
     there. Pin it against the desktop budget, which is the one it guards. */
  it("never asks a low tier for more than the desktop budget", () => {
    const lines = ROLLING_STORY_LINES_BY_LAYOUT.desktop;
    lines.forEach((_, index) => {
      const light = introLineBudget(index, lines.length, "desktop", true);
      const full = introLineBudget(index, lines.length, "desktop", false);
      expect(light.maxParticles).toBeLessThanOrEqual(full.maxParticles);
    });
  });
});
