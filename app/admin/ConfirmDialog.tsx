"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { politeLive } from "@/components/ui/live-region";
import styles from "./admin.module.css";

/**
 * STATE-004 — the one destructive confirmation on the operations console.
 *
 * Every irreversible or publicly visible action routes through this, so the
 * four things an operator needs are always present and always in the same
 * places: the **action**, the exact **target**, the **consequence**, and a
 * **cancel** that is reached before the confirm in both reading and tab order.
 *
 * There is no bespoke confirm anywhere under `app/admin/`. `window.confirm`
 * used to stand in for three of these; it cannot name a target, cannot state
 * a consequence, is unstyled, and blocks the main thread.
 */
export type ConfirmIntent = {
  /** Imperative sentence naming the action. Becomes the dialog's name. */
  action: string;
  /** Exactly what the action lands on, in the operator's own words. */
  target: string;
  /** A second identifying line: a public id, a section, a date. */
  targetDetail?: string;
  /** What changes, and whether it can be undone. Never omitted. */
  consequence: string;
  /** The verb, repeated on the confirming control. Never "OK". */
  confirmLabel: string;
  /** `danger` for deletion, de-publication, and anything irreversible. */
  tone?: "danger" | "primary";
  /** One input the action needs before it can run — a reason for the audit
   *  log. Rendered under the three facts, never in place of them. */
  body?: ReactNode;
  run: () => void | Promise<void>;
};

type ConfirmPanelProps = {
  intent: ConfirmIntent;
  onClose: () => void;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
};

export interface ConfirmDialogProps {
  /** `null` closes and unmounts. The caller owns this state. */
  intent: ConfirmIntent | null;
  onClose: () => void;
  /** Where focus goes when the opening control no longer exists — after a
   *  delete, the row that opened the dialog is gone. Point this at a
   *  `tabIndex={-1}` container that survives the action. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

export function ConfirmDialog({ intent, onClose, fallbackFocusRef }: ConfirmDialogProps) {
  if (!intent) return null;
  return (
    <ConfirmPanel
      /* Remount per intent so the captured opener and the pending flag never
         carry over from the previous confirmation. */
      key={`${intent.action}::${intent.target}`}
      intent={intent}
      onClose={onClose}
      fallbackFocusRef={fallbackFocusRef}
    />
  );
}

function ConfirmPanel({ intent, onClose, fallbackFocusRef }: ConfirmPanelProps) {
  const [running, setRunning] = useState(false);

  /* Captured during the first render — before `Dialog`'s effect moves focus
     into the panel — so this is still the control the operator pressed. */
  const opener = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  /* Focus return happens on unmount, deferred one frame: the modal holds the
     rest of the document inert while it is open, so restoring focus any
     earlier is rejected. Every close path — Escape, the close control,
     Cancel, the backdrop, and a completed action — ends in an unmount, which
     is why there is one restore rather than five. */
  useEffect(
    () => () => {
      const target = opener.current;
      const fallback = fallbackFocusRef?.current ?? null;
      window.requestAnimationFrame(() => {
        if (target && target.isConnected) target.focus();
        else fallback?.focus();
      });
    },
    [fallbackFocusRef],
  );

  const danger = intent.tone !== "primary";

  return (
    <Dialog
      open
      onClose={onClose}
      title={intent.action}
      /* A stray backdrop click cancels, which is the safe direction. */
      dismissOnBackdrop
      closeLabel="Cancel and close"
      footer={
        <>
          <Button variant="secondary" type="button" disabled={running} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            type="button"
            isLoading={running}
            onClick={async () => {
              setRunning(true);
              try {
                await intent.run();
              } finally {
                onClose();
              }
            }}
          >
            {intent.confirmLabel}
          </Button>
        </>
      }
    >
      <dl className={styles.confirmFacts}>
        <dt>Action</dt>
        <dd>{intent.action}</dd>
        <dt>Target</dt>
        <dd>
          {intent.target}
          {intent.targetDetail ? <small>{intent.targetDetail}</small> : null}
        </dd>
        <dt>Consequence</dt>
        <dd className={danger ? styles.confirmDanger : undefined}>{intent.consequence}</dd>
      </dl>
      {intent.body ? <div className={styles.confirmBody}>{intent.body}</div> : null}
      {running ? (
        <p className={styles.confirmPending} {...politeLive}>
          Running the action. The result is reported on the console.
        </p>
      ) : null}
    </Dialog>
  );
}
