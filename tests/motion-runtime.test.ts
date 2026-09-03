import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { tierFor } from "@/components/particle-nav/hooks/usePerfTier";

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

/**
 * Comments are prose and prose is full of `.map()`, `new Vector3` and stray
 * parentheses, so they go before anything counts braces or looks for a
 * pattern. String and template literals are deliberately left in: a template
 * literal built inside a frame loop is itself an allocation this file looks
 * for.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Every `useFrame(...)` call in a file, as source text, found by matching
 * parentheses through the comment-stripped file. `balanced` is false if the
 * scan ran off the end — which would mean an unbalanced parenthesis survived
 * the strip, and the caller should fail rather than silently pass on a body
 * that is really the whole rest of the file.
 */
function frameCallbacks(source: string): { balanced: boolean; body: string }[] {
  const stripped = stripComments(source);
  const out: { balanced: boolean; body: string }[] = [];
  let from = 0;
  for (;;) {
    const at = stripped.indexOf("useFrame(", from);
    if (at === -1) return out;
    let depth = 0;
    let i = at + "useFrame".length;
    for (; i < stripped.length; i++) {
      const c = stripped[i];
      if (c === "(") depth++;
      else if (c === ")" && --depth === 0) break;
    }
    out.push({ balanced: depth === 0, body: stripped.slice(at, i + 1) });
    from = i + 1;
  }
}

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

describe("the intro clock advances by a bounded step", () => {
  /**
   * The bug this pins. `Scene.tsx` advanced `timelineTimeRef` by r3f's raw
   * frame delta, which is wall-clock time since the previous frame — and the
   * entrance is exactly where that diverges from rendered time: WebGPU init
   * and shader compilation stall the first frames, a backgrounded tab is
   * throttled to ~1 fps, and a GC pause costs whole seconds. Measured in
   * Chrome on 2026-09-04, the intro handed off ~3 s after load having played
   * nothing: one large delta carried the clock past `getRollingFinalTime`,
   * so `story.isComplete` was true on an early frame. A throttled pane
   * showed the same fault the other way round, advancing a second of
   * narrative per frame.
   */
  const scene = read("components/particle-nav/Scene.tsx");

  it("clamps the per-frame step rather than adding the raw delta", () => {
    expect(scene).toMatch(/export const TIMELINE_MAX_STEP = ([\d.]+);/);
    /* The advance must go through the clamp — not `+ delta` on its own. */
    expect(scene).toMatch(
      /timelineTimeRef\.current \+ Math\.min\(delta, TIMELINE_MAX_STEP\)/,
    );
    expect(scene).not.toMatch(/timelineTimeRef\.current \+ delta[,)]/);
  });

  it("the clamp is a slow-machine floor, not a speed limit on a healthy one", () => {
    const step = Number(scene.match(/TIMELINE_MAX_STEP = ([\d.]+);/)![1]);
    /* Never below a 60 fps frame, or every machine would run in slow motion. */
    expect(step).toBeGreaterThan(1 / 60);
    /* Never so large that a stall can still skip a whole stage: the shortest
       stage in the timeline is the 0.15 s stream pre-roll. */
    expect(step).toBeLessThanOrEqual(0.15);
  });
});

describe("the frame writer runs before the layers that read it", () => {
  /**
   * `Scene.tsx` writes one `ExperienceFrame` per tick and four layers read
   * it. r3f sorts `useFrame` subscribers ascending by priority and, being a
   * child, every layer subscribed *after* the writer at the same default
   * priority — so each read the previous frame's lion transform. Over the
   * 1.1 s rise that detached the text stream from the lion it is emitted
   * from. The writer is now negative, which orders it first.
   *
   * The negative value also matters to r3f's auto-render gate:
   * `internal.priority += priority > 0 ? 1 : 0` counts only positive
   * priorities, so this must stay negative rather than becoming 0 or a
   * small positive number, or the post pass's ownership of rendering would
   * be the only thing holding the gate.
   */
  const scene = read("components/particle-nav/Scene.tsx");

  it("the writer subscribes at a negative priority, ahead of every reader", () => {
    expect(scene).toMatch(/const FRAME_WRITER_PRIORITY = -\d/);
    expect(scene).toMatch(/\}, FRAME_WRITER_PRIORITY\);/);
    /* The post pass keeps priority 1, so it still runs last. */
    expect(scene).toMatch(/postRef\.current\?\.post\.render\(\);\s*\}, 1\);/);
  });

  it("no reader of the shared frame subscribes before the writer", () => {
    /* Any layer priority must be greater than the writer's. The scan layer
       names its own; the rest are default (0). */
    const scan = read("components/particle-nav/layers/NetworkScan.tsx");
    const named = scan.match(/const SCAN_FRAME_PRIORITY = ([\d.]+)/);
    expect(named).not.toBeNull();
    expect(Number(named![1])).toBeGreaterThan(0);
    expect(Number(named![1])).toBeLessThan(1);
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

/**
 * §6 of `fixhomeTODO.md` — the intro's performance and lifecycle budget.
 *
 * Phase C put a lion → throat → glyph path in the text material and Phase D a
 * per-frame uniform sync in the scan, so the two things §6 actually guards
 * against are a layer that starts allocating once per frame at 60 Hz, and a
 * storage node that outlives the material that owns it. Both are source-level
 * properties; neither has a runtime under vitest, since there is no WebGPU
 * device here. The tier table is the exception and is exercised as a function.
 */
describe("§6 — the intro's per-frame and lifecycle budget", () => {
  const PARTICLE_NAV = "components/particle-nav";
  const frameFiles = () =>
    sourceFiles().filter(
      (file) => file.startsWith(`${PARTICLE_NAV}/`) && /useFrame\(/.test(read(file)),
    );

  it("the tier table still holds the three budgets §6 names", () => {
    /* A coarse pointer or a WebGL2 fallback drops to the smallest LOD with no
       bloom, whatever memory the device reports. */
    for (const memory of [undefined, 2, 4, 8, 32]) {
      for (const [backend, coarse] of [
        ["webgpu", true],
        ["webgl2", false],
        ["webgl2", true],
      ] as const) {
        const tier = tierFor(backend, memory, coarse);
        const label = `${backend}/${coarse}/${memory}`;
        expect(tier.particles, label).toBe(45_000);
        expect(tier.bloom, label).toBe("off");
      }
    }
    /* Nothing anywhere in the table exceeds DPR 2. */
    for (const backend of ["webgpu", "webgl2", "none"] as const) {
      for (const memory of [undefined, 2, 4, 8, 32]) {
        for (const coarse of [false, true]) {
          expect(
            tierFor(backend, memory, coarse).maxDpr,
            `${backend}/${memory}/${coarse}`,
          ).toBeLessThanOrEqual(2);
        }
      }
    }
    /* The full tier is still the full tier — the cap is a ceiling, not a
       flattening of the table. */
    expect(tierFor("webgpu", 8, false).particles).toBe(180_000);
    expect(tierFor("webgpu", 8, false).bloom).toBe("full");
    expect(tierFor("webgpu", 4, false).particles).toBe(90_000);
  });

  /**
   * The declared exemption, with its reasons. `Scene.tsx` owns the frame
   * solve, and three of its steps allocate on every frame:
   *
   *   - `getRollingStoryFrame()` returns a fresh frame object whose
   *     `activeLines` is built with `flatMap`, so an array plus one object per
   *     active line;
   *   - the `ExperienceFrame` itself is written as an object literal;
   *   - `connectorBezier()` builds six `Vector3`s, and the DOM label
   *     projection formats two template strings per node.
   *
   * All four predate this phase and all four are in a file this pass does not
   * own. They are listed rather than hidden so the exemption is a decision on
   * the record: the fix is a mutable frame written in place and a cached
   * Bézier, and it belongs to whoever owns `Scene.tsx` next.
   */
  const KNOWN_FRAME_ALLOCATORS = [`${PARTICLE_NAV}/Scene.tsx`];

  /** Helpers that build a mapping, a cloud or a layout — never per frame. */
  const REBUILD_HELPERS =
    /\b(getRollingStoryFrame|connectorBezier|mapTextToLionSources|packLionSourcePositions|lionExtractionPool|buildTextCloud|computeIntroLayout|createIntroTextMaterial|createLionMaterial|createNetworkScanMaterial|decodeLionBake)\(/;

  const ALLOCATION_PATTERNS: readonly [string, RegExp][] = [
    ["a constructor call", /new [A-Z]/],
    ["an array-returning method", /\.(map|flatMap|filter|slice|concat|split|join)\(/],
    ["Array.from", /Array\.from\(/],
    ["an object literal", /=\s*\{/],
    ["a template literal", /`/],
  ];

  it("every frame loop in the particle scene is found and parsed", () => {
    /* Non-empty, or the whole sweep below passes by matching nothing. */
    const files = frameFiles();
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      const callbacks = frameCallbacks(read(file));
      expect(callbacks.length, file).toBeGreaterThan(0);
      for (const { balanced } of callbacks) expect(balanced, file).toBe(true);
    }
    /* A stale exemption is as bad as a missing one. */
    for (const file of KNOWN_FRAME_ALLOCATORS) expect(files, file).toContain(file);
  });

  it("no unexempt frame loop allocates, rebuilds or sets React state", () => {
    for (const file of frameFiles()) {
      if (KNOWN_FRAME_ALLOCATORS.includes(file)) continue;
      const source = read(file);
      /* The component's own state setters, by name — the precise form of "sets
         React state", with none of a generic `set[A-Z]` pattern's false hits on
         `setScalar`/`setUniform`. */
      const setters = [
        ...source.matchAll(/const \[\s*\w+\s*,\s*(set[A-Z]\w*)\s*\]\s*=\s*useState/g),
      ].map((match) => match[1]);
      for (const { body } of frameCallbacks(source)) {
        for (const [label, pattern] of ALLOCATION_PATTERNS) {
          expect(pattern.test(body), `${file}: frame loop contains ${label}`).toBe(false);
        }
        expect(
          REBUILD_HELPERS.test(body),
          `${file}: frame loop calls a builder that belongs in an effect`,
        ).toBe(false);
        for (const setter of setters) {
          expect(
            new RegExp(`\\b${setter}\\(`).test(body),
            `${file}: frame loop calls ${setter}`,
          ).toBe(false);
        }
      }
    }
  });

  it("the scan's per-frame sync solves into scratch rather than allocating", () => {
    const scan = read(`${PARTICLE_NAV}/layers/NetworkScan.tsx`);
    /* One function, called from the loop and from the commit that follows a
       rebuild, so a fresh material is never drawn from its defaults. */
    expect(scan).toMatch(/useFrame\(\(\) => \{\s*syncScanUniforms\(/);
    expect(scan).toMatch(/useLayoutEffect\(\(\) => \{\s*syncScanUniforms\(/);
    expect(scan).toMatch(/scratch: ScanUniformScratch/);
    expect(scan).toMatch(/useMemo<ScanUniformScratch>/);
    /* Both solvers write into the caller's object and return it. */
    const scanIntro = read("components/intro/scanIntro.ts");
    expect(scanIntro).toMatch(/out: LionScanMask,\n\): LionScanMask \{/);
    expect(scanIntro).toMatch(/out: ScanCorridor,\n\): ScanCorridor \{/);
  });

  it("the text set is rebuilt only when the bake or the quantized layout changes", () => {
    const text = read(`${PARTICLE_NAV}/layers/IntroText.tsx`);
    /* The width feeding the glyph solve is bucketed, so a resize drag
       resamples at most once per bucket instead of once per frame. */
    expect(text).toMatch(/quantizeIntroWidth\(size\.width\)/);
    expect(text).toMatch(/useMemo\(\(\) => computeIntroLayout\([^)]*\), \[layoutKey\]\)/);
    expect(text).toMatch(/\}, \[layoutKey, lionHomes\]\)/);
    expect(read("components/intro/introLayout.ts")).toMatch(
      /Math\.round\(width \/ INTRO_WIDTH_QUANTUM_PX\) \* INTRO_WIDTH_QUANTUM_PX/,
    );
  });

  it("every storage node the text layer adds is released with its material", () => {
    const material = read(`${PARTICLE_NAV}/tsl/introTextMaterial.ts`);
    /* `sources` is the node Phase C added; it joins the two that were already
       disposed rather than being freed on a path of its own. */
    expect(material).toMatch(
      /const storages = sources \? \[positions, traits, sources\] : \[positions, traits\]/,
    );
    expect(material).toMatch(/material\.dispose\(\);/);
    const text = read(`${PARTICLE_NAV}/layers/IntroText.tsx`);
    /* Every unit the set owns, on both exits of the effect that built it. */
    expect(text).toMatch(/for \(const unit of \[\.\.\.set\.lines, set\.brand\]\) unit\.handle\.dispose\(\)/);
    expect(text).toMatch(/if \(cancelled\) disposeSet\(created\)/);
    expect(text).toMatch(/if \(created\) disposeSet\(created\)/);
  });

  it("the lion material owns no storage of its own, so disposing it is complete", () => {
    const point = read(`${PARTICLE_NAV}/tsl/pointMaterial.ts`);
    /* It reads the sim's buffers and never calls `instancedArray`, so the
       extraction uniforms Phase C added are plain uniform nodes with nothing
       to free — `handle.material.dispose()` in `LionCore` is the whole job. */
    expect(point).not.toMatch(/instancedArray\(/);
    expect(point).toMatch(/extraction: uniform\(0\)/);
    expect(point).toMatch(/extractionSeed: uniform\(0, 'uint'\)/);
    expect(read(`${PARTICLE_NAV}/layers/LionCore.tsx`)).toMatch(
      /useEffect\(\(\) => \(\) => handle\.material\.dispose\(\), \[handle\]\)/,
    );
    /* The sim's own buffers stay on the one path that owns them. */
    expect(read(`${PARTICLE_NAV}/hooks/useLionBuffers.ts`)).toMatch(
      /return \(\) => \{\s*cancelled = true;\s*created\?\.dispose\(\);/,
    );
  });

  it("every layer that builds GPU state also tears it down", () => {
    for (const file of [
      "layers/IntroText.tsx",
      "layers/LionCore.tsx",
      "layers/NetworkScan.tsx",
      "layers/OrbitalRings.tsx",
      "layers/Connectors.tsx",
      "layers/SpokeNodes.tsx",
    ]) {
      expect(read(`${PARTICLE_NAV}/${file}`), file).toMatch(/dispose/);
    }
  });
});
