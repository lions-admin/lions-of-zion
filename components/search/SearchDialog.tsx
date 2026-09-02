"use client";

/**
 * The overlay, on a native `<dialog>`.
 *
 * `showModal()` gives four behaviours for free that hand-rolled overlays
 * habitually get wrong: focus is trapped inside, Escape closes, everything
 * behind becomes `inert` (so a screen reader cannot wander into the page under
 * it), and the dialog is promoted to the browser's top layer — which is why
 * this component needs no `z-index` at all and cannot lose a stacking fight
 * with the site header or the scan.
 *
 * The two things it does not give:
 *
 *   * **the document still scrolls behind it** in some engines, so the body is
 *     pinned while it is open — the same thing `SiteHeader` does for its
 *     panels, restoring the previous value rather than assuming `""`;
 *   * **a click on the backdrop does not close it.** The backdrop is the
 *     dialog's own box outside the panel, so a click landing on the `<dialog>`
 *     element rather than on a child is a backdrop click.
 *
 * The panel is mounted only while open. That is safe here — this is not
 * server-rendered content that a no-JavaScript reader needs (the launcher is a
 * link to `/search` for exactly that reason), and mounting on demand is what
 * keeps the input's autofocus and the query state from surviving a close.
 */

import { useEffect, useRef } from "react";
import { SearchPanel } from "./SearchPanel";
import styles from "./search.module.css";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label="Search"
      /* Escape fires `cancel` before `close`; routing both through the same
         handler keeps React's `open` and the element's own state in step. */
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open ? <SearchPanel variant="overlay" autoFocus onDismiss={onClose} /> : null}
    </dialog>
  );
}
