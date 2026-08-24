import type { RollingStoryFrame } from '@/components/intro/rolling-story-timeline';

/** Mutable, render-loop-owned state shared by every layer in the single scene. */
export interface ExperienceFrame {
  time: number;
  assemble: number;
  crownReveal: number;
  lionOpacity: number;
  lionScale: number;
  lionY: number;
  navReveal: number;
  textOpacity: number;
  story: RollingStoryFrame;
}

export interface IntroControls {
  paused: boolean;
  skipRequested: boolean;
  nextCueRequested: boolean;
}
