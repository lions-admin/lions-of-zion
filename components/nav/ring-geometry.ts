/**
 * Where the navigation sits, computed rather than authored.
 *
 * Positions are polar, derived from the composition the lion is fitted to, not
 * from the viewport: a ring centred on the window drifts off the lion on every
 * aspect that is not 16:9, which is Stage 0's defect one layer up.
 *
 * The ring deforms into an ellipse as the frame narrows. Like the cover fit,
 * the deformation is a continuous function of aspect and not a breakpoint —
 * there is no width at which the navigation visibly rearranges itself.
 */

import { SECTION_COUNT, SECTIONS, type SectionId } from "./sections";
import type { ViewportSnapshot } from "@/components/graphics/viewport";

export interface NodeLayout {
  id: SectionId;
  index: number;
  angle: number;
  x: number;
  y: number;
}

/**
 * The panel's footprint, as layout rather than as styling.
 *
 * This exists because the two halves disagreed once and it cost a whole class
 * of bug: the stylesheet decided to open the panel as a bottom sheet at a
 * square aspect while the geometry still believed it was drawing a circle, and
 * the sheet landed on three nodes. The footprint is declared here, the ring is
 * fitted into what is left of the frame, and the stylesheet is told which mode
 * it is in — so the two cannot pick different answers.
 */
export const PANEL = {
  /** Fraction of the frame's width a side panel occupies. */
  sideWidth: 0.34,
  /** Fraction of the frame's height a bottom sheet occupies. */
  sheetHeight: 0.44,
  /** Breathing room between the panel and the ring. */
  gutter: 0.03,
  /** At or below this aspect the panel stacks below instead of sitting beside. */
  stackBelowAspect: 1.15,
} as const;

export type PanelMode = "side" | "sheet";

export function panelModeFor(aspect: number): PanelMode {
  return aspect > PANEL.stackBelowAspect ? "side" : "sheet";
}

export interface NavLayout {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  /** Radius of an individual node's ring, world units. */
  nodeRadius: number;
  /** The faint second ring around each node. */
  nodeHaloRadius: number;
  /** Radius of the innermost decorative ring around the mark. */
  coreRadius: number;
  /** Ticks around the outer ring, and how far the four cardinals overshoot. */
  tickCount: number;
  cardinalScale: number;
  nodes: NodeLayout[];
  compact: boolean;
}

const RING_FRACTION = 0.62;
const RING_MIN = 0.9;
const RING_MAX = 2.6;

/*
 * Narrower than the frame can hold, on purpose: the nodes are not the widest
 * thing on the ring, their labels are. A ring sized to the frame pushes
 * "Israel Explained" off the edge of a phone.
 */
const ELLIPSE_X_FRACTION = 0.66;
/*
 * Deliberately tighter than the horizontal fraction, and tighter than it looks
 * like it needs to be. A narrow screen has to hold the ring *and* a panel that
 * opens as a sheet from the bottom, and there is only one column of height to
 * share. A ring sized to fill the frame leaves the sheet nowhere to go and the
 * lower nodes get covered.
 */
const ELLIPSE_Y_FRACTION = 0.34;

/** The aspect band over which the circle becomes an ellipse. */
const ELLIPSE_WIDE = 1.05;
const ELLIPSE_NARROW = 0.8;

const NODE_FRACTION = 0.085;
const NODE_MIN = 0.15;
const NODE_MAX = 0.32;

/** The faint outer ring each node carries, as a multiple of its own radius. */
const NODE_HALO_SCALE = 1.62;

/** Graduations around the outer ring, with the four cardinals drawn longer. */
const TICK_COUNT = 72;
const CARDINAL_SCALE = 1.16;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * @param panelOpen Fit the ring into the frame minus the panel, rather than
 *   into the whole frame. Both layouts are computed on every resize and the
 *   scene eases between them, so opening a section moves the constellation
 *   rather than cutting to a new one.
 */
export function computeNavLayout(
  snapshot: ViewportSnapshot,
  panelOpen = false,
): NavLayout {
  /* The box the ring actually has to live in. */
  let availHalfW = snapshot.halfW;
  let availHalfH = snapshot.halfH;
  let centerX = snapshot.navCenterX;
  let centerY = snapshot.navCenterY;

  if (panelOpen) {
    if (panelModeFor(snapshot.aspect) === "side") {
      availHalfW = snapshot.halfW * (1 - PANEL.sideWidth - PANEL.gutter);
      centerX = -snapshot.halfW + availHalfW;
    } else {
      availHalfH = snapshot.halfH * (1 - PANEL.sheetHeight - PANEL.gutter);
      centerY = snapshot.halfH - availHalfH;
    }
  }

  const short = Math.min(availHalfW, availHalfH);

  const circular = clamp(short * RING_FRACTION, RING_MIN, RING_MAX);
  const ellipseX = availHalfW * ELLIPSE_X_FRACTION;
  const ellipseY = availHalfH * ELLIPSE_Y_FRACTION;

  // 0 = circle, 1 = ellipse. Continuous, so the ring never rearranges.
  const compactness = smoothstep(ELLIPSE_WIDE, ELLIPSE_NARROW, snapshot.aspect);

  let nodeRadius = clamp(short * NODE_FRACTION, NODE_MIN, NODE_MAX);

  /* Fit, then verify the fit. The ring plus a node's outermost ring has to sit
     inside the available box on both axes; if the box is too small for the
     node radius as well, the node gives way before the ring does. */
  let radiusX = Math.min(
    circular + (ellipseX - circular) * compactness,
    availHalfW - nodeRadius * NODE_HALO_SCALE,
  );
  let radiusY = Math.min(
    circular + (ellipseY - circular) * compactness,
    availHalfH - nodeRadius * NODE_HALO_SCALE,
  );

  if (radiusX <= nodeRadius || radiusY <= nodeRadius) {
    nodeRadius = Math.max(
      0.06,
      Math.min(availHalfW, availHalfH) / (2 + NODE_HALO_SCALE),
    );
    radiusX = Math.max(nodeRadius * 1.6, availHalfW - nodeRadius * NODE_HALO_SCALE);
    radiusY = Math.max(nodeRadius * 1.6, availHalfH - nodeRadius * NODE_HALO_SCALE);
  }

  const nodes: NodeLayout[] = SECTIONS.map((section, index) => {
    /* Twelve o'clock, counter-clockwise: Today at the top, Verify upper-left,
       The War at nine, Stories at six, About upper-right. Screen y grows
       upward, so a positive angle travels counter-clockwise. */
    const angle = Math.PI / 2 + (index / SECTION_COUNT) * Math.PI * 2;
    return {
      id: section.id,
      index,
      angle,
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });

  return {
    centerX,
    centerY,
    radiusX,
    radiusY,
    nodeRadius,
    nodeHaloRadius: nodeRadius * NODE_HALO_SCALE,
    coreRadius: Math.min(radiusX, radiusY) * 0.32,
    tickCount: TICK_COUNT,
    cardinalScale: CARDINAL_SCALE,
    nodes,
    compact: compactness > 0.5,
  };
}

/**
 * The quadratic Bézier from the hub to a node.
 *
 * The control point is offset perpendicular to the chord, so the connections
 * bow rather than forming a wheel of spokes. The offset alternates in sign by
 * index, which keeps neighbouring paths from nesting into one another.
 */
export function connectionControlPoint(
  layout: NavLayout,
  node: NodeLayout,
): { x: number; y: number } {
  const dx = node.x - layout.centerX;
  const dy = node.y - layout.centerY;
  /* The references sweep much further than a nudge: the connections read as
     orbital arcs, not as spokes with a kink. The sign alternates so
     neighbouring paths bow apart rather than nesting into one another. */
  const bow = (node.index % 2 === 0 ? 1 : -1) * 0.28;
  return {
    x: layout.centerX + dx * 0.5 - dy * bow,
    y: layout.centerY + dy * 0.5 + dx * bow,
  };
}

export function bezierPoint(
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}
