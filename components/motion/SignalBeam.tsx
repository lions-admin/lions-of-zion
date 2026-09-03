"use client";

/**
 * SignalBeam — draws a measured wire between two elements and sends a packet
 * along it.
 *
 * Use it to assert a relationship that exists in the data: source → item,
 * claim → evidence, cluster → bridge. It must never be decoration; a beam
 * between two things that are not related is a diagram that lies (§9).
 *
 * Both endpoints and the container are refs the caller owns, so the beam does
 * not constrain the layout it annotates.
 *
 * Measurement and animation are centralized (IW-004). Every beam on a page
 * shares one ResizeObserver, one IntersectionObserver and one rAF batch:
 *
 *   · A beam whose container is offscreen performs no layout reads at all.
 *     Resize events while hidden set a dirty flag; the single measurement
 *     runs when the container next approaches the viewport. Before the first
 *     intersection nothing is measured and nothing is rendered, so a diagram
 *     far down the page costs nothing until the reader nears it.
 *   · Offscreen beams also pause their packet animation
 *     (`data-beam-idle` → `animation-play-state: paused`).
 *   · At most `MAX_ANIMATED_BEAMS` packets animate at once, page-wide.
 *     Beams past the cap keep their static track (`data-beam-capped`) and
 *     inherit a slot when an animated beam leaves the viewport.
 *
 * Under `prefers-reduced-motion` the packet is gone entirely and the track
 * brightens — a static connector. The relation's textual label lives in the
 * caller's server markup (a caption or the surrounding prose), never in the
 * packet, so nothing is lost with it.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import styles from "./signal-beam.module.css";

export interface SignalBeamProps {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  /** Positive bows the wire up, negative down. Zero is a straight line. */
  curvature?: number;
  /**
   * The wire's main axis. `"x"` (the default, and the historical behavior)
   * leaves the start horizontally and bends in; `"y"` leaves it vertically —
   * for fan-ins where the endpoints stack instead of sitting side by side.
   */
  curveAxis?: "x" | "y";
  /** Seconds for one traverse. */
  duration?: number;
  delay?: number;
  reverse?: boolean;
  tone?: "signal" | "ember" | "gold";
  /** Fraction of the wire the packet occupies, 0–1. */
  packetLength?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  className?: string;
  /** Announced only if this beam is the sole statement of the relationship. */
  label?: string;
}

/* ── The shared measurement/animation system ─────────────────────────────
 *
 * Module-level singletons: one ResizeObserver over every element any beam
 * depends on, one IntersectionObserver over every beam container, one rAF
 * batch for the layout reads. Beams register on mount and are forgotten on
 * unmount; observers release an element as soon as its last beam leaves.
 */

/** Page-wide budget of simultaneously animated packets (§7 beam policy). */
const MAX_ANIMATED_BEAMS = 12;

interface BeamHandle {
  container: HTMLElement;
  /** Elements whose size changes invalidate this beam's geometry. */
  parts: HTMLElement[];
  visible: boolean;
  animated: boolean;
  /** A resize arrived while offscreen; measure when next visible. */
  dirty: boolean;
  measure: () => void;
  /** Pushes {visible, animated} back into the component. */
  notify: () => void;
}

const beamsByElement = new Map<Element, Set<BeamHandle>>();
const beamsByContainer = new Map<Element, Set<BeamHandle>>();
/** Visible beams waiting for an animation slot, in arrival order. */
const capped = new Set<BeamHandle>();
let animatedCount = 0;

let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;

const measureQueue = new Set<BeamHandle>();
let measureFrame = 0;

function ensureObservers() {
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const beams = beamsByElement.get(entry.target);
        if (beams) for (const beam of beams) queueMeasure(beam);
      }
    });
    /* The margin lets a beam finish its one measurement just before it
       scrolls into view, so the wire is there when the reader arrives. */
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const beams = beamsByContainer.get(entry.target);
          if (beams) {
            for (const beam of beams) setBeamVisible(beam, entry.isIntersecting);
          }
        }
      },
      { rootMargin: "128px" },
    );
  }
}

function queueMeasure(beam: BeamHandle) {
  if (!beam.visible) {
    /* No layout reads while offscreen — this flag is the whole cost. */
    beam.dirty = true;
    return;
  }
  measureQueue.add(beam);
  if (!measureFrame) measureFrame = requestAnimationFrame(flushMeasures);
}

function flushMeasures() {
  measureFrame = 0;
  const batch = Array.from(measureQueue);
  measureQueue.clear();
  for (const beam of batch) {
    beam.dirty = false;
    beam.measure();
  }
}

function grantSlot(beam: BeamHandle) {
  if (animatedCount < MAX_ANIMATED_BEAMS) {
    animatedCount += 1;
    beam.animated = true;
  } else {
    beam.animated = false;
    capped.add(beam);
  }
}

function releaseSlot(beam: BeamHandle) {
  if (beam.animated) {
    beam.animated = false;
    animatedCount -= 1;
    /* Hand the freed slot to the longest-waiting visible beam. */
    const next = capped.values().next();
    if (!next.done) {
      const promoted = next.value;
      capped.delete(promoted);
      promoted.animated = true;
      animatedCount += 1;
      promoted.notify();
    }
  } else {
    capped.delete(beam);
  }
}

function setBeamVisible(beam: BeamHandle, visible: boolean) {
  if (beam.visible === visible) return;
  beam.visible = visible;
  if (visible) {
    grantSlot(beam);
    if (beam.dirty) queueMeasure(beam);
  } else {
    releaseSlot(beam);
  }
  beam.notify();
}

function registerBeam(beam: BeamHandle) {
  ensureObservers();
  for (const element of beam.parts) {
    let set = beamsByElement.get(element);
    if (!set) {
      set = new Set();
      beamsByElement.set(element, set);
      resizeObserver?.observe(element);
    }
    set.add(beam);
  }
  let set = beamsByContainer.get(beam.container);
  if (!set) {
    set = new Set();
    beamsByContainer.set(beam.container, set);
    intersectionObserver?.observe(beam.container);
  }
  set.add(beam);
}

function unregisterBeam(beam: BeamHandle) {
  measureQueue.delete(beam);
  for (const element of beam.parts) {
    const set = beamsByElement.get(element);
    if (set) {
      set.delete(beam);
      if (set.size === 0) {
        beamsByElement.delete(element);
        resizeObserver?.unobserve(element);
      }
    }
  }
  const set = beamsByContainer.get(beam.container);
  if (set) {
    set.delete(beam);
    if (set.size === 0) {
      beamsByContainer.delete(beam.container);
      intersectionObserver?.unobserve(beam.container);
    }
  }
  if (beam.visible) releaseSlot(beam);
  else capped.delete(beam);
  beam.visible = false;
}

/* ── The component ──────────────────────────────────────────────────────── */

export function SignalBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  curveAxis = "x",
  duration = 4.5,
  delay = 0,
  reverse = false,
  tone = "signal",
  packetLength = 0.055,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  className,
  label,
}: SignalBeamProps) {
  const [path, setPath] = useState("");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [run, setRun] = useState({ visible: false, animated: false });

  /* The measure closure lives for the mount; geometry props flow through a
     ref so a change never forces re-registration with the observers. The
     ref is written in the effect below, never during render — measurement
     only ever runs from observer callbacks and rAF, which fire after it. */
  const geometry = useRef({
    curvature,
    curveAxis,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  });

  const handleRef = useRef<BeamHandle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    if (!container || !from || !to) return;

    const handle: BeamHandle = {
      container,
      parts: [container, from, to],
      visible: false,
      animated: false,
      dirty: true,
      measure: () => {
        const g = geometry.current;
        const containerRect = container.getBoundingClientRect();
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();

        setBox({ width: containerRect.width, height: containerRect.height });

        const startX =
          fromRect.left - containerRect.left + fromRect.width / 2 + g.startXOffset;
        const startY =
          fromRect.top - containerRect.top + fromRect.height / 2 + g.startYOffset;
        const endX =
          toRect.left - containerRect.left + toRect.width / 2 + g.endXOffset;
        const endY =
          toRect.top - containerRect.top + toRect.height / 2 + g.endYOffset;

        /* One quadratic control point. Main axis "x": the control sits at
           the horizontal midpoint on the start's row, so the wire leaves
           horizontally and bends in. Main axis "y" is the mirror: vertical
           midpoint on the start's column, leaving vertically. `curvature`
           offsets the control perpendicular to the main axis. */
        const controlX =
          g.curveAxis === "y" ? startX - g.curvature : (startX + endX) / 2;
        const controlY =
          g.curveAxis === "y" ? (startY + endY) / 2 : startY - g.curvature;

        setPath(`M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`);
      },
      notify: () =>
        setRun({ visible: handle.visible, animated: handle.animated }),
    };

    handleRef.current = handle;
    registerBeam(handle);
    return () => {
      handleRef.current = null;
      unregisterBeam(handle);
    };
  }, [containerRef, fromRef, toRef]);

  /* A geometry prop change re-measures without re-registering. Offscreen it
     only marks the beam dirty. */
  useEffect(() => {
    geometry.current = {
      curvature,
      curveAxis,
      startXOffset,
      startYOffset,
      endXOffset,
      endYOffset,
    };
    if (handleRef.current) queueMeasure(handleRef.current);
  }, [curvature, curveAxis, startXOffset, startYOffset, endXOffset, endYOffset]);

  if (!path) return null;

  const packetClass = [
    styles.packet,
    reverse ? styles.reverse : "",
    tone === "signal" ? "" : styles[tone],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={[styles.svg, className].filter(Boolean).join(" ")}
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
      fill="none"
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-beam-idle={run.visible ? undefined : ""}
      data-beam-capped={run.visible && !run.animated ? "" : undefined}
      style={
        {
          "--beam-duration": `${duration}s`,
          "--beam-delay": `${delay}s`,
          "--beam-packet-length": packetLength,
        } as CSSProperties
      }
    >
      <path className={styles.track} d={path} pathLength={1} />
      <path className={`${packetClass} ${styles.halo}`} d={path} pathLength={1} />
      <path className={packetClass} d={path} pathLength={1} />
    </svg>
  );
}
