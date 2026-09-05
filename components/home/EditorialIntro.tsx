"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { politeLive } from "@/components/ui/live-region";
import styles from "./editorial-intro.module.css";

export const INTRO_BEATS = [
  {
    label: "October 7, 2023",
    title: "On October 7, Hamas attacked Israel,",
    body: "murdering civilians and taking hostages.",
  },
  {
    label: "Before the attack",
    title: "Its propaganda machinery was already in place.",
    body: "",
  },
  {
    label: "The information war",
    title: "Manipulation.\nPropaganda.\nFabricated claims.",
    body: "Weapons in a battle for public opinion—shaping international pressure and the course of war.",
  },
  {
    label: "Why we exist",
    title: "Lions of Zion confronts false narratives with evidence.",
    body: "",
  },
] as const;

const SEEN_KEY = "loz:editorial-intro:v1";
const TICK_MS = 32;
const HOLD_MS = 3200;

/**
 * Text only: the original homepage video remains the sole moving image.
 *
 * Not built on `components/ui/Dialog` — that primitive is a `narrow`/`wide`
 * panel with a mandatory header carrying an `<h2>` and a ✕ toolbar button,
 * which is the product chrome this full-bleed editorial takeover exists to
 * not have. Rather than grow a third variant and an optional header on a
 * primitive the whole app depends on, the intro keeps its own element and
 * honours the same behaviour contract: accessible name and description,
 * focus placed on the panel rather than on the way out, Escape, background
 * inertness via `showModal()`, and focus restored to the opener.
 */
export function EditorialIntro() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const reducedMotion = useRef(false);
  const hold = useRef(0);
  const descriptionId = `${useId()}-intro-description`;
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [beat, setBeat] = useState(0);
  const [shown, setShown] = useState(0);
  const current = INTRO_BEATS[beat];
  const length = current.title.length + current.body.length;

  /* `shown` is mirrored into a ref because the typing tick reads it 30 times
     a second. Read from state instead and it lands in the interval effect's
     dependencies, which tears the timer down and builds a new one on every
     glyph. */
  const shownRef = useRef(0);
  const setTyped = useCallback((value: number) => {
    shownRef.current = value;
    setShown(value);
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const open = useCallback((replay: boolean) => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    returnFocus.current = replay ? replayRef.current : document.getElementById("home-wordmark");
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setBeat(0);
    setTyped(reducedMotion.current ? Number.MAX_SAFE_INTEGER : 0);
    setPaused(reducedMotion.current);
    hold.current = 0;
    dialog.showModal();
    /* The platform would land on the first focusable child — "Skip intro".
       The panel is focused instead so the name of the thing is announced
       before the way out of it. Same reasoning as `components/ui/Dialog`. */
    panelRef.current?.focus();
    setActive(true);
    try { sessionStorage.setItem(SEEN_KEY, "seen"); } catch { /* Storage is optional. */ }
  }, [setTyped]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAvailable(true);
      let seen = false;
      try { seen = sessionStorage.getItem(SEEN_KEY) === "seen"; } catch { /* Still skippable. */ }
      if (!seen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) open(false);
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = () => {
      reducedMotion.current = preference.matches;
      if (preference.matches) {
        setTyped(Number.MAX_SAFE_INTEGER);
        setPaused(true);
      }
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [open, setTyped]);

  const advance = useCallback(() => {
    if (beat === INTRO_BEATS.length - 1) { close(); return; }
    hold.current = 0;
    setTyped(reducedMotion.current ? Number.MAX_SAFE_INTEGER : 0);
    setBeat((value) => value + 1);
  }, [beat, close, setTyped]);

  useEffect(() => {
    if (!active || paused) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      if (shownRef.current < length) {
        setTyped(Math.min(length, shownRef.current + 2));
      } else {
        hold.current += TICK_MS;
        if (hold.current >= HOLD_MS) advance();
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [active, paused, length, advance, setTyped]);

  const settled = shown >= length;

  return (
    <>
      <button ref={replayRef} type="button" className={styles.replay} hidden={!available}
        onClick={() => open(true)}>
        Watch introduction <span aria-hidden="true">↗</span>
      </button>
      <dialog ref={dialogRef} className={styles.dialog} data-editorial-intro
        data-beat={beat}
        aria-label="Why Lions of Zion exists"
        aria-describedby={descriptionId}
        onClose={() => { setActive(false); returnFocus.current?.focus({ preventScroll: true }); }}>
        {/* The ground the statements stand on: the site's own hero still,
            veiled, opening a step per beat. Decorative — the stylesheet keys
            its opacity off `data-beat` above. */}
        <div className={styles.ground} aria-hidden="true" />
        <div ref={panelRef} className={styles.layout} tabIndex={-1}>
          <p id={descriptionId} className={styles.accessible}>
            A written introduction in four parts. Press Escape, or choose Skip intro,
            to enter the site at any time.
          </p>
          <header className={styles.header}>
            <span className={styles.brand}>Lions of Zion</span>
            <button type="button" className={styles.skip} onClick={close}>
              Skip intro <span aria-hidden="true">↗</span>
            </button>
          </header>
          <section className={styles.stage} aria-label={current.label}>
            <p className={styles.label}>{current.label}</p>
            <div className={styles.statement} aria-hidden="true">
              <h2 className={styles.title}>
                {current.title.slice(0, shown)}
                <span className={styles.unwritten}>{current.title.slice(shown)}</span>
              </h2>
              {current.body && <p className={styles.body}>
                {current.body.slice(0, Math.max(0, shown - current.title.length))}
                <span className={styles.unwritten}>
                  {current.body.slice(Math.max(0, shown - current.title.length))}
                </span>
              </p>}
            </div>
            <p className={styles.accessible} {...politeLive}>
              {current.title} {current.body}
            </p>
          </section>
          <footer className={styles.footer}>
            <div className={styles.progress} aria-label={`Part ${beat + 1} of ${INTRO_BEATS.length}`}>
              {INTRO_BEATS.map((item, index) => <span key={item.label} data-reached={index <= beat} />)}
            </div>
            <div className={styles.controls}>
              {/* Both labels occupy one grid cell, so the control reserves the
                  wider of the two and the row beside it never shifts as the
                  state changes. `visibility: hidden` keeps the inactive label
                  out of the accessibility tree as well as out of sight. */}
              <button type="button" onClick={() => setPaused((value) => !value)}>
                <span className={styles.swap}>
                  <span data-shown={!paused}>Pause</span>
                  <span data-shown={paused}>Resume</span>
                </span>
              </button>
              <button type="button" onClick={() => {
                if (shownRef.current < length) setTyped(length);
                else advance();
              }}>
                <span className={styles.swap}>
                  <span data-shown={!(beat === INTRO_BEATS.length - 1 && settled)}>Continue</span>
                  <span data-shown={beat === INTRO_BEATS.length - 1 && settled}>Enter the site</span>
                </span>
                <span aria-hidden="true"> →</span>
              </button>
            </div>
          </footer>
        </div>
      </dialog>
    </>
  );
}
