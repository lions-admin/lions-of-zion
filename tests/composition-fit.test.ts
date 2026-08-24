import { describe, expect, it } from "vitest";
import {
  BREATH_AMPLITUDE,
  FACE_V,
  PARALLAX,
  PLANE_H,
  PLANE_W,
  fitComposition,
  visibleHeight,
} from "@/components/graphics/viewport";

/**
 * Stage 0's acceptance criteria, as invariants rather than as a screenshot.
 *
 * The failure this replaces was not subtle and was still shipped: the previous
 * two-branch fit left the lion plane's edge inside the frame above aspect ~1.76
 * and covered only 65% of a phone in portrait. None of that is visible in a
 * typecheck, a lint or a build, and it is only visible in a screenshot if
 * somebody happens to take one at the right aspect.
 *
 * "Covered" here means covered in the worst frame the animation can produce:
 * every parallax at its extreme, and the breathing scale at its minimum, all at
 * once. That is stricter than any single rendered frame, which is the point.
 */

const MAX_SHIFT_X = PARALLAX.lionX + PARALLAX.cameraX;
const MAX_SHIFT_Y = PARALLAX.lionY + PARALLAX.cameraY;
const SHRINK = 1 - BREATH_AMPLITUDE;

/** Signed world-unit margin by which the plane overhangs the frame. */
function margins(aspect: number) {
  const fit = fitComposition(aspect);
  const visH = visibleHeight();
  const visW = visH * aspect;

  const halfPlaneW = (PLANE_W * fit.planeScale * SHRINK) / 2;
  const halfPlaneH = (PLANE_H * fit.planeScale * SHRINK) / 2;
  const centreY = fit.planeOffsetY;

  return {
    horizontal: halfPlaneW - (visW / 2 + MAX_SHIFT_X),
    top: halfPlaneH + centreY - (visH / 2 + MAX_SHIFT_Y),
    bottom: halfPlaneH - centreY - (visH / 2 + MAX_SHIFT_Y),
    imageWidthShown: visW / (PLANE_W * fit.planeScale),
    fit,
  };
}

/** The verification matrix from the task document. */
const MATRIX = [0.46, 0.75, 1.0, 1.33, 1.78, 2.33];

describe("composition fit", () => {
  it.each(MATRIX)("covers the frame at aspect %s", (aspect) => {
    const m = margins(aspect);
    expect(m.horizontal).toBeGreaterThanOrEqual(0);
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.bottom).toBeGreaterThanOrEqual(0);
  });

  it("covers every aspect from ultrawide to a tall phone", () => {
    // The fit solves for equality on the binding axis, so the margin there is
    // zero up to floating point. A tolerance of a nanometre of world space
    // admits that and nothing else.
    const EPSILON = 1e-9;
    const uncovered: number[] = [];
    for (let a = 3.0; a >= 0.35; a -= 0.001) {
      const m = margins(a);
      if (m.horizontal < -EPSILON || m.top < -EPSILON || m.bottom < -EPSILON) {
        uncovered.push(Number(a.toFixed(3)));
      }
    }
    expect(uncovered).toEqual([]);
  });

  /**
   * The old fit jumped 44% in scale across 0.002 of aspect at its branch
   * boundary. A continuous fit has no boundary, so the bound here is a
   * proportional step per 0.001 of aspect that no threshold could sneak under.
   */
  it("changes continuously — no branch to cross", () => {
    let worstScaleStep = 0;
    let worstOffsetStep = 0;
    let prev = fitComposition(3.0);

    for (let a = 3.0 - 0.001; a >= 0.35; a -= 0.001) {
      const next = fitComposition(a);
      worstScaleStep = Math.max(
        worstScaleStep,
        Math.abs(next.planeScale - prev.planeScale) / prev.planeScale,
      );
      worstOffsetStep = Math.max(
        worstOffsetStep,
        Math.abs(next.planeOffsetY - prev.planeOffsetY),
      );
      prev = next;
    }

    expect(worstScaleStep).toBeLessThan(0.002);
    expect(worstOffsetStep).toBeLessThan(0.01);
  });

  it("moves toward the face monotonically as the frame narrows", () => {
    let previousPan = -Infinity;
    for (let a = 3.0; a >= 0.35; a -= 0.005) {
      const fit = fitComposition(a);
      // planeOffsetY is negative as the pan grows, so -offset is the pan.
      const pan = -fit.planeOffsetY / (PLANE_H * fit.planeScale);
      expect(pan).toBeGreaterThanOrEqual(previousPan - 1e-12);
      previousPan = pan;
    }
  });

  it("never pans the face past centre, and never off the top", () => {
    for (const aspect of MATRIX) {
      const fit = fitComposition(aspect);
      const faceOffset = (FACE_V - 0.5) * PLANE_H * fit.planeScale;
      // The face starts above centre and may only move down toward it.
      expect(fit.focalY).toBeGreaterThanOrEqual(0);
      expect(fit.focalY).toBeLessThanOrEqual(faceOffset + 1e-9);
      // And it has to remain on screen.
      expect(fit.focalY).toBeLessThan(fit.halfH);
    }
  });

  /**
   * Cover at any cost would be satisfied by an absurd zoom. This is the other
   * half of the constraint: the crop stays wide enough to still read as a lion
   * rather than as an eye.
   */
  it("keeps a usable amount of the image in frame", () => {
    // 0.42 is the tallest aspect any shipping phone presents in portrait.
    // Below it the fit still covers; it simply crops tighter than the art
    // direction was ever asked to survive.
    for (let a = 3.0; a >= 0.42; a -= 0.01) {
      expect(margins(a).imageWidthShown).toBeGreaterThan(0.18);
    }
  });

  it("holds the landscape framing close to the composition it replaces", () => {
    // The previous constant was 1.02, which did not actually cover. The fit
    // should be near it at the design aspect, not a wholesale reframing.
    const fit = fitComposition(16 / 9);
    expect(fit.planeScale).toBeGreaterThan(1.02);
    expect(fit.planeScale).toBeLessThan(1.15);
    expect(Math.abs(fit.planeOffsetY)).toBeLessThan(1e-12);
  });
});
