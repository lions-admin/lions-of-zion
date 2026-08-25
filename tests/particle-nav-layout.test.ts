import { describe, expect, it } from "vitest";
import {
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

  /* A phone reserves ~34px at the bottom for the home indicator and ~47px at
     the top for the notch. Collapsing the two with `Math.max` charged the orbit
     the larger of them at both edges and still left the bottom node sitting on
     its own reservation. */
  it.each([
    [320, 568],
    [390, 844],
  ])("clears an asymmetric safe area at %sx%s", (width, height) => {
    const safeArea = { top: 47, right: 0, bottom: 34, left: 0 };
    const orbit = computeOrbitLayout(width, height, 3.3, safeArea);
    const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    const worldPerPx = viewHeight / height;
    const haloPx = orbit.nodeHaloRadius / worldPerPx;

    defaultNodes.forEach((_, index) => {
      const [, y] = nodePosition(index, defaultNodes.length, orbit);
      const screenY = height / 2 - y / worldPerPx;
      expect(screenY - haloPx).toBeGreaterThanOrEqual(safeArea.top);
      expect(screenY + haloPx).toBeLessThanOrEqual(height - safeArea.bottom);
    });

    /* Each edge is charged its own reservation and no more: the top and bottom
       nodes come to rest exactly on theirs, which is only possible because the
       centre moves by half the difference between them. Under the old
       `Math.max` collapse both edges paid the notch, and the orbit was smaller
       for it while the bottom node still sat on its own reservation. */
    const centerYPx = -orbit.centerY / worldPerPx;
    expect(centerYPx).toBeCloseTo((safeArea.top - safeArea.bottom) / 2, 6);

    const topNode = nodePosition(0, defaultNodes.length, orbit);
    const bottomNode = nodePosition(4, defaultNodes.length, orbit);
    const topEdge = height / 2 - topNode[1] / worldPerPx - haloPx;
    const bottomEdge = height / 2 - bottomNode[1] / worldPerPx + haloPx;
    const edgeGapPx = Math.min(64, Math.max(24, Math.min(width, height) * 0.045));
    expect(topEdge).toBeCloseTo(safeArea.top + edgeGapPx, 6);
    expect(bottomEdge).toBeCloseTo(height - safeArea.bottom - edgeGapPx, 6);
  });

  it("keeps the configured clockwise order beginning at twelve", () => {
    expect(defaultNodes.map((node) => node.id)).toEqual([
      "geopolitical-brief",
      "support-us",
      "war-update",
      "october-7",
      "our-heroes",
      "israels-story",
      "fake-resistance",
      "we-are",
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
