"use client";

import { useEffect, useRef } from "react";

const SOURCES = {
  wide: {
    intro: "/video/lion-hero-intro-desktop.mp4",
    loop: "/video/lion-hero-loop-desktop.mp4",
    poster: "/video/lion-hero-poster-desktop.jpg",
  },
  tall: {
    intro: "/video/lion-hero-intro-mobile-short.mp4",
    loop: "/video/lion-hero-loop-mobile.mp4",
    poster: "/video/lion-hero-poster-portrait.jpg",
  },
} as const;

export const HERO_POSTER_SRC = SOURCES.wide.poster;
export const HERO_POSTER_MOBILE_SRC = SOURCES.tall.poster;
const HANDOFF_LEAD_S = 0.9;

/** Each viewport gets its own entrance, then dissolves into the continuous loop.
 * Portrait uses a short, lightweight cut; the poster keeps content ready immediately. */
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
      intro.src = shape.intro;
      active = intro;
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
