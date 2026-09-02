"use client";

/**
 * Ticker — a number that counts to its value when it is scrolled to.
 *
 * One correction to the Magic UI original, and it matters on a site whose
 * numbers are evidence: `number-ticker` renders `startValue` (i.e. `0`) into
 * the HTML and only reaches the true figure after `motion`'s spring settles.
 * That means the server sends the wrong number — to a crawler, to a reader
 * with JavaScript off, to anyone whose hydration fails, and into the
 * accessibility tree until the animation ends.
 *
 * Here the DOM's text and the `aria-label` are the *final* value from the
 * first byte. The animation, when it runs at all, starts by overwriting a
 * correct number with a low one and puts it back — so every path that skips
 * the animation is already correct rather than eventually correct.
 *
 * Reserve it for figures where the count communicates magnitude. A casualty
 * count is not a magnitude to be enjoyed accumulating; §13 applies and it
 * must not be used there.
 */

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import styles from "./ticker.module.css";

export interface TickerProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  value: number;
  /** Where the count begins. */
  from?: number;
  decimals?: number;
  /** Milliseconds. */
  duration?: number;
  delay?: number;
  locale?: string;
}

/* easeOutExpo — the same curve as `--ease-out` in the token file, so a
   counting figure and a sliding panel share a deceleration. */
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* Module scope, so the effect below depends on primitives rather than on a
   closure that is a new object every render. */
function formatValue(input: number, locale: string, decimals: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(input);
}

export function Ticker({
  value,
  from = 0,
  decimals = 0,
  duration = 1400,
  delay = 0,
  locale = "en-US",
  className,
  ...rest
}: TickerProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        element.textContent = formatValue(
          from + (value - from) * easeOutExpo(t),
          locale,
          decimals,
        );
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          timer = setTimeout(run, delay);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [value, from, duration, delay, decimals, locale]);

  return (
    <span
      ref={ref}
      className={[styles.ticker, className].filter(Boolean).join(" ")}
      /* The figure is the content. The animation only ever borrows it. */
      aria-label={formatValue(value, locale, decimals)}
      data-numeric
      {...rest}
    >
      {formatValue(value, locale, decimals)}
    </span>
  );
}
