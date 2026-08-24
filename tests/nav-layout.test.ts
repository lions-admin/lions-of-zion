import { describe, expect, it } from "vitest";
import {
  fitComposition,
  visibleHeight,
  type QualityTier,
  type ViewportSnapshot,
} from "@/components/graphics/viewport";
import {
  PANEL,
  computeNavLayout,
  panelModeFor,
} from "@/components/nav/ring-geometry";
import { SECTIONS } from "@/components/nav/sections";

/**
 * The navigation's geometry, as invariants.
 *
 * Two of these encode decisions that came from the visual references and would
 * otherwise be one sign flip away from silently reversing: the ring runs
 * counter-clockwise from twelve o'clock, and every node stays inside the frame
 * at every aspect the site will meet.
 */

/** A snapshot for a given aspect, built from the same fit the scenes use. */
function snapshotFor(aspect: number, tier: QualityTier = "high"): ViewportSnapshot {
  const fit = fitComposition(aspect);
  const height = 900;
  return {
    width: height * aspect,
    height,
    aspect,
    dpr: 1,
    tier,
    reducedMotion: false,
    coarsePointer: false,
    halfW: fit.halfW,
    halfH: fit.halfH,
    planeScale: fit.planeScale,
    planeOffsetY: fit.planeOffsetY,
    focalX: 0,
    focalY: fit.focalY,
    navCenterX: 0,
    navCenterY: fit.focalY * 0.3,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

const MATRIX = [0.46, 0.75, 1.0, 1.33, 1.78, 2.33];

describe("navigation layout", () => {
  /**
   * The reference puts Today at twelve, Verify upper-left, The War at nine,
   * Stories at six and About upper-right — the section order, counter-clockwise.
   */
  it("runs counter-clockwise from twelve o'clock", () => {
    const layout = computeNavLayout(snapshotFor(16 / 9));
    const at = (id: string) => {
      const node = layout.nodes.find((n) => n.id === id);
      if (!node) throw new Error(`missing node ${id}`);
      return { x: node.x - layout.centerX, y: node.y - layout.centerY };
    };

    expect(at("today").y).toBeGreaterThan(0);
    expect(Math.abs(at("today").x)).toBeLessThan(1e-9);

    expect(at("stories").y).toBeLessThan(0);
    expect(Math.abs(at("stories").x)).toBeLessThan(1e-9);

    // Nine o'clock and three o'clock.
    expect(at("war").x).toBeLessThan(0);
    expect(Math.abs(at("war").y)).toBeLessThan(1e-9);
    expect(at("influence").x).toBeGreaterThan(0);
    expect(Math.abs(at("influence").y)).toBeLessThan(1e-9);

    // The diagonals.
    expect(at("verify").x).toBeLessThan(0);
    expect(at("verify").y).toBeGreaterThan(0);
    expect(at("october-7").x).toBeLessThan(0);
    expect(at("october-7").y).toBeLessThan(0);
    expect(at("israel-explained").x).toBeGreaterThan(0);
    expect(at("israel-explained").y).toBeLessThan(0);
    expect(at("about").x).toBeGreaterThan(0);
    expect(at("about").y).toBeGreaterThan(0);
  });

  it.each(MATRIX)("keeps every node inside the frame at aspect %s", (aspect) => {
    const snapshot = snapshotFor(aspect);
    const layout = computeNavLayout(snapshot);
    for (const node of layout.nodes) {
      expect(Math.abs(node.x) + layout.nodeHaloRadius).toBeLessThanOrEqual(
        snapshot.halfW,
      );
      expect(Math.abs(node.y) + layout.nodeHaloRadius).toBeLessThanOrEqual(
        snapshot.halfH,
      );
    }
  });

  it("deforms into an ellipse continuously — no breakpoint", () => {
    /* Continuity is not "the steps are small", it is "halving the step halves
       the change". A jump does not shrink when you sample it more finely. */
    const worst = (step: number) => {
      let worstStep = 0;
      let previous = computeNavLayout(snapshotFor(3.0));
      for (let a = 3.0 - step; a >= 0.4; a -= step) {
        const next = computeNavLayout(snapshotFor(a));
        worstStep = Math.max(
          worstStep,
          Math.abs(next.radiusX - previous.radiusX),
          Math.abs(next.radiusY - previous.radiusY),
        );
        previous = next;
      }
      return worstStep;
    };

    const coarse = worst(0.004);
    const fine = worst(0.001);
    expect(fine).toBeLessThan(coarse * 0.4);
    expect(fine).toBeLessThan(0.01);
  });

  /**
   * The open layout does jump, once, where the panel stops sitting beside the
   * ring and starts sitting below it. That is a real breakpoint and the whole
   * layout reflows across it — but there must be exactly one, and it must be
   * the threshold `panelModeFor` declares. Two thresholds that disagree is the
   * bug this pins: the stylesheet once opened a bottom sheet at a square aspect
   * while the geometry was still fitting a circle, and it covered three nodes.
   */
  it("has exactly one breakpoint when a panel is open, at the declared aspect", () => {
    const jumps: number[] = [];
    let previous = computeNavLayout(snapshotFor(3.0), true);
    for (let a = 3.0 - 0.002; a >= 0.4; a -= 0.002) {
      const next = computeNavLayout(snapshotFor(a), true);
      const step = Math.max(
        Math.abs(next.radiusX - previous.radiusX),
        Math.abs(next.radiusY - previous.radiusY),
      );
      if (step > 0.05) jumps.push(a);
      previous = next;
    }

    expect(jumps).toHaveLength(1);
    expect(jumps[0]).toBeCloseTo(PANEL.stackBelowAspect, 2);
    expect(panelModeFor(jumps[0] + 0.01)).toBe("side");
    expect(panelModeFor(jumps[0] - 0.01)).toBe("sheet");
  });

  it("keeps every node clear of the panel it opened for", () => {
    for (const aspect of MATRIX) {
      const snapshot = snapshotFor(aspect);
      const layout = computeNavLayout(snapshot, true);
      const mode = panelModeFor(aspect);

      for (const node of layout.nodes) {
        if (mode === "side") {
          // The panel occupies the right-hand fraction of the frame.
          const panelEdge =
            snapshot.halfW - snapshot.halfW * 2 * PANEL.sideWidth;
          expect(node.x + layout.nodeHaloRadius).toBeLessThanOrEqual(panelEdge);
        } else {
          const panelEdge =
            -snapshot.halfH + snapshot.halfH * 2 * PANEL.sheetHeight;
          expect(node.y - layout.nodeHaloRadius).toBeGreaterThanOrEqual(
            panelEdge,
          );
        }
      }
    }
  });

  /**
   * The task document's palette rule: gold never exceeds 6% of visible
   * particles. Gold is applied geometrically — particles near a hovered or
   * active node — so the rule can be checked as an area bound rather than by
   * counting pixels, and it holds by construction rather than by discipline.
   *
   * The bound is deliberately pessimistic: it assumes every particle inside
   * the gold radius of both an active and a hovered node is fully gold, which
   * no frame ever produces.
   */
  it("bounds how much of the frame gold can ever reach", () => {
    // The document's number, and the one both gold paths in the shader clamp
    // to: the hover attraction's gold falloff, and the halo's `goldable`.
    const GOLD_REACH = 1.5;
    // At most two nodes can carry gold at once: one hovered, one active.
    const CONCURRENT = 2;

    for (const aspect of MATRIX) {
      const snapshot = snapshotFor(aspect);
      const layout = computeNavLayout(snapshot);
      const goldArea =
        CONCURRENT * Math.PI * Math.pow(layout.nodeRadius * GOLD_REACH, 2);
      const frameArea = snapshot.halfW * 2 * snapshot.halfH * 2;
      expect(goldArea / frameArea).toBeLessThan(0.06);
    }
  });

  it("gives every section a hit target and a place on the ring", () => {
    const layout = computeNavLayout(snapshotFor(16 / 9));
    expect(layout.nodes).toHaveLength(SECTIONS.length);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(SECTIONS.length);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it("never lets the ring collapse onto the mark", () => {
    for (let a = 3.0; a >= 0.4; a -= 0.01) {
      const layout = computeNavLayout(snapshotFor(a));
      expect(Math.min(layout.radiusX, layout.radiusY)).toBeGreaterThan(
        layout.coreRadius + layout.nodeRadius,
      );
    }
  });

  it("agrees with the visible height the scenes are fitted to", () => {
    expect(visibleHeight()).toBeCloseTo(6.1146, 3);
  });
});
