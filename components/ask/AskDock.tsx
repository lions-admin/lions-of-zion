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
 *
 * ## On the homepage, below the width that reserves a gutter for it
 *
 * The seal is fixed over the reading column there, and a fixed control over a
 * reading column covers whatever the reader has scrolled to: headlines,
 * captions, source lines. So on a phone or tablet the homepage launcher has
 * two states, both read from scroll position by `useHomeLauncher`: the full
 * seal while the cover is on screen, where the corner is empty ground; and a
 * compact icon through the edition that steps out of the way while the reader
 * scrolls down and comes back on any scroll up, at the very end, or when it
 * takes keyboard focus. The reader keeps the same gesture Safari's own
 * toolbar taught them, and a screenshot at a reading position shows the
 * record, not the desk's badge over it.
 */

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { AskDesk } from "./AskDesk";
import styles from "./ask.module.css";

type LauncherState = { mode?: "seal" | "compact"; retracted: boolean };
const AT_REST: LauncherState = { retracted: false };

/** Below this width the homepage keeps no gutter for the seal. */
const UNRESERVED = "(max-width: 1099px)";
/** Downward travel that counts as reading rather than a nudge. */
const RETRACT_AFTER = 24;
/** Upward travel that counts as asking for the chrome back. */
const REVEAL_AFTER = 8;

function useHomeLauncher(home: boolean): LauncherState {
  const [state, setState] = useState<LauncherState>(AT_REST);

  useEffect(() => {
    if (!home) return;
    const media = window.matchMedia(UNRESERVED);
    let coverBottom = 0;
    let lastY = window.scrollY;
    let downward = 0;
    let current = AT_REST;

    const commit = (next: LauncherState) => {
      if (next.mode === current.mode && next.retracted === current.retracted) return;
      current = next;
      setState(next);
    };
    const measure = () => {
      const cover = document.querySelector("[data-home-scroll] > section");
      coverBottom = cover ? cover.getBoundingClientRect().bottom + window.scrollY : 0;
    };
    const read = () => {
      if (!media.matches) {
        commit(AT_REST);
        lastY = window.scrollY;
        return;
      }
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      /* The cover still fills most of the screen: the seal, at rest. */
      const onCover = y < coverBottom - window.innerHeight * 0.6;
      const atEnd =
        y + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (delta > 0) downward += delta;
      else if (delta < 0) downward = 0;
      let retracted = current.retracted;
      if (onCover || atEnd || delta <= -REVEAL_AFTER) retracted = false;
      else if (downward >= RETRACT_AFTER) retracted = true;
      commit({ mode: onCover ? "seal" : "compact", retracted });
    };
    const resize = () => {
      measure();
      read();
    };

    /* The first reading waits for a frame: a reader arriving mid-page (a
       restored scroll position, a hash) gets the right state before they
       move, and the effect itself sets no state. */
    const frame = requestAnimationFrame(resize);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", resize);
    media.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", resize);
    };
  }, [home]);

  /* Off the homepage the stored state is stale by definition; it is ignored
     rather than reset, so the effect never writes state on its own. */
  return home ? state : AT_REST;
}

export function AskDock({ home = false }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const launcher = useHomeLauncher(home);

  return (
    <>
      <button
        type="button"
        className={styles.dockTrigger}
        data-ask-launcher=""
        data-mode={launcher.mode}
        data-retracted={launcher.retracted || undefined}
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
        /* The one place this disclosure is made — it used to be stated here AND
           again below the examples, in two different registers. It says what
           the answers are made of, which is the only claim this surface has
           worth making. `ask.module.css` sets it in sentence case; two lines of
           uppercase at the top of a panel is a wall before the reader has done
           anything. */
        description="Grounded in what this desk has published. Where there is no evidence, the answer says so."
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
