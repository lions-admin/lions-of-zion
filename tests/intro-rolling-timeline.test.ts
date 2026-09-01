import { describe, expect, it } from "vitest";
import {
  ROLLING_EXIT_DURATION,
  ROLLING_LINE_CADENCE_BY_LAYOUT,
  ROLLING_POOL_SIZE,
  getRollingFinalTime,
  getRollingStoryFrame,
} from "@/components/intro/rolling-story-timeline";
import type { StoryLayout } from "@/components/intro/story-timeline";

/* The intro's timing fails silently, and only on one layout — these are the
   numbers the design audit found nobody was measuring
   (`home-scene-mobile-intro-runs-nine-seconds-longer`).

   This suite used to be the second half of `particle-nav-layout.test.ts`,
   whose first half asserted the radial navigation's orbit geometry. The
   navigation was removed on 2026-09-01; the intro it shared a scene with was
   kept, so these assertions were carried over rather than deleted with it. */
describe("intro rolling timeline", () => {
  const STORY_LAYOUTS = [
    "desktop",
    "mobile",
  ] as const satisfies readonly StoryLayout[];
  /* 60Hz, the rate `Scene.tsx` actually samples this timeline at, so a
     violation the display would show is a violation this loop sees. */
  const SAMPLE_STEP = 1 / 60;

  it.each(STORY_LAYOUTS)("keeps %s's cadence at or above the dissolve", (layout) => {
    /* The governing constant. Below it a line has to be retired before it has
       finished dissolving, which overruns the sprite pool and stacks two
       dissolving clouds in row 0 — see the header of
       `rolling-story-timeline.ts`. The two assertions below are consequences
       of this one; it is stated separately so a retune fails on the cause
       rather than on the symptom. */
    expect(ROLLING_LINE_CADENCE_BY_LAYOUT[layout]).toBeGreaterThanOrEqual(
      ROLLING_EXIT_DURATION,
    );
  });

  it.each(STORY_LAYOUTS)(
    "gives every live %s line its own pool slot and its own row",
    (layout) => {
      const finalTime = getRollingFinalTime(layout);
      let maxActive = 0;
      let maxDissolving = 0;
      let slotCollisions = 0;

      for (let time = 0; time <= finalTime; time += SAMPLE_STEP) {
        const { activeLines } = getRollingStoryFrame(time, layout);
        maxActive = Math.max(maxActive, activeLines.length);
        /* `IntroText` draws one sprite per slot and keys the slot on
           `index % ROLLING_POOL_SIZE`, so two live lines sharing a slot is one
           of them silently not being drawn. */
        const slots = new Set(activeLines.map((line) => line.slot));
        if (slots.size !== activeLines.length) slotCollisions += 1;
        maxDissolving = Math.max(
          maxDissolving,
          activeLines.filter((line) => line.disperse > 0 && line.disperse < 1)
            .length,
        );
      }

      expect(slotCollisions).toBe(0);
      expect(maxActive).toBeLessThanOrEqual(ROLLING_POOL_SIZE);
      /* `getNormalPosition` clamps everything past the window to row 0, so a
         second concurrent dissolve is two particle clouds in one row. */
      expect(maxDissolving).toBeLessThanOrEqual(1);
    },
  );

  it("does not spend more of a phone's time than a desktop's on twelve sentences", () => {
    /* The line count is art direction and the sentences are content, so the
       phone must not be charged for the narrower measure. 10% is the budget
       the last retune landed inside — 9.7%, 42.33s against 38.58s — and the
       header of `rolling-story-timeline.ts` records why the rest of that gap
       is the cost of the line breaks rather than of the clock. A mobile array
       that grows past 21 lines fails here, and correctly: it cannot be paid
       for out of cadence without breaking the assertion above. */
    const desktop = getRollingFinalTime("desktop");
    const mobile = getRollingFinalTime("mobile");
    expect(Math.abs(mobile / desktop - 1)).toBeLessThanOrEqual(0.1);
  });
});
