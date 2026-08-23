"use client";

import { useState, useSyncExternalStore } from "react";
import LionExperience from "@/components/LionExperience";
import LionScene from "@/components/intro/lion-scene";

/**
 * The whole thing, in order: the particle intro, then the homepage.
 *
 * They are not sequential mounts. The homepage renders from the first frame
 * and the intro plays *over* it — the intro's canvas is cleared with an alpha
 * of zero and its own veil is what holds the black. When the story reaches its
 * outro the veil fades over 2.8s, and what appears underneath is a lion that
 * has been waking the entire time rather than one starting from nothing.
 *
 * That also means every escape from the intro is free. Skip it, fail to get a
 * WebGL context, or arrive asking for reduced motion, and the page below is
 * already there and already finished.
 */
export default function Experience() {
  const reducedMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);

  // Read during render, not in an effect: mounting the intro and then tearing
  // it down would cost a reduced-motion reader the one frame it takes to
  // start, which is the frame they asked not to see.
  const showIntro = !introDone && !reducedMotion;

  return (
    <>
      <LionExperience />
      {showIntro ? (
        <LionScene
          mode="handoff"
          onComplete={() => setIntroDone(true)}
          /* No context, or the structure data would not load. There is a
             homepage underneath already; showing a wall of fallback prose in
             front of it would be the worse of the two. */
          onFailure={() => setIntroDone(true)}
        />
      ) : null}
    </>
  );
}

/**
 * `prefers-reduced-motion`, read during render.
 *
 * `getServerSnapshot` returns false because the server cannot know, and
 * guessing the other way would ship the static page to everyone.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia("(prefers-reduced-motion: reduce)");
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
