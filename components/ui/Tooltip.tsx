"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./tooltip.module.css";

/**
 * An accessible tooltip: a footnote on a control.
 *
 * WCAG 1.4.13 has three requirements that most tooltips fail, and all three
 * are implemented here rather than assumed:
 *
 * * **Dismissible** — Escape closes it without moving focus.
 * * **Hoverable** — the pointer can travel onto the tip and read it, across an
 *   invisible bridge so the gap does not dismiss it mid-journey.
 * * **Persistent** — it stays until the pointer leaves, focus leaves, or
 *   Escape; nothing times it out.
 *
 * It is also never the only place a name lives. A tooltip is `aria-describedby`
 * on its trigger, which is supplementary by definition: an icon-only control
 * still needs its `aria-label`, and `Button` requires one. On a touch device
 * there is no hover at all, so a tooltip is invisible to most of the people
 * reading this site — if the copy matters, put it on the page.
 *
 * Tier: a client component. It must not reach the home route.
 */
export interface TooltipProps {
  /** The tip's text. Plain text — a tooltip is not a container. */
  label: string;
  placement?: "top" | "bottom";
  /** Milliseconds before an intentional hover opens it. Focus opens with no
   *  delay: a keyboard reader has already committed. */
  openDelay?: number;
  className?: string;
  /** A single element that can hold a ref and `aria-describedby`. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}

export function Tooltip({
  label,
  placement = "top",
  openDelay = 200,
  className = "",
  children,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const show = useCallback(
    (delay: number) => {
      clear();
      if (delay === 0) {
        setOpen(true);
        return;
      }
      timer.current = setTimeout(() => setOpen(true), delay);
    },
    [clear],
  );

  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, [clear]);

  const handlePointerEnter = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      /* Only a real mouse opens on hover. A touch "hover" is a tap on its way
         to being a click, and opening a tip there covers the thing tapped. */
      if (event.pointerType !== "mouse") return;
      show(openDelay);
    },
    [openDelay, show],
  );

  /* Escape dismisses without moving focus — the trigger stays where it is, so
     a keyboard reader does not lose their place to read a footnote. */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        hide();
      }
    },
    [hide, open],
  );

  const trigger = React.cloneElement(children, {
    "aria-describedby": open ? id : children.props["aria-describedby"],
  });

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      {open ? (
        <span role="tooltip" id={id} className={`${styles.tip} ${styles[placement]}`}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
