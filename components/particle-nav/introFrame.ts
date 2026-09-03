import type { RollingStoryFrame } from '@/components/intro/rolling-story-timeline';

/**
 * Mutable, render-loop-owned state shared by every layer in the single scene.
 *
 * Every field is written once per frame by `Scene.tsx` from the pure stage
 * envelopes in `components/intro/story-timeline.ts`, and read by the layers.
 * A layer never re-derives a stage from `time`; if it needs a value, the value
 * is added here and solved in one place.
 */
export interface ExperienceFrame {
  time: number;
  /** Eased formation progress: the lion gathers at centre, 1 at `FORMATION_END`. */
  assemble: number;
  crownReveal: number;
  lionOpacity: number;
  lionScale: number;
  lionY: number;
  /**
   * Eased rise progress, 0..1. Begins exactly when formation ends — there is
   * no hold — and reaches 1 on the boundary at which the first line builds.
   */
  lionRelocation: number;
  /**
   * Global envelope for lion-to-text emission. Opens over the stream
   * pre-roll so a throat exists below the lion before the first glyph, holds
   * through the story, releases with the text through the outro.
   */
  textFlow: number;
  /** Build progress of the newest entering line; 0 when no line is entering. */
  activeTextTransfer: number;
  /**
   * Eased outro progress, 0..1. It returns the lion to its centred base size
   * and releases the text while the entrance fades to the page underneath.
   *
   * This was `navReveal`, and it revealed an orbital navigation that no
   * longer exists; `scanReveal` and `readingMask` sat beside it and drove a
   * GPU scan layer that no longer exists either. Both were removed with
   * their consumers on 2026-09-04 rather than left as fields nothing reads.
   */
  outro: number;
  textOpacity: number;
  story: RollingStoryFrame;
}

export interface IntroControls {
  paused: boolean;
  skipRequested: boolean;
  nextCueRequested: boolean;
}
