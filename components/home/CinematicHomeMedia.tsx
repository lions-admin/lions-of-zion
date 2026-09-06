"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/home.module.css";

/** Decorative motion never gates navigation or the server-rendered cover. */
export function CinematicHomeMedia() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let enabled = false;
    let wantsMotion = true;
    let inView = true;
    let disposed = false;

    const sync = () => {
      if (enabled && wantsMotion && inView && !document.hidden) {
        void video.play().catch(() => {
          if (!disposed && enabled && inView && !document.hidden) wantsMotion = false;
        });
      } else video.pause();
    };
    const configure = () => {
      enabled = !reduced.matches;
      if (!enabled) {
        video.pause();
        video.removeAttribute("data-visible");
        video.removeAttribute("src");
        video.load();
        setPlaying(false);
        setAvailable(false);
        return;
      }
      video.src = window.matchMedia("(width < 48rem)").matches
        ? "/video/cinematic-home/lion-compact.mp4"
        : "/video/cinematic-home/lion-wide.mp4";
      sync();
    };
    const onReady = () => { if (!disposed && enabled) setAvailable(true); };
    const onPlay = () => { video.dataset.visible = "true"; setPlaying(true); };
    const onPause = () => setPlaying(false);
    const onError = () => {
      enabled = false;
      video.removeAttribute("data-visible");
      setPlaying(false);
      setAvailable(false);
    };
    const onToggle = () => { wantsMotion = !wantsMotion; sync(); };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("playing", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    video.addEventListener("toggle-motion", onToggle);
    reduced.addEventListener("change", configure);
    document.addEventListener("visibilitychange", sync);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(video);
    configure();
    return () => {
      disposed = true;
      observer.disconnect();
      reduced.removeEventListener("change", configure);
      document.removeEventListener("visibilitychange", sync);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      video.removeEventListener("toggle-motion", onToggle);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <>
      <div className={styles.fieldLayer} aria-hidden="true">
        <div className={styles.posterField} />
        <video ref={videoRef} className={styles.heroVideo} muted loop playsInline
          preload="none" tabIndex={-1} aria-hidden="true" />
        <div className={styles.heroScrim} />
      </div>
      {available && (
        <button className={styles.motionControl} type="button"
          aria-label={playing ? "Pause background motion" : "Play background motion"}
          onClick={() => videoRef.current?.dispatchEvent(new Event("toggle-motion"))}>
          <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>
          {playing ? "Pause motion" : "Play motion"}
        </button>
      )}
    </>
  );
}
