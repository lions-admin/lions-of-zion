"use client";

import React, { useCallback, useEffect, useId, useRef } from "react";
import { Button } from "./Button";
import styles from "./dialog.module.css";

/**
 * Modal or end-edge drawer on the native `<dialog>` element.
 *
 * `showModal()` traps focus, marks the rest of the document inert, closes on
 * Escape, restores focus to the opener, and renders in the top layer. React
 * `open` remains the source of truth; platform close paths call `onClose`.
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
  /** `modal` is a centred panel. `drawer` is a full-height end-edge sheet. */
  variant?: "modal" | "drawer";
  /** Widen the modal from the narrow measure to the reading measure, or the
   *  drawer from a compact column to the narrow measure. */
  size?: "narrow" | "wide";
  /** A click on the backdrop closes by default. Turn it off for a dialog
   *  holding unsaved input, where a stray click should not discard work. */
  dismissOnBackdrop?: boolean;
  closeLabel?: string;
  footer?: React.ReactNode;
  className?: string;
  /** Forwarded onto the native `<dialog>` so a trigger's `aria-controls` can point at it. */
  id?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  variant = "modal",
  size = "narrow",
  dismissOnBackdrop = true,
  closeLabel = "Close",
  footer,
  className = "",
  id,
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

  /* `data-slot` on the panel, header, body and footer.
   *
   * `className` lands on the `<dialog>`, so a consumer that needs to re-grade
   * the panel itself — the Ask drawer wants a narrower one on the site's own
   * ground rather than the shared `--surface-1` — has no way to reach it: the
   * inner classes are CSS Module hashes, private to this file. The choice was
   * a `panelClassName`/`headerClassName`/`bodyClassName` prop each, or one
   * stable attribute per part. These are the same `data-slot` marks the
   * registry primitives in `components/shadcn/` already use, so it is the
   * idiom already in the codebase rather than a second one.
   *
   * They are a styling surface, not an API: nothing reads them in JS. */
  return (
    <dialog
      ref={ref}
      id={id}
      data-loz-dialog=""
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={[
        styles.dialog,
        variant === "drawer" ? styles.drawer : styles.modal,
        size === "wide" ? styles.wide : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onClick={handleClick}
    >
      <div ref={panelRef} data-slot="panel" className={styles.panel} tabIndex={-1}>
        <div data-slot="header" className={styles.header}>
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

        <div data-slot="body" className={styles.body}>{children}</div>

        {footer ? <div data-slot="footer" className={styles.footer}>{footer}</div> : null}
      </div>
    </dialog>
  );
}
