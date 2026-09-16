import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialIntro, INTRO_BEATS } from "@/components/home/EditorialIntro";

describe("direct-entry cinematic home", () => {
  it("uses the text introduction instead of a second graphics engine", () => {
    const page = readFileSync("app/page.tsx", "utf8");
    expect(page).not.toContain("CinematicIntroGate");
    expect(page).not.toContain("ScanBackdrop");
    expect(page).not.toContain("CinematicHomeMedia");
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

  it("builds the cover from layers in server HTML, with no video and no script behind them", () => {
    /* The cover is the layered lion since 2026-09-16 (decision 1 of the
       round): two `<picture>` layers over a flat CSS-painted ground, inside a
       held screen the stylesheet pins for the runway. Every part of it is in
       the server HTML — the wordmark, the standfirst, today's lead, the
       layers — so a reader without JavaScript, with stillness asked for, or
       on an engine without scroll timelines gets the same page at rest. The
       one client component on the cover is the reader's own pause. */
    const page = readFileSync("app/page.tsx", "utf8");
    expect(page).not.toContain("HeroVideo");
    expect(page).not.toContain("<video");
    expect(page).toContain("<div className={styles.posterField} />");
    expect(page.indexOf('<CoverLayer name="haze" className={styles.lionHaze} />')).toBeGreaterThan(0);
    expect(page.indexOf('<CoverLayer name="haze" className={styles.lionHaze} />')).toBeLessThan(
      page.indexOf('<CoverLayer name="core" className={styles.lionCore} priority />'),
    );
    expect(page).toContain("<MotionControl />");
    expect(page).toContain("<SignalMark className={styles.coverSignal} />");
    /* Only the core layer is preloaded, and only the cut this viewport
       draws — never both, never the haze. */
    expect(page.match(/rel="preload"/g)).toHaveLength(2);
    expect(page).toMatch(/href="\/brand\/cover\/lion-core-800\.avif"[\s\S]{0,80}media=\{PHONE_CUT\}/);
    expect(page).toMatch(/href="\/brand\/cover\/lion-core-1254\.avif"[\s\S]{0,80}media="\(min-width: 48rem\)"/);
    expect(page).not.toContain("lion-haze-1254.avif\"\n      media");
    /* The layer images are decorative and eager: `alt=""`, sized so the
       arrival is a fade and never a reflow, high priority on the core only. */
    expect(page).toMatch(/<img[\s\S]*?alt=""[\s\S]*?decoding="async"[\s\S]*?loading="eager"/);
    expect(page).toContain('fetchPriority={priority ? "high" : "auto"}');
    /* The action is the lead's own verb, from the verb table, pointing at
       the lead itself; the hub is only the fallback. */
    expect(page).toContain('<JourneyLink href={lead.href}>{lead.cta ?? "Read the story"}</JourneyLink>');
    expect(page).not.toContain("Read the latest</JourneyLink>");
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

    /* The ground is the site's own hero still, not the flat black the rest of
       the site left behind, and the veil over it lifts one step per beat. The
       steps are asserted because the arc is the point: drop them and the
       introduction silently goes back to being a black box. */
    expect(css).toContain("background-image: var(--site-ground-photo)");
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
