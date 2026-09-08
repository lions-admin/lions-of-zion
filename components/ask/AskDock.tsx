"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { AskDesk } from "./AskDesk";
import styles from "./ask.module.css";

interface AskDockProps {
  /**
   * True on `/ask` itself. The control stays in the bar so the bar is the
   * same on every page (UX-08), but opening a drawer of the desk over the
   * desk would be two of the same thing — so here it is a plain link marked
   * current, and the dialog is not mounted.
   */
  current?: boolean;
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

  return (
    <>
      <a
        href="/ask"
        className={styles.dockTrigger}
        data-ask-launcher=""
        aria-label="Ask the desk"
        aria-current={current ? "page" : undefined}
        aria-haspopup={current ? undefined : "dialog"}
        aria-expanded={current ? undefined : open}
        aria-controls={current ? undefined : panelId}
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
            dialog description below says so, and every record now states its
            authorship (VA-47). On a narrow bar the label is screen-reader-only
            and the glyph carries the control; the word survives in the
            accessible name either way. */}
        <span className={styles.dockLabel}>Ask the desk</span>
      </a>
      {current ? null : (
        <Dialog
          id={panelId}
          open={open}
          onClose={() => setOpen(false)}
          title="Ask the desk"
          description="A question answered across what this desk has published. Not a search box: Search finds a record, this reads them. Where there is no evidence, the answer says so."
          variant="drawer"
          size="wide"
          dismissOnBackdrop={false}
          closeLabel="Close the desk"
          className={styles.dockPanel}
        >
          <AskDesk />
        </Dialog>
      )}
    </>
  );
}
