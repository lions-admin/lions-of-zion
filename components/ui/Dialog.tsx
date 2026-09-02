"use client";

import React, { useCallback, useEffect, useId, useRef } from "react";
import { Button } from "./Button";
import styles from "./dialog.module.css";

/**
 * A modal dialog on the native `<dialog>` element.
 *
 * The whole reason to build on the platform element is focus: `showModal()`
 * traps focus inside the panel, marks the rest of the document inert, closes
 * on Escape, restores focus to whatever opened it, and renders in the top
 * layer so no `z-index` can lose to anything. Every one of those is a thing
 * hand-rolled dialogs get subtly wrong, and none of it is code here.
 *
 * What this component adds: React state as the single source of truth (the
 * platform's own close paths are intercepted and routed back through
 * `onClose`), a backdrop click, the labelled header, and the scroll lock the
 * platform does not do.
 *
 * Tier: a client component with state. It must not reach the home route — see
 * `components/motion/README.md`. With JavaScript off it renders a closed
 * `<dialog>`, which is invisible and inert; anything a reader must be able to
 * read has to exist on the page as well, never only in a dialog.
 */
export interface DialogProps {
  open: boolean;
  /** Called for every close path: Escape, the close control, the backdrop.
   *  The caller owns `open`; this component never closes itself behind it. */
  onClose: () => void;
  /** The dialog's accessible name. Required — an unnamed modal is announced
   *  as "dialog" and nothing else. */
  title: string;
  /** One sentence under the title, wired to `aria-describedby`. */
  description?: string;
  /** Widen the panel from the narrow measure to the reading measure. */
  size?: "narrow" | "wide";
  /** A click on the backdrop closes by default. Turn it off for a dialog
   *  holding unsaved input, where a stray click should not discard work. */
  dismissOnBackdrop?: boolean;
  closeLabel?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "narrow",
  dismissOnBackdrop = true,
  closeLabel = "Close",
  footer,
  className = "",
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      /* `showModal()` throws on an already-open dialog, and React may re-run
         this effect without the flag having changed. */
      if (!el.open) el.showModal();
      /* Focus the panel rather than letting the platform land on the close
         control: the first thing announced should be the dialog's name, not
         the way out of it. */
      panelRef.current?.focus();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  /* Escape routes back through `onClose` so React state stays the truth.
     Without `preventDefault` the element closes itself, `open` stays true,
     and the dialog can never be reopened. */
  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  /* The native `close` event fires after the fact and cannot be prevented, so
     it is a resync rather than a close path: it calls back only when the
     element closed while React still believed it open. Guarding on `open` is
     what stops our own `el.close()` above from re-entering `onClose`. */
  const handleNativeClose = useCallback(() => {
    if (open) onClose();
  }, [open, onClose]);

  /* A click on the backdrop targets the dialog element itself — the panel
     stops anything landing inside it. */
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (!dismissOnBackdrop) return;
      if (event.target === ref.current) onClose();
    },
    [dismissOnBackdrop, onClose],
  );

  return (
    <dialog
      ref={ref}
      data-loz-dialog=""
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={[styles.dialog, size === "wide" ? styles.wide : "", className]
        .filter(Boolean)
        .join(" ")}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onClick={handleClick}
    >
      <div ref={panelRef} className={styles.panel} tabIndex={-1}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="toolbar"
            size="sm"
            iconOnly
            aria-label={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </Button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </dialog>
  );
}
