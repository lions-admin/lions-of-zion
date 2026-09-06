/**
 * The shared scan backdrop as a public-site layer.
 *
 * Planned in `fixhomeTODO.md` Phase E; that document was deleted 2026-09-05
 * with the particle entrance, and this file is now the contract.
 *
 * Three things are pinned: the profile map answers the same way for every
 * member of a route family and `silent` for the operator routes; the
 * backdrop component clamps and emits its controls as attributes rather than
 * animating anything through React; and the stylesheet keeps the properties
 * that make the layer decorative — inert to the pointer, a reduced-motion
 * result, no ambient loop under the five-second floor.
 *
 * The component is rendered as a plain async function and then serialised
 * with `renderToStaticMarkup`: it is a server component with no client
 * children, so the element tree it resolves to is synchronous.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScanBackdrop } from "@/components/sections/ScanBackdrop";
import {
  FAMILY_SCAN_PROFILES,
  HOME_SCAN_PROFILE,
  INTERNAL_ROUTE_IDS,
  SILENT_SCAN_PROFILE,
  clampScanIntensity,
  isInternalRoute,
  scanProfileForRoute,
} from "@/components/sections/scanProfiles";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

async function markup(props: Parameters<typeof ScanBackdrop>[0]): Promise<string> {
  const element = await ScanBackdrop(props);
  return element === null ? "" : renderToStaticMarkup(element);
}

describe("scan profiles — one map per route family", () => {
  it("answers the desk profile for every desk route", () => {
    for (const id of ["geopolitical-brief", "updates", "fact-check", "search", "ask", "war-update"]) {
      expect(scanProfileForRoute(id), id).toBe(FAMILY_SCAN_PROFILES.desk);
    }
    expect(FAMILY_SCAN_PROFILES.desk).toMatchObject({ density: "medium", speed: "normal" });
    expect(FAMILY_SCAN_PROFILES.desk.intensity).toBeGreaterThanOrEqual(0.4);
    expect(FAMILY_SCAN_PROFILES.desk.intensity).toBeLessThanOrEqual(0.7);
  });

  it("answers the dossier profile for investigations, the archive and articles", () => {
    for (const id of ["fake-resistance", "october-7", "articles", "israels-story", "our-heroes"]) {
      expect(scanProfileForRoute(id), id).toBe(FAMILY_SCAN_PROFILES.dossier);
    }
    expect(FAMILY_SCAN_PROFILES.dossier).toMatchObject({ density: "medium", speed: "slow" });
    expect(FAMILY_SCAN_PROFILES.dossier.intensity).toBeLessThan(FAMILY_SCAN_PROFILES.desk.intensity);
  });

  it("answers the institution profile, quieter than both", () => {
    for (const id of ["methodology", "corrections", "we-are", "support-us", "account"]) {
      expect(scanProfileForRoute(id), id).toBe(FAMILY_SCAN_PROFILES.institution);
    }
    expect(FAMILY_SCAN_PROFILES.institution.density).toBe("low");
    expect(["slow", "still"]).toContain(FAMILY_SCAN_PROFILES.institution.speed);
    expect(FAMILY_SCAN_PROFILES.institution.intensity).toBeLessThan(
      FAMILY_SCAN_PROFILES.dossier.intensity,
    );
  });

  it("gives the home its own low, slow band profile", () => {
    expect(scanProfileForRoute("home")).toBe(HOME_SCAN_PROFILE);
    expect(HOME_SCAN_PROFILE.speed).toBe("slow");
    expect(HOME_SCAN_PROFILE.intensity).toBeLessThanOrEqual(FAMILY_SCAN_PROFILES.dossier.intensity);
  });

  it("keeps the three internal routes explicitly silent", () => {
    expect([...INTERNAL_ROUTE_IDS]).toEqual(["admin", "admin/login", "pipeline"]);
    for (const id of INTERNAL_ROUTE_IDS) {
      expect(isInternalRoute(id), id).toBe(true);
      expect(scanProfileForRoute(id), id).toBe(SILENT_SCAN_PROFILE);
    }
    expect(SILENT_SCAN_PROFILE.register).toBe("silent");
    expect(isInternalRoute("updates")).toBe(false);
  });

  it("clamps intensity into 0..1 and treats a missing value as full", () => {
    expect(clampScanIntensity(undefined)).toBe(1);
    expect(clampScanIntensity(Number.NaN)).toBe(1);
    expect(clampScanIntensity(-3)).toBe(0);
    expect(clampScanIntensity(7)).toBe(1);
    expect(clampScanIntensity(0.35)).toBe(0.35);
  });
});

describe("ScanBackdrop — controls become attributes, not renders", () => {
  it("emits density, speed, register and the clamped intensity on its root", async () => {
    const html = await markup({ routeId: "updates", intensity: 7, density: "low", speed: "slow" });
    expect(html).toMatch(/^<div [^>]*aria-hidden="true"/);
    expect(html).toContain('data-density="low"');
    expect(html).toContain('data-speed="slow"');
    expect(html).toContain('data-register="default"');
    expect(html).toContain("--scan-intensity:1.000");

    const low = await markup({ routeId: "updates", intensity: -1 });
    expect(low).toContain("--scan-intensity:0.000");
    expect(low).toContain('data-density="high"');
    expect(low).toContain('data-speed="normal"');
  });

  it("keeps the existing register/seed contract: silent renders nothing, seed picks the slice", async () => {
    expect(await markup({ routeId: "october-7", register: "silent" })).toBe("");
    const a = await markup({ routeId: "october-7", seed: "record-a" });
    const b = await markup({ routeId: "october-7", seed: "record-b" });
    expect(a).not.toBe(b);
    expect(a).toBe(await markup({ routeId: "october-7", seed: "record-a" }));
    /* Density is a stylesheet subset, not a resample: the rows are the same. */
    const dense = await markup({ routeId: "we-are", density: "high" });
    const sparse = await markup({ routeId: "we-are", density: "low" });
    expect(dense.replace('data-density="high"', "")).toBe(sparse.replace('data-density="low"', ""));
  });

  it("gives every row a sampled duration at or above the ambient floor", async () => {
    const html = await markup({ routeId: "fake-resistance" });
    const durations = [...html.matchAll(/--dur:([\d.]+)s/g)].map(([, s]) => Number(s));
    expect(durations.length).toBe(16);
    for (const seconds of durations) expect(seconds).toBeGreaterThanOrEqual(45);
    expect((await markup({ routeId: "articles", register: "muted" })).match(/--dur:/g)?.length).toBe(9);
  });
});

describe("sections.module.css — the layer stays decorative", () => {
  const css = read("components/sections/sections.module.css");
  const backdropRule = css.slice(css.indexOf(".backdrop {"), css.indexOf(".backdrop[data-speed"));

  it("is inert to the pointer and clipped", () => {
    expect(backdropRule).toMatch(/pointer-events:\s*none/);
    expect(backdropRule).toMatch(/overflow:\s*hidden/);
  });

  it("reads the three controls from the root", () => {
    expect(css).toMatch(/--scan-intensity/);
    expect(css).toMatch(/\.backdrop\[data-density="medium"\]/);
    expect(css).toMatch(/\.backdrop\[data-density="low"\]/);
    expect(css).toMatch(/\.backdrop\[data-speed="slow"\]/);
    expect(css).toMatch(/\.backdrop\[data-speed="still"\] \.row \{\s*animation:\s*none/);
  });

  it("composes a stationary frame under reduced motion and under `still`", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.row \{\s*animation:\s*none;[\s\S]*?--rest/);
    /* The loud rows step back: no bright fragment left wherever the clock stopped. */
    expect(reduced).toMatch(/\.rowLoud\.rowHostile \{ color: var\(--data-ember-dim\); \}/);
    expect(css).toMatch(/\.backdrop\[data-speed="still"\] \.rowLoud\.rowHostile \{ color: var\(--data-ember-dim\); \}/);
  });

  it("has no ambient loop faster than the five-second floor", () => {
    for (const [, seconds] of css.matchAll(/animation:[^;]*?\b([\d.]+)s\b[^;]*?\binfinite\b/g)) {
      expect(Number(seconds)).toBeGreaterThanOrEqual(5);
    }
    /* The drift duration is the sampled `--dur` (45s+) times multipliers ≥ 1. */
    expect(css).toMatch(/--drift:\s*calc\(var\(--dur\) \* var\(--scan-speed, 1\) \* var\(--scan-tempo, 1\)\)/);
    expect(css).not.toMatch(/--scan-speed:\s*0?\.\d/);
  });

  it("no longer carries the family numbers the profile map owns", () => {
    expect(css).not.toMatch(/\.page\[data-family="[a-z]+"\] \.row/);
  });
});

describe("route coverage — one shared backdrop per public route, none on the internal four", () => {
  it("EditorialShell passes the route's profile to the shared backdrop", () => {
    const shell = read("components/site/EditorialShell.tsx");
    expect(shell).toContain("scanProfileForRoute(routeId)");
    expect(shell).toMatch(/<ScanBackdrop[\s\S]*?intensity=\{scan\.intensity\}[\s\S]*?density=\{scan\.density\}[\s\S]*?speed=\{scan\.speed\}/);
    expect(shell.match(/<ScanBackdrop/g)?.length).toBe(1);
  });

  it("the home mounts no moving backdrop at all: its field is a video", () => {
    const page = read("app/page.tsx");
    /* Zero instances, where there were two and then one.
     *
     * The band docked under the typographic field went with the field itself
     * when this hero became a photographic shot: a scan of drifting rows over
     * a lion is two moving layers competing, which is the thing the docking
     * rules existed to prevent in the first place. The entrance's own
     * instance went with the entrance on 2026-09-05, when the particle gate
     * was replaced by a text introduction that composes over the route's own
     * ground rather than a second graphics engine's.
     *
     * That the count is asserted at all is the point: a `<ScanBackdrop>`
     * reappearing on this page means someone has put a moving scan back under
     * the video without deciding which of the two owns the screen. */
    expect(page).not.toContain("ScanBackdrop");
    expect(page).not.toContain("CinematicIntroGate");
    expect(page).not.toMatch(/surface="band"/);
    expect(page).not.toMatch(/data-home-scan/);

    /* And the layer it was docked in is a video layer now: poster under, the
       two cross-fading elements over it, scrim, then the graded fall-off —
       stacked by source order alone (poster, then `<HeroVideo>`, then the
       scrim), with no z-index ladder to keep in sync as of 2026-09-06. */
    const home = read("app/home.module.css");
    expect(page).toMatch(/<div className=\{styles\.posterField\} \/>[\s\S]*?<HeroVideo[\s\S]*?<div className=\{styles\.heroScrim\} \/>/);
    for (const selector of [".posterField", ".heroVideo", ".heroScrim"]) {
      expect(home, selector).not.toMatch(new RegExp(`\\${selector} \\{[^}]*z-index`));
    }
    expect(home).not.toMatch(/\.scanDock/);
  });

  it("the reading shells all reach EditorialShell rather than mounting their own", () => {
    for (const file of [
      "components/sections/SectionPage.tsx",
      "components/sections/DocPage.tsx",
      "components/briefs/LiveBriefHub.tsx",
      "components/briefs/InformationWarSystem.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toContain("<EditorialShell");
      expect(source, file).not.toContain("<ScanBackdrop");
    }
  });

  it("the root layout mounts no backdrop, so nothing reaches the internal routes by inheritance", () => {
    expect(read("app/layout.tsx")).not.toMatch(/ScanBackdrop|EditorialShell/);
  });

  it("the three internal routes mount no moving backdrop", () => {
    for (const file of [
      "app/admin/page.tsx",
      "app/admin/login/page.tsx",
      "app/pipeline/page.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/ScanBackdrop|EditorialShell|SectionPage|DocPage/);
    }
  });
});
