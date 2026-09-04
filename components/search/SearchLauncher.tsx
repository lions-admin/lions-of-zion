"use client";

/**
 * The way into search, from anywhere.
 *
 * **It is an anchor, not a button.** `/search` is a real route that renders
 * this same instrument, so with JavaScript off — or before hydration, or if
 * hydration fails — this control still goes somewhere useful. The click
 * handler upgrades it to an overlay when it can, and `event.preventDefault()`
 * runs only in that case. A middle-click, a ⌘-click and "open in new tab" all
 * keep working, because the element they act on is a link.
 *
 * The overlay itself is a native `<dialog>` opened with `showModal()`, which
 * is what supplies the focus trap, the Escape handling, `inert` on everything
 * behind it, and the top layer — four things a hand-rolled overlay gets
 * subtly wrong and this one cannot.
 *
 * Wave B owns `components/site/**`. This component is exported for that wave
 * to mount in the header; nothing here reaches into the site shell.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SearchDialog } from "./SearchDialog";
import styles from "./search.module.css";

export interface SearchLauncherProps {
  /** `bar` is the header's field-shaped control; `icon` is the compact one for
   *  a narrow bar. */
  variant?: "bar" | "icon";
  className?: string;
}

/** Whether the keystroke landed somewhere a person is writing. */
function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Which modifier the hint should name.
 *
 * Read through `useSyncExternalStore` rather than set in an effect: the server
 * has no platform to report, the client does, and this is the API that lets
 * the two differ without a hydration warning and without a cascading render.
 * The subscription is empty because the answer cannot change while the page is
 * open.
 */
const NO_CHANGES = () => () => {};
const readIsMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);
const readIsMacOnServer = () => false;

export function SearchLauncher({ variant = "bar", className }: SearchLauncherProps) {
  const [open, setOpen] = useState(false);
  const mac = useSyncExternalStore(NO_CHANGES, readIsMac, readIsMacOnServer);
  const triggerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut =
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditing(event.target));
      if (!shortcut) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <Link
        ref={triggerRef}
        href="/search"
        className={[styles.launcher, className].filter(Boolean).join(" ")}
        data-variant={variant}
        onClick={(event) => {
          /* Leave the modified clicks alone — they mean "somewhere else". */
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span className={styles.launcherGlyph} aria-hidden="true">
          <Icon name="search" size={16} strokeWidth={1.5} />
        </span>
        <span className={styles.launcherLabel}>Search</span>
        <span className={styles.launcherHint} aria-hidden="true">
          {mac ? "⌘K" : "Ctrl K"}
        </span>
      </Link>
      <SearchDialog open={open} onClose={close} />
    </>
  );
}
