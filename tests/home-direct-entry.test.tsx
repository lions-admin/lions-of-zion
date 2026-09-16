import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialIntro, INTRO_BEATS } from "@/components/home/EditorialIntro";

describe("direct-entry cinematic home", () => {
  it("uses the keyed still cover instead of a second graphics engine", () => {
    const page = readFileSync("app/page.tsx", "utf8");
    expect(page).not.toContain("CinematicIntroGate");
    expect(page).not.toContain("ScanBackdrop");
    expect(page).not.toContain("CinematicHomeMedia");
    expect(page).not.toContain("<video");
    expect(page).not.toContain("HeroVideo");
    expect(page).toContain("<HomepageJourney edition={edition}/>");
    const system = readFileSync("components/home/HomeSystemSection.tsx", "utf8");
    expect(system).toContain("autoOpen={false}");
    expect(page).not.toContain("SignalRotator");
    expect(page).toContain('href="/geopolitical-brief"');
    /* The how-it-works destination is asserted on the system band, not on the
       cover. It used to be a second link in `app/page.tsx` — a 13px grey
       string with no affordance, beneath the primary action, pointing at the
       same place the system band already points. The cover now carries one
       action, so the literal left `page.tsx`; the destination did not leave
       the homepage, and this asserts the band that renders it. */
    expect(system).toContain('href="/information-war"');
  });

  it("keeps the server-rendered home accessible before JavaScript", () => {
    const html = renderToStaticMarkup(<EditorialIntro />);
    expect(html).toContain("<dialog");
    expect(html).not.toMatch(/<dialog[^>]*\sopen(?:[\s=>])/);
    expect(html).not.toContain("inert");
    expect(html).toContain("Skip intro");
    expect(INTRO_BEATS).toHaveLength(4);
    expect(INTRO_BEATS.map((beat) => `${beat.title} ${beat.body}`).join(" ")).toContain(
      "Its propaganda machinery was already in place.",
    );
  });

  it("keeps the introduction's controls on screen on a short viewport", () => {
    const css = readFileSync("components/home/editorial-intro.module.css", "utf8");

    /* Measured 2026-09-05 at a 500x543 viewport: a fixed `min-height: 23rem`
       on the statement pushed the footer to y=584, putting the progress
       indicator and every control 41px below the fold on all four beats,
       with the dialog overflowing by 126px. The reservation has to yield to
       the viewport, and the middle row has to be able to shrink — a grid item
       will not go below its content without `min-height: 0`. */
    expect(css).toMatch(/\.statement \{ min-height: min\(20rem, 38vh\); \}/);
    expect(css).toMatch(/\.statement \{ min-height: min\(23rem, 40vh\); \}/);
    expect(css).toMatch(/\.stage \{[^}]*min-height: 0/);
    expect(css).toMatch(/\.stage \{[^}]*overflow-y: auto/);
    expect(css).not.toMatch(/\.statement \{ min-height: \d+rem; \}/);

    /* The lock must reserve the gutter it takes away, or the document behind
       a full-screen overlay jumps its scrollbar width on open and on close. */
    expect(css).toMatch(/overflow: hidden;\s*\n\s*scrollbar-gutter: stable;/);

    /* Both labels share one grid cell so a state change cannot resize the
       control or shift the one beside it. */
    expect(css).toMatch(/\.swap > span \{ grid-area: 1 \/ 1; \}/);

    /* The ground is the site's own hero still — re-pointed from the retired
       reading-ground token to the hero poster on 2026-09-16, same asset —
       and the veil over it lifts one step per beat. The steps are asserted
       because the arc is the point: drop them and the introduction silently
       goes back to being a black box. */
    expect(css).toContain("background-image: var(--hero-poster-wide)");
    expect(css).toMatch(/\.ground \{[^}]*opacity: 0\.06/);
    expect(css).toMatch(/\.dialog\[data-beat="1"\] \.ground \{ opacity: 0\.10; \}/);
    expect(css).toMatch(/\.dialog\[data-beat="2"\] \.ground \{ opacity: 0\.14; \}/);
    expect(css).toMatch(/\.dialog\[data-beat="3"\] \.ground \{ opacity: 0\.18; \}/);
    /* The layer is paint only: it must never become a grid item that could
       push the footer off a short viewport the way a fixed reservation did. */
    expect(css).toMatch(/\.ground \{[^}]*position: absolute/);
    expect(css).toMatch(/\.ground \{[^}]*pointer-events: none/);
    const intro = readFileSync("components/home/EditorialIntro.tsx", "utf8");
    expect(intro).toContain('data-shown={!paused}');
    expect(intro).toContain("data-beat={beat}");
    expect(intro).toContain("politeLive");
  });
});

describe("the cover stage (2026-09-16 identity round, stage 5)", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const home = readFileSync("app/home.module.css", "utf8");

  it("paints the four layers in order, keyed lion over flat ground, no video", () => {
    /* Paint order is source order inside the pointer-inert stage: flat
       ground, haze, core, scrim. `ci-smoke.mjs` greps a fragment that
       contains `posterField`; this pins the full order the cinema paints
       in. */
    expect(page).toMatch(
      /<div className=\{styles\.posterField\} \/>[\s\S]*?<picture className=\{styles\.lionHaze\}>[\s\S]*?<picture className=\{styles\.lionCore\}>[\s\S]*?<div className=\{styles\.heroScrim\} \/>/,
    );
    /* The core layer's AVIF is the preloaded LCP image, with the WebP as a
       second preload the AVIF-capable engines skip via `type`. */
    expect(page).toContain('type="image/avif"');
    expect(page).toContain('href="/brand/cover/lion-core-2560.avif"');
    expect(page).toContain('href="/brand/cover/lion-core-1080x1920.avif"');
    expect(page.match(/rel="preload"/g)?.length).toBe(4);
    expect(page.match(/rel="preload" as="image" type="image\/avif"/g)?.length).toBe(2);
    expect(page.match(/rel="preload" as="image" type="image\/webp"/g)?.length).toBe(2);
    expect(page).not.toContain("/video/");
  });

  it("is a sticky stage with a runway only where scroll-driven timelines exist", () => {
    expect(home).toMatch(/\.fieldLayer \{[^}]*position:\s*sticky/);
    expect(home).toMatch(/\.fieldLayer \{[^}]*margin-bottom:\s*-100svh/);
    expect(home).toMatch(/\.hero \{[^}]*--cover-runway:\s*0svh/);
    expect(home).toMatch(/@supports \(animation-timeline: scroll\(\)\) \{[\s\S]*?\.hero \{ --cover-runway: 40svh; \}/);
    expect(home).toMatch(
      /@supports not \(animation-timeline: scroll\(\)\) \{[^}]*\.hero \{ --cover-runway: 0svh; \}/,
    );
    /* The scroll-driven layers animate transform and opacity only, over the
       runway range, and the phone runs the parallax on the core layer only. */
    expect(home).toMatch(/animation-timeline:\s*scroll\(root\)/);
    expect(home).toMatch(/animation-range:\s*0 var\(--cover-runway\)/);
    const supports = home.slice(home.indexOf("@supports (animation-timeline: scroll())"));
    const hazeBlock = supports.slice(supports.indexOf(".lionHaze img"));
    expect(hazeBlock).toMatch(/@media \(min-width: 760px\)/);
  });

  it("arrives once and degrades to a complete static design under stillness", () => {
    /* The arrival is once, ≤ 1.2s, and it is the only animation the stage
       owns: `--dur-arrive` (900ms) on the core picture, the staggered rise
       on the type. */
    expect(home).toMatch(/\.lionCore \{ animation: cover-arrive var\(--dur-arrive\)/);
    expect(home).toMatch(/\.wordmark \{ animation: cover-rise var\(--dur-arrive\)/);
    expect(home).not.toMatch(/infinite/);
    /* Reduced motion and the MotionControl's persisted pause each zero the
       runway and still every layer explicitly — the global kill switch
       switches the timeline off, but a frozen mid-range timeline is not a
       design, so the cover states its own stillness. */
    const reduced = home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.hero \{ --cover-runway: 0svh; \}/);
    expect(reduced).toMatch(/\.lionCore, \.lionHaze, \.lionCore img, \.lionHaze img,[\s\S]{0,120}?animation: none !important/);
    expect(home).toMatch(/html\[data-motion="paused"\] \.hero \{ --cover-runway: 0svh; \}/);
    expect(home).toMatch(/html\[data-motion="paused"\] \.lionCore img,[\s\S]{0,400}?animation: none !important/);
  });

  it("carries the pause control and opens the edition rail with the signal mark", () => {
    expect(page).toContain("<MotionControl className={styles.motionControl} />");
    expect(readFileSync("components/home/MotionControl.tsx", "utf8")).toContain("data-motion");
    expect(page).toContain("<SignalMark className={styles.railMark} />");
    expect(readFileSync("components/brand/SignalMark.tsx", "utf8")).toContain("--signal-rule-w");
  });
});
