import { describe, expect, it } from "vitest";
import {
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
  it.each(VIEWPORTS)("keeps all nodes inside %sx%s", (width, height) => {
    const orbit = computeOrbitLayout(width, height, 3.3);
    const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    const worldPerPx = viewHeight / height;
    const radiusPx = orbit.nodeVisualRadius / worldPerPx;

    defaultNodes.forEach((_, index) => {
      const [x, y] = nodePosition(index, defaultNodes.length, orbit);
      const screenX = width / 2 + x / worldPerPx;
      const screenY = height / 2 - y / worldPerPx;
      expect(screenX - radiusPx).toBeGreaterThanOrEqual(0);
      expect(screenX + radiusPx).toBeLessThanOrEqual(width);
      expect(screenY - radiusPx).toBeGreaterThanOrEqual(0);
      expect(screenY + radiusPx).toBeLessThanOrEqual(height);
    });
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
