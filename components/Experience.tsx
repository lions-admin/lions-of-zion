"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import LionExperience, {
  type LionExperienceHandle,
} from "@/components/LionExperience";
import LionScene from "@/components/intro/lion-scene";
import NavigationLayer from "@/components/nav/NavigationLayer";

/**
 * The whole thing, in order: the particle intro, then the homepage, then the
 * navigation over both.
 *
 * The first two are not sequential mounts. The homepage renders from the first
 * frame and the intro plays *over* it — the intro's canvas is cleared with an
 * alpha of zero and its own veil is what holds the black. When the story
 * reaches its outro the veil fades over 2.8s, and what appears underneath is a
 * lion that has been waking the entire time rather than one starting from
 * nothing.
 *
 * That also means every escape from the intro is free. Skip it, fail to get a
 * WebGL context, or arrive asking for reduced motion, and the page below is
 * already there and already finished.
 *
 * The navigation waits for the intro, because the intro owns the screen while
 * it runs. Once it arrives, the only thing it asks of the layer beneath is how
 * far to step back.
 */
export default function Experience() {
  const reducedMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const lionRef = useRef<LionExperienceHandle>(null);

  // Read during render, not in an effect: mounting the intro and then tearing
  // it down would cost a reduced-motion reader the one frame it takes to
  // start, which is the frame they asked not to see.
  const showIntro = !introDone && !reducedMotion;

  /* The whole coupling between the two layers. The navigation says how present
     it needs the lion to be; the lion decides what that means. */
  const handleRecession = useCallback((value: number) => {
    lionRef.current?.setRecession(value);
  }, []);

  return (
    <>
      <LionExperience ref={lionRef} />
      {showIntro ? (
        <LionScene
          mode="handoff"
          onComplete={() => setIntroDone(true)}
          /* No context, or the structure data would not load. There is a
             homepage underneath already; showing a wall of fallback prose in
             front of it would be the worse of the two. */
          onFailure={() => setIntroDone(true)}
        />
      ) : (
        <NavigationLayer onRecession={handleRecession} />
      )}
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
