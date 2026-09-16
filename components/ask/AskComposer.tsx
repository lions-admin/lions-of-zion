"use client";

/**
 * The question box, rebuilt on the site's own primitives (2026-09-17,
 * Midnight Signal workstream F).
 *
 * For one week this box was AI Elements' `PromptInput` — a 1,463-line vendored
 * form that dragged the shadcn registry, Radix and lucide into the masthead's
 * drawer to accept a string. This is the same box on `components/ui`: a
 * `Field`-shaped well, a `Button` send, the one focus ring, no second
 * dependency stack. Everything the desk needs from the registry — the
 * textarea, the footer, the submit — is below, and nothing it never used
 * (file attachments, drop targets, command menus) survives.
 *
 * ## The 600-character limit is shown, never enforced by truncation
 *
 * `postMessageSchema` trims and caps at 600. A `maxLength` attribute would
 * make the browser swallow every character past it — silently, mid-word,
 * while the person is still typing — and they would discover the loss only in
 * what they had actually asked. So overtyping is allowed, the counter turns
 * and then alarms, and the submit is refused with the exact number of
 * characters to cut. Nothing is removed from the field by this component;
 * the reader decides what to lose.
 *
 * The counter appears once there is something to count. A `0 / 600` on an
 * empty box is chrome that teaches nothing.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import styles from "./ask.module.css";

const LIMIT = 600;
/* Where the count starts being information rather than noise. */
const NOTICE_AT = Math.round(LIMIT * 0.75);

export interface AskComposerProps {
  onAsk: (question: string) => void;
  /**
   * Off only when the desk cannot ask at all — an unconnected gateway. A turn
   * in flight is *not* a disabled composer: the next question can be typed
   * while the current one is answered, and disabling the box mid-wait drops
   * focus and a half-typed follow-up (Doherty's throttle hides system lag
   * behind responsiveness; a dead field is the opposite). Send, not type, is
   * what a wait closes.
   */
  disabled: boolean;
  /** Placed under the field: what the reader should know before asking. */
  hint?: string;
  label?: string;
  placeholder?: string;
  /** Focus the box when the desk opens — the drawer does, the page does not. */
  autoFocus?: boolean;
  /** True while a turn is in flight: send becomes Stop, typing stays live. */
  busy?: boolean;
  /** Called by the Stop control; only meaningful while `busy`. */
  onStop?: () => void;
  /** The one quiet reset beside the hint, offered only when there is
   *  conversation behind it. */
  onReset?: () => void;
  /**
   * Text to put back in the box (STATE-003). The desk uses it to hand a failed
   * question back for editing, so recovering from an error never means
   * retyping. `nonce` is what makes a second recall of the *same* text arrive
   * — a bare string prop would compare equal and be ignored.
   */
  seed?: { text: string; nonce: number };
}

export function AskComposer({
  onAsk,
  disabled,
  hint,
  label = "Your question",
  placeholder = "Ask about a claim, a video, a source…",
  autoFocus = false,
  busy = false,
  onStop,
  onReset,
  seed,
}: AskComposerProps) {
  const [value, setValue] = useState("");
  const id = useId();
  const counterId = `${id}-count`;
  const hintId = `${id}-hint`;
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  /* Adjusted during render rather than in an effect — React re-runs this pass
     before painting, so the refilled box never flashes empty, and the
     alternative is the cascading render `react-hooks/set-state-in-effect`
     refuses. Same pattern as `SearchPanel`'s selection reset. */
  const [seeded, setSeeded] = useState<number | null>(null);
  if (seed && seed.nonce !== seeded) {
    setSeeded(seed.nonce);
    setValue(seed.text);
  }

  useEffect(() => {
    if (autoFocus) fieldRef.current?.focus();
  }, [autoFocus]);

  const length = value.trim().length;
  const over = length - LIMIT;
  const tone = over > 0 ? "over" : length >= NOTICE_AT ? "near" : "ok";
  const canSend = !disabled && !busy && length > 0 && over <= 0;

  const submit = () => {
    if (!canSend) return;
    onAsk(value);
    setValue("");
  };

  return (
    <form
      className={styles.composer}
      data-ask-composer-state={canSend ? "ready" : "idle"}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className={styles.composerLabel} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        ref={fieldRef}
        className={styles.composerField}
        value={value}
        rows={3}
        placeholder={placeholder}
        disabled={disabled}
        /* A11Y-007: the hint under the box is part of this field's
           description, not decoration beside it. It carries the Enter /
           Shift+Enter contract in the idle state and the reason the box is
           disabled in the others — a reader who never sees it is told
           nothing about either. The counter joins it once there is
           something to count. */
        aria-describedby={[hintId, length ? counterId : null].filter(Boolean).join(" ")}
        aria-invalid={over > 0 || undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.key === "Process") return;
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className={styles.composerFoot}>
        <div className={styles.composerFootStart}>
          <p className={styles.composerHint} id={hintId}>
            {hint ?? (
              <>
                <Kbd>↵</Kbd> to ask, <Kbd>⇧</Kbd>
                <Kbd>↵</Kbd> for a new line.
              </>
            )}
          </p>
          {onReset ? (
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              New conversation
            </Button>
          ) : null}
        </div>
        <div className={styles.composerActions}>
          {length ? (
            <p className={styles.counter} id={counterId} data-tone={tone}>
              {over > 0 ? (
                <>Trim {over} {over === 1 ? "character" : "characters"}</>
              ) : (
                <>
                  <span className={styles.counterValue}>{length}</span> / {LIMIT}
                </>
              )}
            </p>
          ) : null}
          {busy ? (
            /* The turn in flight is stoppable, and the stop lives where send
               lives — the same control, so there is never a moment with
               nothing to press. No error mark here, ever: a failed turn is a
               record in the transcript, and the button never dresses one up
               as something the send control did. */
            <Button type="button" variant="secondary" size="md" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="md" disabled={!canSend}>
              Send
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
