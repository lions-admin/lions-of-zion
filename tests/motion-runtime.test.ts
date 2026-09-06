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

/* `frameCallbacks()` — a brace-matching reader for every `useFrame(...)` body
   — stood here. Its only callers were the particle-nav frame-budget blocks,
   and `useFrame` is a react-three-fiber hook with no remaining consumer in the
   tree, so it went with them on 2026-09-05. */

describe("MOTION-002 — the animation-loop inventory", () => {
  /**
   * The closed set of files allowed to drive a frame loop. A new entry here
   * is not a failure, it is the prompt to give the loop the four properties
   * and add it to the report — which is the whole point of the list.
   */
  const KNOWN_FRAME_LOOPS = [
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
    /* One coalesced frame per pointer-move burst: the handler books at most
       one rAF at a time, and `clear()` — on pointerleave, blur,
       visibilitychange and the unmount cleanup — cancels the booked frame
       before nulling the handle. Registered 2026-09-05. */
    "components/motion/PointerHighlight.tsx",
    /* One frame, booked on mount, that defers the introduction's own
       open decision past hydration so the server HTML is never the open
       dialog. The cleanup cancels it. Registered 2026-09-05. */
    "components/home/EditorialIntro.tsx",
    /* One frame, booked after the investigation URL is read on mount, that
       defers applying the restored selection past hydration so the server
       snapshot (an empty selection) is never diverged from before hydration
       settles — idempotent under StrictMode's double effect. The cleanup
       cancels it. Registered 2026-09-06. */
    "components/investigation/InvestigationProvider.tsx",
    "components/investigation/NetworkExplorer.tsx",
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

  /* Two assertions stood here for `components/typographic-field/` — the
     telemetry sampler's interval and the engine's offscreen gate. The
     subsystem was retired on 2026-09-05 (it had been unmounted since
     `dcf4355` and unreachable from any route since), so they were removed
     with it rather than left asserting on a deleted file. */

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
      /* The same category as its two siblings above: a bounded fictional
         walkthrough, not an ambient background. `data-running` (and so these
         loops) is only ever true while `HomeEvidencePipeline`'s autoplay is
         genuinely mid-step — gated on visibility, `prefers-reduced-motion`
         and reaching the last stage — so it reads as real activity rather
         than decoration. Registered 2026-09-06. */
      "components/home/narrative-simulation.module.css",
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
