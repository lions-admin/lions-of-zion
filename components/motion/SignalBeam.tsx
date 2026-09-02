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
 */

import {
  useEffect,
  useId,
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

export function SignalBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
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
  const id = useId();
  const [path, setPath] = useState("");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const frame = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const from = fromRef.current;
      const to = toRef.current;
      if (!container || !from || !to) return;

      const containerRect = container.getBoundingClientRect();
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();

      setBox({ width: containerRect.width, height: containerRect.height });

      const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset;
      const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset;
      const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset;
      const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset;
      const controlY = startY - curvature;

      setPath(`M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`);
    };

    /* ResizeObserver fires synchronously in a layout-adjacent phase; batching
       into one frame keeps a column reflow from re-measuring per beam per
       observation. */
    const schedule = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        measure();
      });
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    if (fromRef.current) observer.observe(fromRef.current);
    if (toRef.current) observer.observe(toRef.current);
    measure();

    return () => {
      observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

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
      style={
        {
          "--beam-duration": `${duration}s`,
          "--beam-delay": `${delay}s`,
          "--beam-packet-length": packetLength,
        } as CSSProperties
      }
    >
      <path className={styles.track} d={path} pathLength={1} />
      <path className={`${packetClass} ${styles.halo}`} d={path} pathLength={1} key={`${id}-halo`} />
      <path className={packetClass} d={path} pathLength={1} key={`${id}-packet`} />
    </svg>
  );
}
