"use client";

import { useEffect, useRef } from "react";

/**
 * The home hero's moving ground: one continuous 4K shot, delivered as two cuts.
 *
 * The source is a single unbroken take — the lion walks in over the first ten
 * seconds, settles, and then holds while the wind keeps working the mane. The
 * entrance is worth watching once; the settled half is what a background should
 * be doing for the rest of the visit. So the take ships as an `intro` (the whole
 * twenty seconds) and a `loop` cut from the settled tail, whose own first and
 * last frames were cross-faded together in the encode — measured at 29.6 dB, up
 * from 17.8 dB raw — so it repeats without a visible seam.
 *
 * The one seam the encode could not close is the handoff *between* the two
 * files. The intro ends at t=20 of the source and the loop begins at t=12.5;
 * the lion is planted in both, but the dust is not in the same place, so
 * swapping `src` would read as a jump. Two stacked elements and an opacity
 * cross-fade hide it at runtime for the same reason the encode's `xfade` hides
 * the loop's own seam — the eye accepts a dissolve between two near-identical
 * frames where it would catch a cut.
 *
 * State ledger, following the page it sits in:
 *  - no JavaScript: the poster is the ground. Nothing here renders a source,
 *    so nothing downloads.
 *  - reduced motion: the poster stays and neither element is ever given a
 *    source. This is a `matchMedia` read, not a CSS rule, because the point is
 *    to skip the *download*, not just the animation.
 *  - small screens: the same two-part sequence, from the 9:16 shoot instead.
 *    An earlier version skipped the entrance here and looped immediately, on
 *    the theory that a thumb is already on its way down the page — that was
 *    reversed deliberately: the entrance is the shot, and a phone that never
 *    sees it is being given the leftovers.
 *  - autoplay refused: `play()` rejects, nothing is caught on fire, the poster
 *    remains. Muted + `playsInline` is what makes the refusal rare.
 */

/**
 * Two shoots, not one shoot cropped twice.
 *
 * `wide` is the 16:9 take. `tall` is a separately generated 9:16 take of the
 * same subject — a portrait frame, not this one letterboxed or panned. That
 * matters: a phone viewport throws away most of a 16:9 frame's width, and the
 * best a landscape asset can do there is `object-position` aimed at the animal,
 * which is a crop of a composition rather than a composition. These are chosen
 * by viewport shape, and neither one's file is ever fetched on the other's.
 */
const SOURCES = {
  wide: {
    intro: "/video/lion-hero-intro-desktop.mp4",
    loop: "/video/lion-hero-loop-desktop.mp4",
    poster: "/video/lion-hero-poster-desktop.jpg",
  },
  tall: {
    intro: "/video/lion-hero-intro-mobile.mp4",
    loop: "/video/lion-hero-loop-mobile.mp4",
    poster: "/video/lion-hero-poster-mobile.jpg",
  },
} as const;

/** Exported so the stylesheet's static ground and this component paint the same
 *  frame, rather than two assets drifting apart in a later edit. */
export const HERO_POSTER_SRC = SOURCES.wide.poster;
export const HERO_POSTER_MOBILE_SRC = SOURCES.tall.poster;

/** How long before the intro ends the loop is started underneath it. Matches
 *  the CSS transition on `[data-hero-video]`; shorter and the dissolve clips,
 *  longer and the loop is audible as a second decode for no reason. */
const HANDOFF_LEAD_S = 0.9;

interface HeroVideoProps {
  /** Applied to both elements — they are pinned to the same box. */
  className?: string;
}

export function HeroVideo({ className }: HeroVideoProps) {
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const intro = introRef.current;
    const loop = loopRef.current;
    if (!intro || !loop) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Visibility is an attribute set on the element, not React state, for the
       same reason `data-engine-ready` was: this effect is already driving these
       two elements imperatively, and routing one boolean back through a render
       would buy nothing but a cascading update. `.heroVideo[data-visible]`
       is the only thing reading it. */
    const reveal = (el: HTMLVideoElement, other: HTMLVideoElement) => {
      el.toggleAttribute("data-visible", true);
      other.toggleAttribute("data-visible", false);
    };

    /* `play()` rejects on an autoplay refusal and on a source swapped mid-load.
       Neither is recoverable and neither is worth surfacing: the poster behind
       is a complete state on its own. */
    const start = (el: HTMLVideoElement) => void el.play().catch(() => {});

    /* Matches the `48rem` boundary every layout rule in `home.module.css` turns
       on. Read once: a viewport crossing it mid-visit would mean discarding a
       playing entrance to start another one, which is a worse experience than
       showing the shot it already began. */
    const shape = window.matchMedia("(max-width: 47.99rem)").matches
      ? SOURCES.tall
      : SOURCES.wide;

    /* The poster is set here rather than in JSX because it is the one attribute
       whose right value depends on the same measurement the sources do — and
       the server cannot make that measurement. The stylesheet paints its own
       still underneath in the meantime; see `.posterField`. */
    intro.poster = shape.poster;
    loop.poster = shape.poster;

    loop.src = shape.loop;
    intro.src = shape.intro;
    intro.load();
    reveal(intro, loop);
    start(intro);

    const handOff = () => {
      loop.load();
      start(loop);
      reveal(loop, intro);
    };

    /* The dissolve is started from the intro's own clock rather than from
       `ended`, which fires a frame *after* there is anything left to dissolve
       from. `handed` guards against `timeupdate` firing repeatedly inside the
       lead window. */
    let handed = false;
    const onTimeUpdate = () => {
      if (handed || !Number.isFinite(intro.duration)) return;
      if (intro.currentTime < intro.duration - HANDOFF_LEAD_S) return;
      handed = true;
      handOff();
    };

    /* If `timeupdate` never lands inside the lead window — a stalled buffer, a
       tab backgrounded across it — `ended` still reaches the loop, cut instead
       of dissolved. Worse-looking, but never a dead frame. */
    const onEnded = () => {
      if (handed) return;
      handed = true;
      handOff();
    };

    intro.addEventListener("timeupdate", onTimeUpdate);
    intro.addEventListener("ended", onEnded);
    return () => {
      intro.removeEventListener("timeupdate", onTimeUpdate);
      intro.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <>
      {/* No `poster` in the server markup on purpose. A `poster` is fetched
          even under `preload="none"`, and the server cannot know which shape of
          frame this viewport wants — so the landscape still would be pulled
          down on every phone that is about to use the portrait one. The effect
          sets it once it has measured; `.posterField` holds the picture until
          then, and in every state where the effect never runs at all. */}
      <video
        ref={introRef}
        className={className}
        muted
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
      />
      <video
        ref={loopRef}
        className={className}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}
