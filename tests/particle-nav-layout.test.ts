import { describe, expect, it } from "vitest";
import {
  CHAT_DOCK_PX,
  MOBILE_MAX_WIDTH,
  NODE_BOTTOM_RESERVE_PX,
  NODE_HALO_PX,
  NODE_HALO_RATIO,
  computeOrbitLayout,
  defaultNodes,
  nodePosition,
} from "@/components/particle-nav/config";
import {
  ROLLING_EXIT_DURATION,
  ROLLING_LINE_CADENCE_BY_LAYOUT,
  ROLLING_POOL_SIZE,
  getRollingFinalTime,
  getRollingStoryFrame,
} from "@/components/intro/rolling-story-timeline";
import type { StoryLayout } from "@/components/intro/story-timeline";

const CAMERA_Z = 8.2;
const CAMERA_FOV = 45;
const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1254, 1254],
  [1440, 900],
  [2560, 1080],
] as const;

describe("particle navigation layout", () => {
  it.each(VIEWPORTS)("keeps every node's drawn extent inside %sx%s", (width, height) => {
    const orbit = computeOrbitLayout(width, height, 3.3);
    const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    const worldPerPx = viewHeight / height;
    /* The halo, not the ring. The ring was always inside the frame; the jitter,
       sprite spill and bloom drawn past it were what clipped. */
    const haloPx = orbit.nodeHaloRadius / worldPerPx;

    defaultNodes.forEach((_, index) => {
      const [x, y] = nodePosition(index, defaultNodes.length, orbit);
      const screenX = width / 2 + x / worldPerPx;
      const screenY = height / 2 - y / worldPerPx;
      expect(screenX - haloPx).toBeGreaterThanOrEqual(0);
      expect(screenX + haloPx).toBeLessThanOrEqual(width);
      expect(screenY - haloPx).toBeGreaterThanOrEqual(0);
      expect(screenY + haloPx).toBeLessThanOrEqual(height);
    });
  });

  /* `nodeVisualRadius` is three contracts at once: the particle ring, the DOM
     link's half-box in `styles.module.css`, and the connector's occlusion
     boundary. Nothing but this test says so, and the halo work is exactly the
     kind of change that would have silently widened it. */
  it.each(VIEWPORTS)("keeps the node radius equal to the DOM half-box at %sx%s", (width, height) => {
    const orbit = computeOrbitLayout(width, height, 3.3);
    const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    const worldPerPx = viewHeight / height;
    // `.link { width: clamp(5.5rem, 13.2vmin, 10.25rem) }`, halved. Slope and
    // ceiling grown on 2026-08-27 with the ring, which the long tracked-caps
    // labels overflowed on desktop; the 44px floor stays for the phone solve.
    const cssHalfBoxPx = Math.min(82, Math.max(44, Math.min(width, height) * 0.066));

    expect(orbit.nodeVisualRadius / worldPerPx).toBeCloseTo(cssHalfBoxPx, 6);
    expect(orbit.nodeHaloRadius).toBeCloseTo(
      (cssHalfBoxPx * (1 + NODE_HALO_RATIO) + NODE_HALO_PX) * worldPerPx,
      6,
    );
  });

  /* The reserve is the whole point of splitting the vertical solve: the bottom
     node has to clear a URL bar that does not appear in any measurement. */
  it.each(VIEWPORTS)("raises the bottom node only where chrome overlays it at %sx%s", (width, height) => {
    const orbit = computeOrbitLayout(width, height, 3.3);
    const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    const worldPerPx = viewHeight / height;
    const phone = width < MOBILE_MAX_WIDTH;

    if (phone) {
      // No safe area passed, so the reserve is the chat dock over the URL-bar floor.
      const reservedBottom = Math.max(NODE_BOTTOM_RESERVE_PX, CHAT_DOCK_PX);
      expect(orbit.centerY / worldPerPx).toBeCloseTo(reservedBottom / 2, 6);
    } else {
      // Desktop composition is untouched: the reported viewport is the visible one.
      expect(orbit.centerY).toBe(0);
    }

    const centred = { ...orbit, centerY: 0 };
    const bottom = nodePosition(4, defaultNodes.length, orbit);
    const top = nodePosition(0, defaultNodes.length, orbit);
    expect(bottom[1]).toBeGreaterThanOrEqual(nodePosition(4, defaultNodes.length, centred)[1]);
    expect(bottom[1]).toBeLessThan(0);
    expect(top[1]).toBeGreaterThan(0);
  });

  /* The floors are emergency clamps, not the operating point. 320x568 clears
     the radiusX floor by under 4%, so the next bump to any reservation could
     hand the layout to the clamp — at which point nodes go back to overflowing
     and every containment assertion above still passes. */
  it.each(VIEWPORTS)("does not fall back on the radius floors at %sx%s", (width, height) => {
    const orbit = computeOrbitLayout(width, height, 3.3);
    expect(orbit.radiusX).toBeGreaterThan(0.9);
    expect(orbit.radiusY).toBeGreaterThan(1.25);
  });

  /* A phone reserves ~34px at the bottom for the home indicator and ~47px at
     the top for the notch. Collapsing the two with `Math.max` charged the orbit
     the larger of them at both edges and still left the bottom node sitting on
     its own reservation. */
  it.each([
    [320, 568],
    [390, 844],
  ])("clears an asymmetric safe area at %sx%s", (width, height) => {
    // Both phones: the chat dock stacks on the 34px indicator and outranks the URL-bar floor.
    const safeArea = { top: 47, right: 0, bottom: 34, left: 0 };
    const reservedBottom = Math.max(NODE_BOTTOM_RESERVE_PX, safeArea.bottom + CHAT_DOCK_PX);
    const orbit = computeOrbitLayout(width, height, 3.3, safeArea);
    const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    const worldPerPx = viewHeight / height;
    const haloPx = orbit.nodeHaloRadius / worldPerPx;

    defaultNodes.forEach((_, index) => {
      const [, y] = nodePosition(index, defaultNodes.length, orbit);
      const screenY = height / 2 - y / worldPerPx;
      expect(screenY - haloPx).toBeGreaterThanOrEqual(safeArea.top);
      expect(screenY + haloPx).toBeLessThanOrEqual(height - reservedBottom);
    });

    /* Each edge is charged its own reservation and no more: the top and bottom
       nodes come to rest exactly on theirs, which is only possible because the
       centre moves by half the difference between them. Under the old
       `Math.max` collapse both edges paid the notch, and the orbit was smaller
       for it while the bottom node still sat on its own reservation. */
    const centerYPx = -orbit.centerY / worldPerPx;
    expect(centerYPx).toBeCloseTo((safeArea.top - reservedBottom) / 2, 6);

    const topNode = nodePosition(0, defaultNodes.length, orbit);
    const bottomNode = nodePosition(4, defaultNodes.length, orbit);
    const topEdge = height / 2 - topNode[1] / worldPerPx - haloPx;
    const bottomEdge = height / 2 - bottomNode[1] / worldPerPx + haloPx;
    const edgeGapPx = Math.min(64, Math.max(24, Math.min(width, height) * 0.045));
    expect(topEdge).toBeCloseTo(safeArea.top + edgeGapPx, 6);
    expect(bottomEdge).toBeCloseTo(height - reservedBottom - edgeGapPx, 6);
  });

  it("keeps the configured clockwise order beginning at twelve", () => {
    // Array index is the spoke angle, the DOM/tab order and the "File NN / 08"
    // number all at once, so this list is the contract and not a snapshot.
    // `we-are` sits at index 1 and `support-us` last on purpose: tab order is
    // the one genuinely sequential reading of the ring, and the ask should not
    // precede the identity. See `defaultNodes`' header in `config.ts`.
    expect(defaultNodes.map((node) => node.id)).toEqual([
      "geopolitical-brief",
      "we-are",
      "war-update",
      "october-7",
      "our-heroes",
      "israels-story",
      "fake-resistance",
      "support-us",
    ]);
    const orbit = computeOrbitLayout(1440, 900, 3.3);
    const top = nodePosition(0, defaultNodes.length, orbit);
    const right = nodePosition(2, defaultNodes.length, orbit);
    const bottom = nodePosition(4, defaultNodes.length, orbit);
    expect(Math.abs(top[0])).toBeLessThan(1e-9);
    expect(top[1]).toBeGreaterThan(0);
    expect(right[0]).toBeGreaterThan(0);
    expect(bottom[1]).toBeLessThan(0);
  });
});

/* The intro is the same scene's other act, and its timing fails the way the
   orbit's geometry does: silently, and only on one layout. Nothing else in the
   suite looks at it — these are the numbers the design audit found nobody was
   measuring (`home-scene-mobile-intro-runs-nine-seconds-longer`). */
describe("intro rolling timeline", () => {
  const STORY_LAYOUTS = [
    "desktop",
    "mobile",
  ] as const satisfies readonly StoryLayout[];
  /* 60Hz, the rate `Scene.tsx` actually samples this timeline at, so a
     violation the display would show is a violation this loop sees. */
  const SAMPLE_STEP = 1 / 60;

  it.each(STORY_LAYOUTS)("keeps %s's cadence at or above the dissolve", (layout) => {
    /* The governing constant. Below it a line has to be retired before it has
       finished dissolving, which overruns the sprite pool and stacks two
       dissolving clouds in row 0 — see the header of
       `rolling-story-timeline.ts`. The two assertions below are consequences
       of this one; it is stated separately so a retune fails on the cause
       rather than on the symptom. */
    expect(ROLLING_LINE_CADENCE_BY_LAYOUT[layout]).toBeGreaterThanOrEqual(
      ROLLING_EXIT_DURATION,
    );
  });

  it.each(STORY_LAYOUTS)(
    "gives every live %s line its own pool slot and its own row",
    (layout) => {
      const finalTime = getRollingFinalTime(layout);
      let maxActive = 0;
      let maxDissolving = 0;
      let slotCollisions = 0;

      for (let time = 0; time <= finalTime; time += SAMPLE_STEP) {
        const { activeLines } = getRollingStoryFrame(time, layout);
        maxActive = Math.max(maxActive, activeLines.length);
        /* `IntroText` draws one sprite per slot and keys the slot on
           `index % ROLLING_POOL_SIZE`, so two live lines sharing a slot is one
           of them silently not being drawn. */
        const slots = new Set(activeLines.map((line) => line.slot));
        if (slots.size !== activeLines.length) slotCollisions += 1;
        maxDissolving = Math.max(
          maxDissolving,
          activeLines.filter((line) => line.disperse > 0 && line.disperse < 1)
            .length,
        );
      }

      expect(slotCollisions).toBe(0);
      expect(maxActive).toBeLessThanOrEqual(ROLLING_POOL_SIZE);
      /* `getNormalPosition` clamps everything past the window to row 0, so a
         second concurrent dissolve is two particle clouds in one row. */
      expect(maxDissolving).toBeLessThanOrEqual(1);
    },
  );

  it("does not spend more of a phone's time than a desktop's on twelve sentences", () => {
    /* The line count is art direction and the sentences are content, so the
       phone must not be charged for the narrower measure. 10% is the budget
       the last retune landed inside — 9.7%, 42.33s against 38.58s — and the
       header of `rolling-story-timeline.ts` records why the rest of that gap
       is the cost of the line breaks rather than of the clock. A mobile array
       that grows past 21 lines fails here, and correctly: it cannot be paid
       for out of cadence without breaking the assertion above. */
    const desktop = getRollingFinalTime("desktop");
    const mobile = getRollingFinalTime("mobile");
    expect(Math.abs(mobile / desktop - 1)).toBeLessThanOrEqual(0.1);
  });
});
