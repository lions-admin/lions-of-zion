"use client";

/**
 * The question box — rebuilt on `components/ui` (owner decision 3, 2026-09-15).
 *
 * What stood here was `PromptInput` from `components/ai-elements`, which came
 * with `components/shadcn`, Tailwind, Radix, cmdk and a second icon family:
 * about 3,960 lines and six dependencies serving one feature, on a site whose
 * every other control is a CSS Module on the same tokens. The parts actually
 * used were a textarea that grows with its content, a footer and a submit —
 * and `FieldControl multiline` already does the first (`field-sizing: content`
 * in `field.module.css`), so the registry was paying for itself in overrides:
 * six rules in `ask.module.css` existed only to undo its borders, its `w-max`
 * rail and its 32px submit.
 *
 * ## Three properties this box has and the registry's did not
 *
 * **It stays usable while an answer is in flight.** `PromptInput` disabled its
 * textarea for the whole wait — up to two minutes — which drops focus to the
 * body mid-sentence and refuses a reader who wants to draft the follow-up
 * while they read. The field stays enabled; only the send is refused, and the
 * hint says why. Nothing is typed twice.
 *
 * **Send is refused on an empty box, and never carries an error.** The
 * registry's submit rendered a failure mark on itself, so the control that
 * sends a question also reported that the last one had failed — two meanings
 * on one button, one of them about a record that is on screen anyway. The
 * failure is a record in the transcript; this is a send button.
 *
 * **The 600-character limit is shown, never enforced by truncation.**
 * `postMessageSchema` trims and caps at 600. A `maxLength` attribute would
 * make the browser swallow every character past it — silently, mid-word,
 * while the person is still typing — and they would discover the loss only in
 * what they had actually asked. So overtyping is allowed, the counter turns
 * and then alarms, and the submit is refused with the exact number of
 * characters to cut. Nothing is removed from the field by this component; the
 * reader decides what to lose. The counter appears once there is something to
 * count: a `0 / 600` on an empty box is chrome that teaches nothing.
 */

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FieldControl, FieldShell } from "@/components/ui/Field";
import styles from "./ask.module.css";

const LIMIT = 600;
/* Where the count starts being information rather than noise. */
const NOTICE_AT = Math.round(LIMIT * 0.75);

export interface AskFieldProps {
  onAsk: (question: string) => void;
  /**
   * A turn is in flight. The field stays live; the send is refused and says
   * so. Distinct from `disabled`, which is the box genuinely being unusable.
   */
  busy?: boolean;
  /** The desk cannot take a question at all — restoring, or unavailable. */
  disabled?: boolean;
  /** Placed under the field: what the reader should know before asking. */
  hint?: ReactNode;
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

export function AskField({
  onAsk,
  busy = false,
  disabled = false,
  hint,
  label = "Your question",
  placeholder = "Ask about a claim, a video, a source…",
  seed,
}: AskFieldProps) {
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
  const canSubmit = !disabled && !busy && length > 0 && over <= 0;

  const submit = () => {
    if (!canSubmit) return;
    onAsk(value);
    setValue("");
  };

  const describedBy = [hintId, length ? counterId : null].filter(Boolean).join(" ");

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FieldShell fieldId={id} label={label} className={styles.composerShell}>
        <FieldControl
          multiline
          id={id}
          className={styles.composerField}
          value={value}
          rows={3}
          placeholder={placeholder}
          disabled={disabled}
          /* A11Y-007: the hint under the box is part of this field's
             description, not decoration beside it. It carries the Enter /
             Shift+Enter contract in the idle state and the reason the send is
             refused in the others — a reader who never sees it is told
             nothing about either. The counter joins it once there is
             something to count. */
          aria-describedby={describedBy}
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
      </FieldShell>
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
                <>
                  Trim {over} {over === 1 ? "character" : "characters"}
                </>
              ) : (
                <>
                  <span className={styles.counterValue}>{length}</span> / {LIMIT}
                </>
              )}
            </p>
          ) : null}
          {/* Send is not a focal moment until it is one.
              It shipped as a saturated gold plate in the corner of every
              panel state, including the one where nothing has been typed
              yet, and `globals.css` reserves the accent for one focal moment
              per viewport — which the masthead's Support Us is already
              spending on this screen. So it waits: an outline while there is
              nothing to send, the primary the moment there is, because at
              that point it *is* the primary action. */}
          <Button
            type="submit"
            variant={canSubmit ? "primary" : "secondary"}
            size="md"
            disabled={!canSubmit}
          >
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
