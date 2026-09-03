import { describe, expect, it } from "vitest";
import {
  ASSEMBLED_LION_SCALE,
  INTRO_CHROME_COMPACT_MAX_WIDTH,
  LION_CROWN_MARGIN_PX,
  SETTLED_LION_RETENTION,
  SETTLED_LION_SCALE,
  SETTLED_LION_Y,
  computeIntroLayout,
  introChromeTopPx,
  settledLionPlacement,
} from "@/components/intro/introLayout";
import {
  LION_LOCAL_BOTTOM,
  LION_LOCAL_TOP,
  computeOrbitLayout,
  viewSize,
  type SafeAreaInsets,
} from "@/components/particle-nav/config";

/**
 * Where the lion settles after its rise (plan §3, Phase B). Everything here
 * is the pure function `Scene.tsx` memoises, driven by the same orbit layout
 * and viewport the scene uses — no canvas, no GPU buffer, no font.
 */

const INTRO_RADIUS = 3.3; // `CinematicIntroGate`'s radius prop
const NO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

interface Viewport {
  label: string;
  width: number;
  height: number;
  safeArea: SafeAreaInsets;
}

/** The plan's required visual viewport matrix (§8). */
const PLAN_VIEWPORTS: readonly Viewport[] = [
  { label: "desktop 1440×900", width: 1440, height: 900, safeArea: NO_INSETS },
  { label: "wide desktop 1920×1080", width: 1920, height: 1080, safeArea: NO_INSETS },
  { label: "tablet portrait 768×1024", width: 768, height: 1024, safeArea: NO_INSETS },
  {
    label: "iPhone 390×844 (47px notch)",
    width: 390,
    height: 844,
    safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
  },
  { label: "small phone 320×568", width: 320, height: 568, safeArea: NO_INSETS },
];

function place(viewport: Viewport) {
  const orbit = computeOrbitLayout(
    viewport.width,
    viewport.height,
    INTRO_RADIUS,
    viewport.safeArea,
  );
  return {
    orbit,
    placement: settledLionPlacement(
      viewport.width,
      viewport.height,
      viewport.safeArea,
      orbit,
    ),
  };
}

describe("settled lion scale targets", () => {
  it("desktop starts at 1.20 × centerScale and mobile at 0.95 × centerScale", () => {
    expect(SETTLED_LION_SCALE.desktop).toBe(1.2);
    expect(SETTLED_LION_SCALE.mobile).toBe(0.95);
    /* The retired story sizes must not come back through the constants. */
    expect(SETTLED_LION_SCALE.desktop).toBeGreaterThan(0.55);
    expect(SETTLED_LION_SCALE.mobile).toBeGreaterThan(0.46);
  });

  it("reaches the target scale wherever the crown cap does not bind", () => {
    for (const viewport of PLAN_VIEWPORTS) {
      const { orbit, placement } = place(viewport);
      const target = SETTLED_LION_SCALE[placement.name] * orbit.centerScale;
      expect(placement.scale, viewport.label).toBeLessThanOrEqual(target + 1e-9);
      /* The cap only ever trims: scale is within 2% of target on every plan
         viewport, and exactly the target where the crown clears the ceiling
         at the tuning Y. */
      expect(placement.scale, viewport.label).toBeGreaterThan(target * 0.98);
      if (placement.y >= SETTLED_LION_Y[placement.name] - 1e-9) {
        expect(placement.scale, viewport.label).toBeCloseTo(target, 12);
      }
    }
  });

  it("the settled lion is clearly larger than the retired story size", () => {
    for (const viewport of PLAN_VIEWPORTS) {
      const { orbit, placement } = place(viewport);
      const retired = (placement.name === "mobile" ? 0.46 : 0.55) * orbit.centerScale;
      expect(placement.scale, viewport.label).toBeGreaterThan(retired * 1.7);
    }
  });

  it("the assembled scale is the one Scene used before Phase B", () => {
    expect(ASSEMBLED_LION_SCALE).toEqual({ desktop: 2.65, mobile: 1.65 });
    for (const viewport of PLAN_VIEWPORTS) {
      const { orbit, placement } = place(viewport);
      expect(placement.assembledScale, viewport.label).toBeCloseTo(
        ASSEMBLED_LION_SCALE[placement.name] * orbit.centerScale,
        12,
      );
    }
  });
});

describe("retention floors", () => {
  it("keeps at least 42% of the assembled desktop scale and 55% of mobile", () => {
    expect(SETTLED_LION_RETENTION).toEqual({ desktop: 0.42, mobile: 0.55 });
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      const retention = SETTLED_LION_RETENTION[placement.name];
      expect(placement.minScale, viewport.label).toBeCloseTo(
        placement.assembledScale * retention,
        12,
      );
      expect(placement.scale, viewport.label).toBeGreaterThanOrEqual(placement.minScale);
    }
  });

  it("the target itself clears the floor, so the floor is a guard rather than a bind", () => {
    for (const name of ["desktop", "mobile"] as const) {
      expect(SETTLED_LION_SCALE[name]).toBeGreaterThan(
        ASSEMBLED_LION_SCALE[name] * SETTLED_LION_RETENTION[name],
      );
    }
  });

  it("an absurd safe-area shrinks the lion no further than the floor, and still lowers it", () => {
    /* A 300px notch on an 844px phone is not a device; it is the case where
       the crown cap would otherwise eat the whole emblem. */
    const width = 390;
    const height = 844;
    const safeArea = { top: 300, right: 0, bottom: 34, left: 0 };
    const orbit = computeOrbitLayout(width, height, INTRO_RADIUS, safeArea);
    const placement = settledLionPlacement(width, height, safeArea, orbit);
    expect(placement.scale).toBeCloseTo(placement.minScale, 12);
    expect(placement.y).toBeLessThan(SETTLED_LION_Y.mobile);
    /* The crown is still inside the ceiling: the Y cap is applied last. */
    expect(placement.crownTop).toBeLessThanOrEqual(placement.ceiling + 1e-9);
  });
});

describe("crown containment on the plan viewports", () => {
  it("the crown's highest particle stays under the visible, safe and chrome-free edge", () => {
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      const { viewHeight, worldPerPx } = viewSize(viewport.width, viewport.height);
      const visibleTop = viewHeight / 2;
      const safeTop = visibleTop - viewport.safeArea.top * worldPerPx;
      const chromeTop = safeTop - introChromeTopPx(viewport.width) * worldPerPx;

      expect(placement.crownTop, viewport.label).toBeLessThanOrEqual(placement.ceiling + 1e-9);
      expect(placement.ceiling, viewport.label).toBeLessThanOrEqual(chromeTop);
      /* And in px, with the sprite/bloom margin: the crown's topmost particle
         is at least `LION_CROWN_MARGIN_PX` under the chrome band. */
      const clearancePx = (chromeTop - placement.crownTop) / worldPerPx;
      expect(clearancePx, viewport.label).toBeGreaterThanOrEqual(LION_CROWN_MARGIN_PX - 1e-6);
    }
  });

  it("the crown edge is derived from the group transform, not a separate estimate", () => {
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      expect(placement.crownTop, viewport.label).toBeCloseTo(
        placement.y + LION_LOCAL_TOP * placement.scale,
        12,
      );
      expect(placement.bottom, viewport.label).toBeCloseTo(
        placement.y + LION_LOCAL_BOTTOM * placement.scale,
        12,
      );
    }
  });

  it("the lion is never lowered below the tuning Y by more than the crown cap requires", () => {
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      const targetY = SETTLED_LION_Y[placement.name];
      expect(placement.y, viewport.label).toBeLessThanOrEqual(targetY + 1e-9);
      /* Where the cap binds, the crown sits exactly on the ceiling — no
         slack was left on the table. */
      if (placement.y < targetY - 1e-9) {
        expect(placement.crownTop, viewport.label).toBeCloseTo(placement.ceiling, 12);
      }
      /* And it is a small trim on every plan viewport, not a relocation. */
      expect(targetY - placement.y, viewport.label).toBeLessThan(0.05);
    }
  });

  it("the left-aligned masthead never meets the centred crown", () => {
    /* The reserve counts the chrome's top padding, not the masthead label,
       which is only sound while the label cannot meet the crown: it must be
       clear of it horizontally or sit entirely above it. Both are pinned
       from the CSS facts rather than a screenshot.

       Label width: JetBrains Mono advances 0.6em, `--t-data-tracking` adds
       0.08em, so a 12px uppercase span of 13 characters is 106px; the
       desktop masthead is two such spans plus a 12px gap, 12px padding and
       a 1px rule (237px), the compact one a single 10.4px span (92px). Each
       is bounded here with slack. Left inset is `clamp(1rem, 3vw, 2.75rem)`,
       1rem when compact; the band's bottom is the top inset plus
       `--sp-2` padding both sides, one `--t-data-lh` line and the rule. */
    const crownHalfWidthLocal = 0.44; // bake x-extent of the crown rows
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      const { viewHeight, worldPerPx } = viewSize(viewport.width, viewport.height);
      const compact = viewport.width <= INTRO_CHROME_COMPACT_MAX_WIDTH;
      const insetLeftPx = compact ? 16 : Math.min(44, Math.max(16, viewport.width * 0.03));
      const mastheadRightPx = insetLeftPx + (compact ? 110 : 250);
      const fontPx = compact ? 0.65 * 16 : 0.75 * 16;
      const mastheadBottomPx =
        viewport.safeArea.top + introChromeTopPx(viewport.width) + 8 + fontPx * 1.45 + 8 + 1;

      const crownLeftPx =
        viewport.width / 2 - (crownHalfWidthLocal * placement.scale) / worldPerPx;
      const crownTopPx = (viewHeight / 2 - placement.crownTop) / worldPerPx;
      const clearSideways = crownLeftPx > mastheadRightPx;
      const clearBelow = crownTopPx >= mastheadBottomPx;
      expect(
        clearSideways || clearBelow,
        `${viewport.label}: crown left ${crownLeftPx.toFixed(1)}px vs masthead right ${mastheadRightPx.toFixed(1)}px; crown top ${crownTopPx.toFixed(1)}px vs masthead bottom ${mastheadBottomPx.toFixed(1)}px`,
      ).toBe(true);
    }
  });
});

describe("the text column under the settled lion", () => {
  it("row 0's top edge sits below the lion's bottom edge on every plan viewport", () => {
    /* `computeIntroLayout` owns `rowTop`; rows are placed at
       `rowTop - (row + enteringOffset) * rowGap` with row >= 0, so row 0 is
       the highest a line ever sits. A line's glyph cloud is centred on its
       row, and Gentilis caps with descenders span under one em, so half an
       em at the layout's `fontScale` bounds the glyph half-height. */
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      const intro = computeIntroLayout(viewport.width, viewport.height);
      expect(intro.name, viewport.label).toBe(placement.name);
      const row0Top = intro.rowTop + intro.fontScale * 0.5;
      expect(placement.bottom, viewport.label).toBeGreaterThan(row0Top);
    }
  });

  it("does not depend on the text being able to reach the lion: no overlap even at the entering offset", () => {
    for (const viewport of PLAN_VIEWPORTS) {
      const { placement } = place(viewport);
      const intro = computeIntroLayout(viewport.width, viewport.height);
      /* Entering lines start one row lower and rise, so they are further
         from the lion, never closer. */
      const enteringTop = intro.rowTop - intro.rowGap + intro.fontScale * 0.5;
      expect(enteringTop, viewport.label).toBeLessThan(placement.bottom);
    }
  });
});
