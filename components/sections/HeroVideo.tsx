"use client";

import { useEffect, useRef } from "react";

const SOURCES = {
  /* The landscape cover carries no entrance, and that is a deliberate step
     back. From 2026-09-14 (`9de670f`) it ran a 2560x1440 pair — a 33.4MB
     intro at 13.4 Mbps and a 9.8MB loop at 12.1 Mbps — and `playing` is the
     only event that reveals the frame. A reader whose link is slower than
     the bitrate never reaches that event, so the cover stayed on
     `.posterField` and the homepage was a photograph: the reported fault,
     and indistinguishable from a broken player because the poster IS the
     first frame. This is the 1920x1080 clip the cover ran before that swap
     (5.1MB at 3.4 Mbps, one continuous loop), so the desktop starts inside a
     second again on an ordinary connection. The heavy pair stays in
     `public/video/` for a re-encode; nothing points at it.
     Do not raise a hero source above ~4 Mbps without re-checking this. */
  wide: {
    intro: null,
    loop: "/video/cinematic-home/lion-wide.mp4",
    poster: "/video/lion-hero-poster-desktop.jpg",
  },
  /* Portrait keeps its entrance: 2.1MB and 2.2MB, both under 3 Mbps, which
     is why the phone never showed the fault the landscape pair did. */
  tall: {
    intro: "/video/lion-hero-intro-mobile-short.mp4",
    loop: "/video/lion-hero-loop-mobile.mp4",
    poster: "/video/lion-hero-poster-portrait.jpg",
  },
} as const;

export const HERO_POSTER_SRC = SOURCES.wide.poster;
export const HERO_POSTER_MOBILE_SRC = SOURCES.tall.poster;
const HANDOFF_LEAD_S = 0.9;

/** Portrait plays a short entrance and dissolves into the continuous loop;
 * landscape is the loop alone. Either way the poster holds the frame until a
 * `playing` event arrives, so a source heavy enough to stall reads to a reader
 * as a still photograph — see the weight note on `SOURCES`. */
export function HeroVideo({ className }: { className?: string }) {
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const intro = introRef.current;
    const loop = loopRef.current;
    if (!intro || !loop) return;

    const wide = window.matchMedia("(min-width: 760px) and (min-aspect-ratio: 6/5)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active: HTMLVideoElement = loop;
    let handed = false;
    let inView = true;

    const play = (video: HTMLVideoElement) => {
      if (!reduced.matches && inView && !document.hidden) {
        void video.play().catch(() => {});
      }
    };
    const reveal = (video: HTMLVideoElement, other: HTMLVideoElement) => {
      video.toggleAttribute("data-visible", true);
      other.removeAttribute("data-visible");
      other.pause();
    };
    const onIntroPlaying = () => reveal(intro, loop);
    const onLoopPlaying = () => reveal(loop, intro);
    const configure = () => {
      intro.pause();
      loop.pause();
      intro.removeAttribute("data-visible");
      loop.removeAttribute("data-visible");
      handed = false;
      if (reduced.matches) {
        for (const video of [intro, loop]) {
          video.removeAttribute("src");
          video.load();
        }
        return;
      }
      const shape = wide.matches ? SOURCES.wide : SOURCES.tall;
      intro.poster = shape.poster;
      loop.poster = shape.poster;
      loop.src = shape.loop;
      if (shape.intro) {
        intro.src = shape.intro;
        active = intro;
      } else {
        /* No entrance on this shape: the loop is the whole cover. The intro
           element stays sourceless so it downloads nothing, and the handoff
           counts as already done — `handOff()` must never pull the loop back
           to its first frame once it is the thing playing. */
        intro.removeAttribute("src");
        intro.load();
        handed = true;
        active = loop;
      }
      active.load();
      play(active);
    };
    const handOff = () => {
      if (handed) return;
      handed = true;
      active = loop;
      loop.load();
      play(loop);
    };
    const onTimeUpdate = () => {
      if (Number.isFinite(intro.duration) && intro.currentTime >= intro.duration - HANDOFF_LEAD_S) handOff();
    };
    const syncVisibility = () => {
      if (document.hidden || !inView) {
        intro.pause();
        loop.pause();
      } else play(active);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncVisibility();
    });
    observer.observe(loop);
    intro.addEventListener("playing", onIntroPlaying);
    loop.addEventListener("playing", onLoopPlaying);
    intro.addEventListener("timeupdate", onTimeUpdate);
    intro.addEventListener("ended", handOff);
    intro.addEventListener("error", handOff);
    wide.addEventListener("change", configure);
    reduced.addEventListener("change", configure);
    document.addEventListener("visibilitychange", syncVisibility);
    configure();

    return () => {
      observer.disconnect();
      intro.removeEventListener("playing", onIntroPlaying);
      loop.removeEventListener("playing", onLoopPlaying);
      intro.removeEventListener("timeupdate", onTimeUpdate);
      intro.removeEventListener("ended", handOff);
      intro.removeEventListener("error", handOff);
      wide.removeEventListener("change", configure);
      reduced.removeEventListener("change", configure);
      document.removeEventListener("visibilitychange", syncVisibility);
      intro.pause();
      loop.pause();
    };
  }, []);

  return (
    <>
      <video ref={introRef} className={className} muted playsInline preload="none" aria-hidden="true" tabIndex={-1} />
      <video ref={loopRef} className={className} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
    </>
  );
}
