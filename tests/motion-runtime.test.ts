import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOTION-002 / PERF-006 / PERF-007 — the motion runtime inventory, pinned.
 *
 * MOTION-002's acceptance is that every animation loop and observer on the
 * site has a stated purpose, an offscreen pause, a cleanup, and a
 * reduced-motion result. An inventory is a document; the day after it is
 * written someone adds the fourth `requestAnimationFrame` and it is wrong.
 * These are the four properties as assertions, so the inventory is a thing
 * the suite maintains rather than a thing a report claimed once.
 *
 * They read source text on purpose. The subjects are browser-runtime
 * scheduling — rAF, IntersectionObserver, backdrop-filter layer counts — and
 * none of it exists under vitest's node environment, so the alternative is
 * not a better test, it is no test. `tests/information-war.test.ts` pins
 * SignalBeam's shared-observer contract the same way.
 */

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

/** Files under `app/` and `components/` whose name matches `pattern`. */
function filesMatching(pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(ROOT, dir))) {
      const relative = `${dir}/${entry}`;
      if (statSync(path.join(ROOT, relative)).isDirectory()) walk(relative);
      else if (pattern.test(entry)) out.push(relative);
    }
  };
  walk("app");
  walk("components");
  return out;
}

const sourceFiles = () => filesMatching(/\.tsx?$/);
const styleFiles = () => filesMatching(/\.css$/);

describe("MOTION-002 — the animation-loop inventory", () => {
  /**
   * The closed set of files allowed to drive a frame loop. A new entry here
   * is not a failure, it is the prompt to give the loop the four properties
   * and add it to the report — which is the whole point of the list.
   */
  const KNOWN_FRAME_LOOPS = [
    "components/typographic-field/engine.ts",
    "components/pipeline-visualizer/hooks/usePipelineSimulation.ts",
  ];

  /**
   * Not a loop: one rAF coalesces every beam's layout read into a single
   * batch and does not reschedule itself. It needs no cancel — an unmounting
   * beam leaves the queue, so a frame already booked flushes a batch the beam
   * is no longer in.
   */
  const KNOWN_FRAME_BATCH = ["components/motion/SignalBeam.tsx"];

  /**
   * One-shot `requestAnimationFrame`s that defer a read or a subscription
   * past the commit. They hold a frame handle across an unmount, so they
   * cancel it.
   */
  const KNOWN_SINGLE_FRAME = [
    "components/sections/ReadingProgress.tsx",
    "components/sections/SectionToc.tsx",
  ];

  /**
   * Fire-and-forget frames that move focus one tick after a commit, and
   * deliberately keep no handle. Cancelling would need a ref threaded through
   * an event handler to insure against a callback whose entire effect is
   * `element.focus()` — which on a detached node is a no-op. Listed rather
   * than fixed so the exemption is a decision on the record.
   */
  const KNOWN_FOCUS_FRAME = [
    "app/admin/ConfirmDialog.tsx",
    "components/support/SupportFlowSwitch.tsx",
  ];

  it("no file schedules frames outside the declared set", () => {
    const callers = sourceFiles().filter((file) =>
      /requestAnimationFrame\s*\(/.test(read(file)),
    );
    expect(callers.sort()).toEqual(
      [
        ...KNOWN_FRAME_LOOPS,
        ...KNOWN_FRAME_BATCH,
        ...KNOWN_SINGLE_FRAME,
        ...KNOWN_FOCUS_FRAME,
      ].sort(),
    );
  });

  it("every frame scheduler cancels what it scheduled", () => {
    for (const file of [...KNOWN_FRAME_LOOPS, ...KNOWN_SINGLE_FRAME]) {
      expect(read(file), file).toMatch(/cancelAnimationFrame\s*\(/);
    }
    /* The batch's equivalent: the queue releases an unmounting beam, so a
       booked frame cannot measure a detached node. */
    for (const file of KNOWN_FRAME_BATCH) {
      expect(read(file), file).toMatch(/measureQueue\.delete\(beam\)/);
    }
    /* The exempt two stay exempt only while the frame's whole effect is a
       focus move. Anything else in that callback and this fails. */
    for (const file of KNOWN_FOCUS_FRAME) {
      const source = read(file);
      const at = source.indexOf("requestAnimationFrame(");
      expect(at, file).toBeGreaterThan(-1);
      /* A generous window rather than brace matching: the point is that
         nothing but focus happens near the callback, not its exact extent. */
      const body = source.slice(at, at + 300);
      expect(body, file).toMatch(/\.focus\(\)/);
      expect(body, file).not.toMatch(/set(State|Interval|Timeout)|fetch\(/);
    }
  });

  /**
   * The regression this file was written for. `TypographicField` published a
   * once-per-second readout from a `requestAnimationFrame` loop, so it woke
   * ~60 times a second to do nothing 59 of them — and it did so with none of
   * the three gates the engine underneath it honours, which meant a
   * scrolled-away, backgrounded, reduced-motion field still scheduled a frame
   * callback every 16ms for the life of the mount.
   */
  it("the typographic telemetry sampler is an interval, gated and cleaned up", () => {
    const source = read("components/typographic-field/TypographicField.tsx");

    /* The name survives in the comment recording why the loop went. */
    expect(source).not.toMatch(/requestAnimationFrame\s*\(/);
    expect(source).toMatch(/setInterval\(\s*sampleMetrics\s*,\s*1000\s*\)/);

    /* Offscreen and hidden both stop it, and both go through one function so
       they cannot drift apart. */
    expect(source).toMatch(/document\.hidden/);
    expect(source).toMatch(
      /addEventListener\(\s*"visibilitychange",\s*syncMetrics/,
    );
    expect(source).toMatch(/new IntersectionObserver/);

    for (const teardown of [
      /removeEventListener\(\s*"visibilitychange",\s*syncMetrics/,
      /stopMetrics\(\)/,
      /io\.disconnect\(\)/,
      /engine\.destroy\(\)/,
    ]) {
      expect(source).toMatch(teardown);
    }
  });

  /** MOTION-005's offscreen gate composes with hidden and reduced motion. */
  it("the typographic engine refuses to start while offscreen", () => {
    const engine = read("components/typographic-field/engine.ts");
    expect(engine).toMatch(
      /public start\(\)\s*\{\s*if \([^)]*this\.isOffscreen\)\s*return;/,
    );
    expect(engine).toMatch(/this\.isReducedMotion\)\s*\{[\s\S]{0,200}?return;/);
  });

  /** The simulation is the only ambient loop on `/pipeline`; it defers to §21. */
  it("the pipeline simulation does not auto-play under reduced motion", () => {
    const hook = read("components/pipeline-visualizer/hooks/usePipelineSimulation.ts");
    expect(hook).toMatch(/prefers-reduced-motion: reduce/);
    expect(hook).toMatch(/playIntent \?\? !prefersReducedMotion/);
  });
});

describe("PERF-007 — observers and listeners are scoped and released", () => {
  it("every IntersectionObserver/ResizeObserver owner also releases it", () => {
    const owners = sourceFiles().filter((file) =>
      /new (Intersection|Resize)Observer/.test(read(file)),
    );
    /* Non-empty, or the filter silently passed by matching nothing. */
    expect(owners.length).toBeGreaterThan(0);
    for (const file of owners) {
      expect(read(file), file).toMatch(/\.(disconnect|unobserve)\(/);
    }
  });

  it("every addEventListener has a removeEventListener or is once-only", () => {
    for (const file of sourceFiles()) {
      const source = read(file);
      const added = source.match(/addEventListener\(/g)?.length ?? 0;
      if (added === 0) continue;
      const removed = source.match(/removeEventListener\(/g)?.length ?? 0;
      const once = source.match(/\{\s*once:\s*true\s*\}/g)?.length ?? 0;
      expect(removed + once, `${file}: ${added} added, ${removed} removed, ${once} once`)
        .toBeGreaterThanOrEqual(added);
    }
  });

  /**
   * `Reveal` is mounted once per major section and there are up to two dozen
   * on a long editorial route, so one observer per instance would be two
   * dozen observers per page. The module holds exactly one and elements
   * register against it.
   */
  it("Reveal shares a single document-wide observer and unobserves on unmount", () => {
    const source = read("components/motion/Reveal.tsx");
    expect(source.match(/new IntersectionObserver/g)?.length).toBe(1);
    expect(source).toMatch(/let sharedObserver: IntersectionObserver \| null/);
    expect(source).toMatch(/return \(\) => sharedObserver\?\.unobserve\(element\)/);
    /* A reveal is once-only: the callback releases each element as it fires. */
    expect(source).toMatch(/observer\.unobserve\(entry\.target\)/);
  });

  it("SignalBeam releases an element as its last beam unmounts", () => {
    const source = read("components/motion/SignalBeam.tsx");
    expect(source).toMatch(/resizeObserver\?\.unobserve\(element\)/);
    expect(source).toMatch(/intersectionObserver\?\.unobserve\(beam\.container\)/);
    /* The maps are what would grow; they are deleted with the last member. */
    expect(source).toMatch(/beamsByElement\.delete\(element\)/);
    expect(source).toMatch(/beamsByContainer\.delete\(beam\.container\)/);
  });
});

describe("MOTION-003 — Reveal is limited to sections and ordered processes", () => {
  it("nothing renders a Reveal outside the two allowed hosts", () => {
    const callers = sourceFiles().filter(
      (file) => !file.startsWith("components/motion/") && /<Reveal\b/.test(read(file)),
    );
    expect(callers.sort()).toEqual([
      /* A claim ladder: a real ordered process, staggered. */
      "components/factcheck/ClaimEntry.tsx",
      /* `SectionBlock`: the major-section wrapper. */
      "components/sections/SectionPage.tsx",
    ]);
  });

  it("the archive index and the update feed are immediately available", () => {
    for (const file of [
      "components/archive/ArchiveIndex.tsx",
      "components/archive/ArchiveFullIndex.tsx",
      "components/live/UpdateFeed.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/<Reveal\b/);
    }
    /* The feed goes further and is not a client component at all, so its rows
       are in the server HTML rather than waiting on an observer. `ArchiveIndex`
       is deliberately a client component — it owns filtering and paging — but
       it stages nothing on entrance. */
    expect(read("components/live/UpdateFeed.tsx")).not.toMatch(
      /^["']use client["']/m,
    );
  });

  it("the one staggered list caps its stagger well inside the six-step limit", () => {
    /* §13 allows at most six visibly staggered items. The desk clamps the
       index it passes, so row 40 of a ladder arrives with row 4's delay
       rather than 2.8 seconds late. */
    expect(read("components/factcheck/FactCheckDesk.tsx")).toMatch(
      /index=\{Math\.min\(index,\s*([0-5])\)\}/,
    );
  });
});

describe("PERF-006 — capability caps on GPU and layered work", () => {
  it("the particle scene caps pixel ratio and particle count per tier", () => {
    const tier = read("components/particle-nav/hooks/usePerfTier.ts");
    expect(tier).toMatch(/maxDpr/);
    /* Nothing may exceed DPR 2, whatever the display reports. */
    for (const [, dpr] of tier.matchAll(/maxDpr:\s*([\d.]+)/g)) {
      expect(Number(dpr)).toBeLessThanOrEqual(2);
    }
    /* A coarse pointer or a WebGL2 fallback drops to the smallest LOD. */
    expect(tier).toMatch(
      /backend === 'webgl2' \|\| coarse\)[\s\S]{0,220}?particles: 45_000/,
    );
    expect(read("components/particle-nav/Scene.tsx")).toMatch(
      /dpr=\{\[1, tier\.maxDpr\]\}/,
    );
  });

  /**
   * The GPU scene is the entrance only. `showCanvas` is false once the intro
   * is dismissed, so the renderer unmounts rather than persisting behind the
   * page as a second frame loop for the rest of the session.
   */
  it("the GPU renderer unmounts at handoff instead of idling behind the page", () => {
    expect(read("components/particle-nav/CanvasMount.tsx")).toMatch(
      /const showCanvas =[\s\S]{0,160}?!introDismissed/,
    );
  });

  it("beams are capped page-wide and pause offscreen", () => {
    const source = read("components/motion/SignalBeam.tsx");
    const cap = source.match(/MAX_ANIMATED_BEAMS = (\d+)/);
    expect(cap).not.toBeNull();
    expect(Number(cap![1])).toBeLessThanOrEqual(12);
    expect(source).toMatch(/animatedCount < MAX_ANIMATED_BEAMS/);

    const css = read("components/motion/signal-beam.module.css");
    expect(css).toMatch(/data-beam-idle[\s\S]{0,120}?animation-play-state: paused/);
    expect(css).toMatch(/data-beam-capped[\s\S]{0,120}?display: none/);
  });

  it("ProgressiveBlur sheds backdrop layers on a coarse pointer", () => {
    const css = read("components/motion/progressive-blur.module.css");
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]{0,400}?nth-child\(3\)[\s\S]{0,60}?display: none/,
    );
    /* Two survivors, not zero — a plain gradient loses the defocus entirely. */
    /* Two surviving layers, each restated for `top` and `bottom` and each
       carrying its `-webkit-` prefix: 2 x 2 x 2. */
    const tierBlock = css.slice(css.indexOf("@media (pointer: coarse)"));
    expect(tierBlock.match(/backdrop-filter: blur/g)?.length).toBe(8);
  });
});

describe("A11Y-010 / §21 — every continuous animation has a reduced-motion result", () => {
  it("the global kill switch is present", () => {
    const globals = read("app/globals.css");
    expect(globals).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,320}?animation-iteration-count: 1 !important/,
    );
  });

  /**
   * The kill switch freezes an animation; it cannot say what should be left
   * standing in its place. A design-system primitive has to answer that
   * itself — a stationary bright chip on one corner of a border beam is worse
   * than no beam, and the removed `ShinyText` was the sharper case: frozen
   * mid-pass it left transparent glyphs over a background that was gone,
   * which is no text at all. So the rule is enforced where the answer is
   * load-bearing rather than everywhere the switch already reaches.
   */
  it("every motion primitive that loops declares its own reduced-motion result", () => {
    const looping = styleFiles().filter(
      (file) => file.startsWith("components/motion/") && /\binfinite\b/.test(read(file)),
    );
    expect(looping.length).toBeGreaterThan(0);
    for (const file of looping) {
      expect(read(file), file).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    }
  });

  it("no ambient loop cycles faster than the five-second floor", () => {
    /* §13: ambient loops run at 5s minimum. Processing indicators are the
       documented exception — they mark a bounded operation that is genuinely
       running, and a nine-second sweep would not read as activity. */
    const PROCESSING_INDICATORS = new Set([
      "components/ui/button.module.css",
      "components/ui/status-state.module.css",
      "components/search/search.module.css",
      "components/pipeline-visualizer/visualizer.module.css",
      "components/network/influence-graph.module.css",
    ]);
    for (const file of styleFiles()) {
      if (PROCESSING_INDICATORS.has(file)) continue;
      for (const [, seconds] of read(file).matchAll(
        /animation:[^;]*?\b([\d.]+)s\b[^;]*?\binfinite\b/g,
      )) {
        expect(Number(seconds), `${file}: ${seconds}s ambient loop`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
