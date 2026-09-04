"use client";

/**
 * The desk, opened in place.
 *
 * `AskLauncher` was a link to `/ask`, and its docblock argued the case for
 * that: a page can be bookmarked, shared, opened in a new tab and reached with
 * JavaScript off, and a bubble in the corner is the visual grammar of a support
 * widget — the wrong promise for a surface whose output is cited evidence.
 *
 * That argument is still right about what `/ask` is for, and the page is
 * untouched. What it got wrong is that it left a reader four paragraphs into an
 * article with no way to ask about the thing in front of them that did not cost
 * them their place. This is that way, and the page remains the durable one: the
 * two share a thread through `thread-store.ts`, so a question asked here is
 * still there on `/ask`, and the reverse.
 *
 * ## It renders `AskDesk`, not a second chat
 *
 * Everything below the shell — the transcript, the composer, the waiting state
 * that explains why a cited answer is slow, the error records that carry the
 * API's own detail, the evidence boundary — is the desk's, unchanged. A panel
 * that reimplemented any of it would drift from the page within a release, and
 * the first thing to drift would be the part that explains what an unsupported
 * answer means.
 *
 * ## The shell is the `Dialog` primitive
 *
 * Native `<dialog>` with `showModal()`: focus trapped, the rest of the document
 * inert, Escape closing, focus restored to the trigger, top-layer rendering.
 * None of that is worth hand-rolling here.
 *
 * `dismissOnBackdrop` is off for the reason that prop exists — the composer
 * holds a typed question, and a stray click on the page behind should not throw
 * it away.
 */

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { AskDesk } from "./AskDesk";
import styles from "./ask.module.css";

export function AskDock() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        className={styles.dockTrigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <span className={styles.dockGlyph} aria-hidden="true">
          <Icon name="ask" size={20} strokeWidth={1.5} />
        </span>
        <span className={styles.dockLabel}>Ask</span>
      </button>

      <Dialog
        id={panelId}
        open={open}
        onClose={() => setOpen(false)}
        title="Ask the desk"
        description="Every answer lists what it was built from, or says that it was built from nothing."
        variant="drawer"
        size="wide"
        dismissOnBackdrop={false}
        closeLabel="Close the desk"
        className={styles.dockPanel}
      >
        <AskDesk />
      </Dialog>
    </>
  );
}
