"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import LionScene from "@/components/intro/lion-scene";
import { ParticleNav } from "@/components/particle-nav";
import { defaultNodes } from "@/components/particle-nav/config";

const subscribeToHydration = () => () => {};

/**
 * The whole experience: the existing particle intro hands directly to the
 * WebGPU particle navigation.
 *
 * The real navigation DOM and fallback poster exist from the first HTML frame,
 * but the expensive second GPU scene waits until the intro begins its 2.8s
 * veil reveal. That reveal and the new lion's 2.8s particle assembly run
 * together, preserving the cinematic handoff without running two full particle
 * engines for the entire story. Skip, failure and reduced motion still land on
 * a complete navigation immediately.
 */
export default function Experience() {
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const [introDone, setIntroDone] = useState(false);
  const [navCanvasActive, setNavCanvasActive] = useState(false);

  // Read during render, not in an effect: mounting the intro and then tearing
  // it down would cost a reduced-motion reader the one frame it takes to
  // start, which is the frame they asked not to see.
  const showIntro = !introDone && !reducedMotion;

  const prepareNavigation = useCallback(() => {
    setNavCanvasActive(true);
  }, []);

  const completeIntro = useCallback(() => {
    setNavCanvasActive(true);
    setIntroDone(true);
  }, []);

  // On the server the navigation must remain usable: if JavaScript never
  // starts, <noscript> hides the cinematic layer and the poster + real links
  // are the complete experience. Hydration blocks them as soon as the intro
  // can actually run.
  const navigationBlocked = showIntro && hydrated;
  const navigationInteractive = !navigationBlocked;

  return (
    <>
      <main
        aria-hidden={navigationBlocked || undefined}
        inert={navigationBlocked ? true : undefined}
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
      >
        <ParticleNav
          nodes={defaultNodes}
          active={navCanvasActive || navigationInteractive}
        />
      </main>
      {showIntro ? (
        <div data-intro-enhancement="">
          <LionScene
            mode="handoff"
            onOutroStart={prepareNavigation}
            onComplete={completeIntro}
            onFailure={completeIntro}
          />
        </div>
      ) : null}
      <noscript>
        <style>{"[data-intro-enhancement]{display:none!important}"}</style>
      </noscript>
    </>
  );
}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
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
