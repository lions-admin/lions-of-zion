"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import styles from "./ask.module.css";

/**
 * The desk itself, fetched when a reader opens it and not before.
 *
 * This control is in the masthead on every route, so anything it imports
 * statically is in the bundle of every page on the site — and what it imported
 * was the whole conversation machinery: the thread hook, the transcript, the
 * composer, and (until 2026-09-16) a vendored registry with Tailwind, Radix and
 * cmdk behind it. None of that is needed to render a link that says "Ask the
 * desk". `next/dynamic` moves it into its own chunk, requested by the click
 * that opens the drawer.
 *
 * `ssr: false` is deliberate rather than incidental: the drawer is closed in
 * the server HTML by definition, the transcript is restored from this
 * browser's own storage, and `/ask` is the server-rendered route for anyone
 * who has no JavaScript. There is nothing here to prerender.
 */
const AskDesk = dynamic(() => import("./AskDesk").then((module) => module.AskDesk), {
  ssr: false,
  loading: () => (
    <p className={styles.systemNote} role="status">
      Opening the desk.
    </p>
  ),
});

interface AskDockProps {
  /**
   * True on `/ask` itself. The control stays in the bar so the bar is the
   * same on every page (UX-08), but opening a drawer of the desk over the
   * desk would be two of the same thing — so here it is a plain link marked
   * current, and the dialog is not mounted.
   */
  current?: boolean;
}

/** Whether the keystroke landed somewhere a person is writing. */
function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * The way into Ask, from anywhere.
 *
 * This lives in the masthead on every route, at every width. Until
 * 2026-09-08 it had two homes — a header slot on the homepage and a
 * `position: fixed` pill bottom-right everywhere else — and the pill was
 * measured covering the footer's "Back to the top", the lead headline on
 * `/geopolitical-brief` at 390px, an article's hero image, and a support card
 * (UX-07). The reader also learned one bar on the cover and met a different
 * one on page two (UX-08). One control, one place, and nothing to cover
 * content with: the header is fixed, so the desk is reachable four paragraphs
 * into an article without losing the place — the argument the floating pill
 * was making — and it opens as the same drawer.
 *
 * It is an anchor, not a button, for the same reason `SearchLauncher` is:
 * `/ask` is a real route, so before hydration, without JavaScript, and on a
 * modified click this still goes somewhere useful.
 */
export function AskDock({ current = false }: AskDockProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLAnchorElement>(null);

  /* One shortcut family. Search is ⌘K (and a bare `/`); the desk beside it is
     ⌘/ — the same modifier, the same handler shape, registered the same way
     (`SearchLauncher`). Both are declared in `aria-keyshortcuts` rather than
     printed on the control, because the bar has room for four destination
     names, Search, Menu, Support and Account and not a fifth hint. */
  useEffect(() => {
    if (current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "/") return;
      if (isEditing(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current]);

  /* Focus returns to the control that opened the drawer, which is where the
     reader's place in the page is. */
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <a
        ref={triggerRef}
        href="/ask"
        className={styles.dockTrigger}
        data-ask-launcher=""
        aria-label="Ask the desk"
        aria-current={current ? "page" : undefined}
        aria-haspopup={current ? undefined : "dialog"}
        aria-expanded={current ? undefined : open}
        aria-controls={current ? undefined : panelId}
        aria-keyshortcuts={current ? undefined : "Meta+/ Control+/"}
        data-measure-id="ask-open"
        data-measure-event="ask_open"
        data-measure-exposure="none"
        onClick={(event) => {
          if (current) return;
          // Keep native navigation available before hydration and for new-tab gestures.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span className={styles.dockGlyph} aria-hidden="true">
          <Icon name="ask" size={20} strokeWidth={1.5} />
        </span>
        {/* VA-58. This read "AI Chat" while the menu, the page title and the
            dialog all said "Ask the desk" — five names for one destination.
            The menu label wins, per the owner's naming ruling. What "AI Chat"
            was carrying honestly, that a machine answers, is not lost: the
            dialog description below says so, and every answer now carries the
            authorship line `AnswerRecord` prints under "Answer" (VA-47 — this
            comment claimed that was already true for a week before it was). On
            a narrow bar the label is screen-reader-only and the glyph carries
            the control; the word survives in the accessible name either way. */}
        <span className={styles.dockLabel}>Ask the desk</span>
      </a>
      {current ? null : (
        <Dialog
          id={panelId}
          open={open}
          onClose={close}
          title="Ask the desk"
          description="A question answered across what this desk has published. Not a search box: Search finds a record, this reads them. Where there is no evidence, the answer says so."
          variant="drawer"
          size="wide"
          /* Ask and Search dismiss the same way: a click on the scrim leaves.
             The desk refused it until 2026-09-16 while the search overlay
             allowed it, so the two halves of one instrument answered the same
             gesture differently. Nothing is lost by leaving — the transcript
             is stored and reopens where it was. */
          dismissOnBackdrop
          closeLabel="Close the desk"
          className={styles.dockPanel}
        >
          {/* Gated on `open`, not merely hidden by it: the hook inside restores
              a stored conversation over the network the moment it mounts, and
              a closed drawer on every route was doing that on every route. */}
          {open ? <AskDesk autoFocus /> : null}
        </Dialog>
      )}
    </>
  );
}
