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
    // `.link { width: clamp(5.5rem, 11.2vmin, 8.5rem) }`, halved.
    const cssHalfBoxPx = Math.min(68, Math.max(44, Math.min(width, height) * 0.056));

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
