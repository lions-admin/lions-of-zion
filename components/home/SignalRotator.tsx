"use client";

/**
 * SignalRotator — the home signal rail takes a turn.
 *
 * The rail showed one pinned headline and dropped the rest of the record's
 * features on the floor. This turns them over, and the form is the argument:
 * a headline **arrives, then stands still** for `--dur-ambient` while it is
 * read, then leaves. It is not a crawl. Nothing moves under the eye that is
 * reading it, and seven seconds of stillness is the opposite of the urgency
 * a scrolling ticker manufactures.
 *
 * What this component knows about a publication: nothing. The items arrive
 * as already-rendered nodes from the server component that owns the rail's
 * markup and its stylesheet, so the source label, the verdict tone, the
 * `<time>` and the article link are composed once, in one place, and this
 * file only decides which of them is on screen. That is also why the server
 * HTML is a real headline rather than an empty shell: this renders item zero
 * on the server like any other component, and only the turning needs script.
 *
 * Three ways it stops:
 *
 *   1. `prefers-reduced-motion: reduce` — no timer is ever armed and no
 *      animation is ever applied. The first item is simply the item.
 *   2. A pointer over the rail, or focus anywhere inside it. A reader
 *      reaching for a link must not have it change under them. Releasing
 *      restarts the full dwell rather than resuming a part-spent one — the
 *      reader has only just looked back at it.
 *   3. Fewer than two items, where there is nothing to turn to. The rail's
 *      server component does not even mount this in that case.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type ReactNode,
} from "react";
import styles from "./signal-rotator.module.css";

/* One MediaQueryList for the document, created on first read and never on the
   server — the same shape as `Reveal`'s shared observer. `useSyncExternalStore`
   rather than an effect writing state: the preference is an external store,
   the server snapshot is "not reduced", and a reader who changes the setting
   with the page open is honoured on the next frame. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
let motionQuery: MediaQueryList | null = null;

function preference(): MediaQueryList {
  motionQuery ??= window.matchMedia(REDUCED_MOTION);
  return motionQuery;
}

function subscribeToMotion(onChange: () => void): () => void {
  const query = preference();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const motionIsReduced = () => preference().matches;
const motionIsReducedOnServer = () => false;

/**
 * `7s` or `240ms` from a custom property, in milliseconds.
 *
 * The dwell is a design token and a timer needs a number, so the number is
 * read from the token at the point of use instead of being copied into this
 * file. `--rail-dwell` resolves to `--dur-ambient` in the stylesheet next to
 * this one; retiming the site's ambient loops retimes the rail with it.
 */
function milliseconds(value: string): number {
  const text = value.trim();
  const amount = Number.parseFloat(text);
  if (!Number.isFinite(amount)) return 0;
  return text.endsWith("ms") ? amount : amount * 1000;
}

interface Turn {
  /** Index of the item on screen. */
  shown: number;
  /** Index of the item on its way out, or null when nothing is leaving. */
  leaving: number | null;
  /** Turns taken. Zero is the server's own render, which must not animate. */
  taken: number;
}

export interface SignalRotatorProps {
  /** The rendered signals, in order. Two or more; item zero is what the
   *  server paints and what a reader without script keeps. */
  items: ReactNode[];
  /** The stage's place in the rail's flex row — supplied by the rail so the
   *  responsive rules stay with the rest of the rail's responsive rules. */
  className?: string;
}

export function SignalRotator({ items, className }: SignalRotatorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerHold = useRef(false);
  const focusHold = useRef(false);
  const [held, setHeld] = useState(false);
  const [turn, setTurn] = useState<Turn>({ shown: 0, leaving: null, taken: 0 });
  const still = useSyncExternalStore(subscribeToMotion, motionIsReduced, motionIsReducedOnServer);
  const count = items.length;

  /* The dwell. Re-armed by `turn` changing, torn down by a hold — so a
     pointer arriving mid-dwell cancels the timer outright rather than
     leaving it to fire the moment the pointer leaves. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || count < 2 || held || still) return;

    const dwell = milliseconds(getComputedStyle(stage).getPropertyValue("--rail-dwell"));
    if (dwell <= 0) return;

    const timer = window.setTimeout(() => {
      setTurn({
        shown: (turn.shown + 1) % count,
        leaving: turn.shown,
        taken: turn.taken + 1,
      });
    }, dwell);
    return () => window.clearTimeout(timer);
  }, [count, held, still, turn]);

  /* Hover and focus are watched on the whole rail, not on the stage: the
     "All updates" link and the flag sit beside the rotating item, and a
     reader with the pointer or the caret on either of them is reading this
     band. The rail marks itself with `data-signal-rail`; falling back to the
     stage keeps the component usable on its own. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || count < 2) return;

    const rail = stage.closest<HTMLElement>("[data-signal-rail]") ?? stage;
    const settleHold = () => setHeld(pointerHold.current || focusHold.current);

    /* Touch has no hover to leave: a tap would pause the rail for good. */
    const pointerIn = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerHold.current = true;
      settleHold();
    };
    const pointerOut = () => {
      pointerHold.current = false;
      settleHold();
    };
    const focusIn = () => {
      focusHold.current = true;
      settleHold();
    };
    /* Tabbing from the headline to "All updates" is still focus in the rail. */
    const focusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && rail.contains(event.relatedTarget)) return;
      focusHold.current = false;
      settleHold();
    };

    rail.addEventListener("pointerenter", pointerIn);
    rail.addEventListener("pointerleave", pointerOut);
    rail.addEventListener("pointercancel", pointerOut);
    rail.addEventListener("focusin", focusIn);
    rail.addEventListener("focusout", focusOut);
    return () => {
      rail.removeEventListener("pointerenter", pointerIn);
      rail.removeEventListener("pointerleave", pointerOut);
      rail.removeEventListener("pointercancel", pointerOut);
      rail.removeEventListener("focusin", focusIn);
      rail.removeEventListener("focusout", focusOut);
    };
  }, [count]);

  /* The outgoing item is unmounted by its own animation ending, not by a
     second timer that could disagree with the stylesheet about how long the
     exit takes. */
  const drop = useCallback((event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setTurn((previous) => ({ ...previous, leaving: null }));
  }, []);

  return (
    <div
      ref={stageRef}
      className={[styles.stage, className].filter(Boolean).join(" ")}
      /* A headline replacing itself on a clock is not an alert, and a reader
         on a screen reader should meet it when they reach it rather than
         whenever the timer says so. */
      aria-live="off"
    >
      <div
        key={turn.taken}
        className={styles.slot}
        data-phase={turn.taken === 0 ? "settled" : "entering"}
      >
        {items[turn.shown]}
      </div>
      {turn.leaving !== null && !still ? (
        <div
          key={`leaving-${turn.taken}`}
          className={styles.slot}
          data-phase="leaving"
          /* `inert` is the load-bearing one: an outgoing headline must not
             leave a tabbable link behind it. `aria-hidden` covers the
             browsers that predate it. */
          inert
          aria-hidden="true"
          onAnimationEnd={drop}
        >
          {items[turn.leaving]}
        </div>
      ) : null}
    </div>
  );
}
