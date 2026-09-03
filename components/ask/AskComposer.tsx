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
}

export function AskComposer({
  onAsk,
  disabled,
  hint,
  label = "Your question",
  placeholder = "What does the desk hold on…",
}: AskComposerProps) {
  const [value, setValue] = useState("");
  const id = useId();
  const counterId = `${id}-count`;

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
        aria-describedby={length ? counterId : undefined}
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
        <p className={styles.composerHint}>
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
