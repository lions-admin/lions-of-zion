"use client";

/**
 * Spotlight — wraps an existing card so its surface and hairline respond to
 * the cursor.
 *
 * Additive by design: it renders one element around `children` and styles
 * only pseudo-elements, so `components/ui/Card` keeps its own border,
 * radius, padding and variants. Nothing about the card's appearance at rest
 * changes.
 *
 * The listener is attached only where there is a fine pointer, so phones and
 * tablets do no work and receive no handler (§22, §27).
 */

import { useEffect, useRef } from "react";
import styles from "./spotlight.module.css";

export interface SpotlightProps {
  tone?: "signal" | "gold" | "ember";
  /** Diameter of the lit area, in px. */
  size?: number;
  className?: string;
  children: React.ReactNode;
}

export function Spotlight({
  tone = "signal",
  size = 260,
  className,
  children,
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Written straight to the style attribute rather than through state:
       a pointermove that re-renders React is the reason cursor effects feel
       expensive. Custom properties are read by the compositor. */
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    };
    const onEnter = () => {
      element.dataset.spot = "on";
    };
    const onLeave = () => {
      element.dataset.spot = "off";
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.host, tone === "signal" ? "" : styles[tone], className]
        .filter(Boolean)
        .join(" ")}
      style={{ "--spot-size": `${size}px` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
