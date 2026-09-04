"use client";

/**
 * The question box.
 *
 * ## The 600-character limit is shown, never enforced by truncation
 *
 * `postMessageSchema` trims and caps at 600. A `maxLength` attribute would
 * make the browser swallow every character past it — silently, mid-word,
 * while the person is still typing — and they would discover the loss only in
 * what they had actually asked. So overtyping is allowed, the counter turns
 * and then alarms, and the submit is refused with the exact number of
 * characters to cut. Nothing is removed from the field by this component; the
 * reader decides what to lose.
 *
 * The counter appears once there is something to count. A `0 / 600` on an
 * empty box is chrome that teaches nothing.
 */

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./ask.module.css";

const LIMIT = 600;
/* Where the count starts being information rather than noise. */
const NOTICE_AT = Math.round(LIMIT * 0.75);

export interface AskComposerProps {
  onAsk: (question: string) => void;
  disabled: boolean;
  /** Placed under the field: what the reader should know before asking. */
  hint?: string;
  label?: string;
  placeholder?: string;
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
  placeholder = "What does the desk hold on…",
  seed,
}: AskComposerProps) {
  const [value, setValue] = useState("");
  const id = useId();
  const counterId = `${id}-count`;
  const hintId = `${id}-hint`;

  /* Adjusted during render rather than in an effect — React re-runs this pass
     before painting, so the refilled box never flashes empty, and the
     alternative is the cascading render `react-hooks/set-state-in-effect`
     refuses. Same pattern as `SearchPanel`'s selection reset. */
  const [seeded, setSeeded] = useState<number | null>(null);
  if (seed && seed.nonce !== seeded) {
    setSeeded(seed.nonce);
    setValue(seed.text);
  }

  const length = value.trim().length;
  const over = length - LIMIT;
  const tone = over > 0 ? "over" : length >= NOTICE_AT ? "near" : "ok";
  const canSubmit = !disabled && length > 0 && over <= 0;

  const submit = () => {
    if (!canSubmit) return;
    onAsk(value);
    setValue("");
  };

  return (
    <form
      className={styles.composer}
      data-ask-composer-state={canSubmit ? "ready" : "idle"}
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
        <p className={styles.composerHint} id={hintId}>
          {hint ?? (
            <>
              <kbd>↵</kbd> to ask, <kbd>⇧</kbd>
              <kbd>↵</kbd> for a new line.
            </>
          )}
        </p>
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
          <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
            Ask
          </Button>
        </div>
      </div>
    </form>
  );
}
