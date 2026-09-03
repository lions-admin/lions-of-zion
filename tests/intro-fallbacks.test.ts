import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Phase F — the entrance's exits.
 *
 * Everything the cinematic intro does is optional; every one of its failure
 * modes is not. This file pins the ways out: reduced motion, no GPU, a
 * renderer that never paints, and no JavaScript at all.
 *
 * Most of it reads source text, for the reason `tests/motion-runtime.test.ts`
 * states at the top of itself: the subjects are browser-runtime facts — a
 * media query, a `keydown`, a CSS transition, a touch target measured in CSS
 * pixels — and none of them exist under vitest's node environment, so the
 * alternative is not a better test, it is no test. The one property that
 * *can* be executed here — what a reader with scripting off is left with — is
 * rendered rather than matched.
 */

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

const mount = () => read("components/particle-nav/CanvasMount.tsx");
const gate = () => read("components/particle-nav/CinematicIntroGate.tsx");
const css = () => read("components/particle-nav/styles.module.css");

/* ── The two bypasses ─────────────────────────────────────────────────────── */

describe("the intro is bypassed rather than adapted", () => {
  /**
   * Reduced motion does not get a shorter intro, a slower intro, or a frozen
   * frame of one. It gets the settled home, immediately — the same result as
   * a machine with no GPU, reached through the same two booleans.
   */
  it("reduced motion and a missing backend both keep the entrance from running", () => {
    const source = mount();
    const running = source.match(/const introRunning = Boolean\(([\s\S]*?)\);/);
    expect(running, "introRunning is no longer a single Boolean(...) expression").not.toBeNull();
    expect(running![1]).toMatch(/!reducedMotion/);
    expect(running![1]).toMatch(/tier\?\.backend !== 'none'/);
  });

  it("reduced motion and a missing backend both dismiss the entrance layer", () => {
    const source = mount();
    const dismissed = source.match(/const introDismissed = Boolean\(([\s\S]*?)\);/);
    expect(dismissed, "introDismissed is no longer a single Boolean(...) expression").not.toBeNull();
    /* Not merely "does not run": dismissed, so `[data-intro-dismissed]` fades
       the fixed layer out and `showCanvas` drops the renderer entirely. */
    expect(dismissed![1]).toMatch(/reducedMotion/);
    expect(dismissed![1]).toMatch(/tier\?\.backend === 'none'/);
  });

  it("nothing runs a shortened particle stream for reduced motion", () => {
    /* The failure this forbids is a second, quicker timeline behind a
       reduced-motion branch. There is one clock, and reduced motion does not
       start it — the flag is passed to the scene and to the machine, never
       used to pick a different intro. */
    const source = mount();
    expect(source).not.toMatch(/reducedMotion\s*\?[^\n]*intro/i);
    expect(source.match(/reducedMotion/g)?.length).toBeGreaterThan(0);
  });
});

/* ── The dead-man switch ──────────────────────────────────────────────────── */

describe("a canvas that never paints still hands off", () => {
  /**
   * The bug: `usePerfTier` calls the backend `webgpu` on `'gpu' in navigator`
   * alone and never asks for an adapter, so a machine that advertises WebGPU
   * and cannot deliver it takes the intro path. `onReady` then never fires,
   * which means `onIntroComplete` never fires either — and `.skipIntro` is
   * `opacity: 0` until `[data-live]`, so the way out is invisible. The result
   * was a fixed, opaque, full-viewport black layer for the rest of the
   * session.
   */
  it("bounds readiness with a timeout that completes the intro", () => {
    const source = mount();
    const constant = source.match(/const INTRO_READY_TIMEOUT_MS = ([\d_]+);/);
    expect(constant, "the readiness bound is gone — a canvas that never paints hangs the route")
      .not.toBeNull();
    const ms = Number(constant![1].replace(/_/g, ""));
    /* Long enough that it cannot fire on a working canvas — a healthy first
       frame is hundreds of milliseconds — and short enough to be a fallback
       rather than a wait. */
    expect(ms).toBeGreaterThanOrEqual(3_000);
    expect(ms).toBeLessThanOrEqual(12_000);

    /* Armed on the intro running without a live canvas, and cleared by one. */
    expect(source).toMatch(
      /if \(!introRunning \|\| canvasLive\) return;[\s\S]{0,200}?setTimeout\(completeIntro, INTRO_READY_TIMEOUT_MS\)/,
    );
    expect(source).toMatch(/return \(\) => window\.clearTimeout\(id\)/);
  });

  it("routes the timeout through the ordinary guarded handoff", () => {
    /* `completeIntro`, not `setIntroDone` — so a timed-out entrance is marked
       seen, arms the 700ms stale-gesture guard, and clears the navigation
       timer exactly as a completed or skipped one does. */
    const source = mount();
    expect(source).toMatch(/setTimeout\(completeIntro,/);
    const complete = source.match(/const completeIntro = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/);
    expect(complete).not.toBeNull();
    expect(complete![1]).toMatch(/markIntroSeen\(\)/);
    expect(complete![1]).toMatch(/setIntroDone\(true\)/);
    expect(complete![1]).toMatch(/setHandoffBlocked\(true\)/);
  });
});

/* ── Skip: keyboard, pointer, and the target it presents ──────────────────── */

describe("the Skip control", () => {
  it("is a real button in CanvasMount, labelled, that requests the skip", () => {
    const source = mount();
    expect(source).toMatch(/className=\{styles\.skipIntro\}/);
    expect(source).toMatch(/aria-label="Skip intro"/);
    expect(source).toMatch(/introControlsRef\.current\.skipRequested = true/);
  });

  it("Escape requests the same skip and marks the session seen", () => {
    const source = mount();
    const handler = source.match(/if \(event\.key === 'Escape'\) \{([\s\S]*?)\n      \}/);
    expect(handler, "the Escape branch is gone — the intro would trap the keyboard").not.toBeNull();
    expect(handler![1]).toMatch(/event\.preventDefault\(\)/);
    expect(handler![1]).toMatch(/markIntroSeen\(\)/);
    expect(handler![1]).toMatch(/introControlsRef\.current\.skipRequested = true/);
  });

  it("a repeated tap cannot reach the control or anything under it", () => {
    /* The first tap sets `data-skipping`, which takes the control out of the
       hit test for the whole 2.8s outro. Nothing underneath is reachable
       either: the entrance layer is opaque and its content is pointer-inert. */
    expect(css()).toMatch(
      /\.skipIntro\[data-skipping\][\s\S]{0,140}?pointer-events: none/,
    );
    expect(css()).toMatch(
      /\.root\[data-intro-only\] \.navContent \{[\s\S]{0,120}?pointer-events: none/,
    );
    /* And the request is idempotent by construction: it sets a flag the frame
       loop clears, so a second one seeks forward from wherever the first left
       the clock. It cannot rewind or re-arm the handoff. */
    expect(mount()).not.toMatch(/skipRequested\s*=\s*!/);
  });

  it("keeps a 44px touch target and safe-area spacing at every viewport", () => {
    const source = css();
    /* The base rule and the entrance override are the only two that set the
       control's height, and neither may go under the 44px floor. */
    expect(source).toMatch(/\.skipIntro \{[\s\S]*?min-height: 52px/);
    expect(source).toMatch(
      /\.root\[data-intro-only\] \.skipIntro \{[\s\S]{0,200}?min-height: var\(--control-h\)/,
    );
    /* `--control-h` is the token that floor lives in: 2.75rem = 44px. If it
       is ever retuned below that, this fails here rather than on a phone. */
    const tokens = read("app/globals.css");
    const controlH = tokens.match(/--control-h:\s*([\d.]+)rem;/);
    expect(controlH).not.toBeNull();
    expect(Number(controlH![1]) * 16).toBeGreaterThanOrEqual(44);

    /* Positioned out of the notch and the home indicator, not merely out of
       the viewport corner. The `@media (max-width: 480px)` block narrows the
       rule and the gap; it does not touch either inset. */
    expect(source).toMatch(/\.skipIntro \{[\s\S]*?right: calc\(.*\+ var\(--safe-right\)\);/);
    expect(source).toMatch(/\.skipIntro \{[\s\S]*?bottom: calc\(.*\+ var\(--safe-bottom\)\);/);
  });

  it("has a visible :focus-visible ring in both of its skins", () => {
    const source = css();
    const rings = source.match(/\.skipIntro:focus-visible \{[\s\S]{0,120}?outline: var\(--focus-outline\)/g);
    expect(rings, "the Skip control lost its focus ring").not.toBeNull();
    /* One on the base control, one on the entrance override — the second
        wins the cascade, so the first alone would not be enough. */
    expect(rings!.length).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(/\.skipIntro:focus-visible \{[\s\S]{0,160}?outline-offset: var\(--focus-offset\)/);
  });
});

/* ── The handoff guard ────────────────────────────────────────────────────── */

describe("the stale-gesture guard", () => {
  it("mirrors the CSS transition it is a bound on", () => {
    /* The two used to disagree by 200ms, which is 200ms in which the
       navigation looks ready and eats every touch. They are pinned to each
       other rather than to the number 700. */
    const guard = mount().match(/const HANDOFF_INPUT_GUARD_MS = (\d+);/);
    expect(guard).not.toBeNull();
    const transition = css().match(/\.navContent \{[\s\S]*?transition: opacity (\d+)ms ease/);
    expect(transition, ".navContent no longer declares the opacity transition").not.toBeNull();
    expect(Number(guard![1])).toBe(Number(transition![1]));
  });

  it("listens on the window, not on the entrance container", () => {
    /**
     * The links this guard protects are not inside `CanvasMount`. On the home
     * route its `children` is the poster; `CinematicIntroGate` renders the
     * page into `.introDestination`, a *sibling* of the container. A
     * container-scoped listener covered only the eight orbit links, which are
     * `display: none` below 720px — so on the device the whole guard exists
     * for, it was attached to elements that cannot be tapped.
     */
    const source = mount();
    expect(source).toMatch(/window\.addEventListener\('click', swallowStaleClick, true\)/);
    expect(source).toMatch(/window\.removeEventListener\('click', swallowStaleClick, true\)/);
    expect(source).not.toMatch(/container\.addEventListener\('click'/);
    /* The gesture start is recorded in capture, so an inert target still
       registers one. */
    for (const event of ["pointerdown", "touchstart", "keydown"]) {
      expect(source).toMatch(
        new RegExp(`window\\.addEventListener\\('${event}', startGesture, true\\)`),
      );
    }
  });

  it("blocks the destination through the guarded window, then releases it", () => {
    const source = gate();
    /* `blocked` comes from `NavClient`'s `onIntroBlockingChange`, which stays
       true through `handoffBlocked` — the guard window — and only then
       clears. */
    expect(source).toMatch(/onIntroBlockingChange=\{handleBlockingChange\}/);
    expect(source).toMatch(/inert=\{inertDestination \|\| undefined\}/);
    expect(source).toMatch(/aria-hidden=\{inertDestination \|\| undefined\}/);
    expect(mount()).toMatch(
      /const introBlocking = Boolean\(([\s\S]*?)\);/,
    );
    const blocking = mount().match(/const introBlocking = Boolean\(([\s\S]*?)\);/)![1];
    expect(blocking).toMatch(/introRunning/);
    expect(blocking).toMatch(/handoffBlocked/);
  });
});

/* ── Three.js stays off the server ────────────────────────────────────────── */

describe("the renderer cannot block server HTML", () => {
  it("imports the scene dynamically with SSR off", () => {
    expect(mount()).toMatch(
      /const Scene = dynamic\(\(\) => import\('\.\/Scene'\), \{ ssr: false \}\)/,
    );
  });

  it("no server component reaches three.js", () => {
    /* `Scene.tsx` is the only module that imports the renderer, it is a client
       component, and the one file that mounts it does so through `next/dynamic`
       with `ssr: false`. So the three.js bytes are not in the server HTML and
       not on the LCP path. */
    const scene = read("components/particle-nav/Scene.tsx");
    expect(scene).toMatch(/^'use client';/);
    expect(scene).toMatch(/from 'three\/webgpu'/);
    expect(mount()).toMatch(/^'use client';/);
    /* Nothing imports `Scene` statically. */
    expect(mount()).not.toMatch(/^import .*from '\.\/Scene'/m);
  });
});

/* ── The narrative, and what survives with nothing running ────────────────── */

describe("the narrative is available to assistive technology", () => {
  it("renders the story as a semantic article whenever the entrance owns the screen", () => {
    const source = mount();
    /* Gated on `introRunning` — the entrance being on screen — and on nothing
       about the GPU beyond that. In particular NOT on `canvasLive`,
       `showCanvas` or `hasLiveBackend`: a renderer that fails to paint must
       not also silently remove the text it was going to narrate. */
    const article = source.match(
      /\{introRunning \? \($([\s\S]*?)<article([\s\S]*?)<\/article>/m,
    );
    expect(article, "the narrative article is no longer inside the introRunning branch")
      .not.toBeNull();
    expect(article![2]).toMatch(/STORY_PARAGRAPHS\.map/);
    expect(source).toMatch(/<article className=\{styles\.srOnly\} aria-label="[^"]+"/);
    /* The window between the two: `canvasLive` gates the canvas wrapper and
       the Skip control's opacity, never the article. */
    const articleAt = source.indexOf("<article");
    const branchAt = source.lastIndexOf("{introRunning ? (", articleAt);
    expect(source.slice(branchAt, articleAt)).not.toMatch(/canvasLive|showCanvas|hasLiveBackend/);
  });

  it("keeps the decorative layers out of the accessibility tree", () => {
    const source = mount();
    expect(source).toMatch(/className=\{styles\.introOverlay\} aria-hidden="true"/);
    expect(source).toMatch(/\$\{canvasLive \? styles\.canvasLive : ''\}`\}\s*\n\s*aria-hidden="true"/);
  });
});

/* ── No JavaScript ────────────────────────────────────────────────────────── */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

describe("the no-JavaScript home", () => {
  /**
   * The measured bug: `blocked` starts `true`, so the server document shipped
   * `<div class="introDestination" inert aria-hidden="true">` around the whole
   * page. `inert` has no CSS counterpart — the `<noscript>` rule next to it
   * can hide the entrance layer but cannot lift an attribute — so with
   * scripting off the home page was permanently unclickable and permanently
   * absent from the accessibility tree.
   */
  it("ships the destination live: no inert, no aria-hidden", async () => {
    const { CinematicIntroGate } = await import(
      "@/components/particle-nav/CinematicIntroGate"
    );
    const html = renderToStaticMarkup(
      h(
        CinematicIntroGate,
        null,
        h(
          "main",
          null,
          h("h1", null, "LIONSOFZION"),
          h("a", { href: "/geopolitical-brief" }, "Read the Daily Brief"),
        ),
      ),
    );

    const destination = html.slice(html.lastIndexOf("<div class=\"_introDestination"));
    const openTag = destination.slice(0, destination.indexOf(">") + 1);
    expect(openTag, "the no-JS home is inert with nothing that can ever lift it")
      .not.toMatch(/\binert\b/);
    expect(openTag, "the no-JS home is hidden from assistive technology")
      .not.toMatch(/aria-hidden/);

    /* And what it wraps is the real page: heading and working href. */
    expect(destination).toContain("<h1>LIONSOFZION</h1>");
    expect(destination).toContain('href="/geopolitical-brief"');
  });

  it("hides the entrance layer entirely when scripting is off", () => {
    /* The layer is `position: fixed; inset: 0` on black at z-index 1000. With
       no JavaScript it would never fade out, so it is removed from the flow
       by the one mechanism that works without one. */
    expect(gate()).toMatch(
      /<noscript>[\s\S]{0,160}?\[data-intro-only\] \{ display: none !important; \}/,
    );
    expect(css()).toMatch(/\.root\[data-intro-only\] \{[\s\S]{0,120}?position: fixed/);
  });

  it("leaves a painted ground and a poster behind the entrance", () => {
    /* Not a blank canvas frame: `.root` is opaque and the poster is a real
       `<picture>` in the server HTML, hidden only once a backend exists. */
    expect(css()).toMatch(/\.root \{[\s\S]*?background: #000000/);
    expect(gate()).toMatch(/\/posters\/particle-nav\.avif/);
    expect(gate()).toMatch(/\/posters\/particle-nav\.webp/);
    expect(css()).toMatch(
      /\.root\[data-canvas\] \.poster,\s*\n\s*\.root\[data-live\] \.poster \{[\s\S]{0,60}?opacity: 0/,
    );
  });
});
