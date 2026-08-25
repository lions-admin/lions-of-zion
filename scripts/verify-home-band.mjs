/**
 * Home front-page band verification — real Chrome, macOS workstation only.
 *
 * Same constraint as `final-verify.mjs` and `verify-composition.mjs`: the
 * in-app browser reports `visibilityState === "hidden"` and returns zeroed
 * rects, and headless Chromium falls back to SwiftShader, which the GPU probe
 * correctly rejects. Neither can measure this page.
 *
 * What it asserts, per viewport:
 *   - the scene keeps the exact viewport box it always had (the "matrix is
 *     untouched" gate — any drift here means the composition moved);
 *   - the document scrolls, and the band is reachable;
 *   - the band is opaque over the fixed scene once scrolled;
 *   - all eight file links are present with their descriptions visible;
 *   - the scroll lock holds while the intro is running.
 *
 * Usage: node scripts/verify-home-band.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/lions-home-band";

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1254x1254", width: 1254, height: 1254 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  { name: "320x568", width: 320, height: 568 },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: false });
let failed = false;

const fail = (label, detail) => {
  failed = true;
  console.error(`  FAIL  ${label} — ${detail}`);
};

/* Reduced motion skips the intro, so the band is reachable immediately. The
   intro's own lock is checked separately below. */
for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e}`));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const top = await page.evaluate(() => {
    const scene = document.querySelector("main > div");
    const band = document.querySelector("[data-home-scroll]");
    const root = document.documentElement;
    return {
      scene: scene?.getBoundingClientRect().toJSON() ?? null,
      scenePosition: scene ? getComputedStyle(scene).position : null,
      bandTop: band?.getBoundingClientRect().top ?? null,
      docHeight: root.scrollHeight,
      viewportH: innerHeight,
      h1Count: document.querySelectorAll("h1").length,
      h1: document.querySelector("h1")?.textContent ?? null,
      fileLinks: [...document.querySelectorAll("[data-home-scroll] nav a")].length,
      describedLinks: [...document.querySelectorAll("[data-home-scroll] nav a")].filter(
        (a) => (a.textContent ?? "").trim().length > 40,
      ).length,
      /* The strip rides in the orbit's own bottom margin. If it ever covers a
         node, the fix is to shrink the strip — never the orbit. */
      stripTop: document
        .querySelector("[data-home-scroll] > div")
        ?.getBoundingClientRect().top ?? null,
      nodes: [...document.querySelectorAll("a[data-node-index]")].map((a) => {
        const r = a.getBoundingClientRect();
        return { index: a.dataset.nodeIndex, bottom: r.bottom, top: r.top };
      }),
    };
  });

  console.log(`\n${viewport.name}`);

  // 1. The scene's box is the viewport, unchanged.
  if (top.scenePosition !== "fixed") fail("scene position", `got ${top.scenePosition}`);
  const s = top.scene;
  if (!s || s.width !== viewport.width || s.height !== viewport.height || s.top !== 0 || s.left !== 0) {
    fail("scene box", `expected 0,0 ${viewport.width}x${viewport.height}, got ${JSON.stringify(s)}`);
  } else {
    console.log(`  ok    scene box ${s.width}x${s.height} at 0,0`);
  }

  // 2. The document scrolls past the hero.
  if (top.docHeight <= top.viewportH) {
    fail("document scroll", `scrollHeight ${top.docHeight} <= viewport ${top.viewportH}`);
  } else {
    console.log(`  ok    document scrolls (${top.docHeight}px over ${top.viewportH}px)`);
  }

  // 3. One h1, and it is the site identity.
  if (top.h1Count !== 1) fail("h1 count", `expected 1, got ${top.h1Count}`);
  else console.log(`  ok    single h1 "${top.h1}"`);

  // 4. Eight files, each carrying a real description (the hover-only fix).
  if (top.fileLinks !== 8) fail("file links", `expected 8, got ${top.fileLinks}`);
  else if (top.describedLinks !== 8) {
    fail("file descriptions", `only ${top.describedLinks}/8 links carry a description`);
  } else console.log("  ok    8 file links, all with visible descriptions");

  // 5. The strip does not cover an orbit node.
  if (top.stripTop === null || top.nodes.length !== 8) {
    fail("strip vs orbit", `strip ${top.stripTop}, ${top.nodes.length} nodes found`);
  } else {
    const covered = top.nodes.filter((n) => n.bottom > top.stripTop + 0.5);
    if (covered.length) {
      const worst = covered.reduce((a, b) => (a.bottom > b.bottom ? a : b));
      fail(
        "strip vs orbit",
        `node ${worst.index} reaches ${worst.bottom.toFixed(1)}px, strip starts at ` +
          `${top.stripTop.toFixed(1)}px — shrink the strip, never the orbit`,
      );
    } else {
      const lowest = top.nodes.reduce((a, b) => (a.bottom > b.bottom ? a : b));
      console.log(
        `  ok    strip clears the orbit by ${(top.stripTop - lowest.bottom).toFixed(1)}px`,
      );
    }
  }

  await page.screenshot({ path: `${OUT}/${viewport.name}-top.png` });

  // 5. Scrolled: the band covers the fixed scene rather than letting it show.
  await page.evaluate(() => {
    const band = document.querySelector("[data-home-scroll]");
    band?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(600);

  const scrolled = await page.evaluate(() => {
    const band = document.querySelector("[data-home-scroll]");
    const rect = band.getBoundingClientRect();
    /* Sample a point inside the band, below its strip, and confirm the band
       (not the canvas behind it) is what the pointer would land on. */
    const probeY = Math.min(innerHeight - 4, Math.max(0, rect.top) + 140);
    const hit = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(probeY));
    return {
      scrollY: Math.round(scrollY),
      bandTop: Math.round(rect.top),
      background: getComputedStyle(band).backgroundColor,
      hitInsideBand: Boolean(hit && band.contains(hit)),
      hitTag: hit?.tagName ?? null,
    };
  });

  if (scrolled.scrollY <= 0) fail("scrolled", `scrollY stayed at ${scrolled.scrollY}`);
  if (!scrolled.hitInsideBand) {
    fail("band opacity", `point inside the band resolved to <${scrolled.hitTag}> outside it`);
  } else {
    console.log(`  ok    band is opaque at scrollY ${scrolled.scrollY} (${scrolled.background})`);
  }

  await page.screenshot({ path: `${OUT}/${viewport.name}-band.png` });

  if (consoleErrors.length) fail("console", consoleErrors.join(" | "));
  else console.log("  ok    no console errors");

  await context.close();
}

/* The intro must hold the lock: a 47-second cinematic that scrolls away is
   broken, and this is the rule the `:has()` specificity fix exists for. */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const intro = await page.evaluate(async () => {
    const before = {
      introRunning: Boolean(
        document.querySelector("[data-intro-active], [data-intro-pending]"),
      ),
      overflow: getComputedStyle(document.documentElement).overflowY,
      bandVisibility: getComputedStyle(
        document.querySelector("[data-home-scroll]"),
      ).visibility,
    };
    window.scrollTo(0, 4000);
    await new Promise((r) => setTimeout(r, 200));
    return { ...before, scrollYAfterAttempt: Math.round(scrollY) };
  });

  console.log("\nintro lock (1440x900, motion allowed)");
  if (!intro.introRunning) {
    console.log("  skip  intro was not running (already seen this session?)");
  } else {
    if (intro.overflow !== "hidden") fail("intro lock", `html overflow-y is ${intro.overflow}`);
    else console.log("  ok    html locked during the intro");
    if (intro.scrollYAfterAttempt !== 0) {
      fail("intro scroll", `page scrolled to ${intro.scrollYAfterAttempt} during the intro`);
    } else console.log("  ok    scroll attempt refused during the intro");
    if (intro.bandVisibility !== "hidden") {
      fail("intro band", `band visibility is ${intro.bandVisibility}, expected hidden`);
    } else console.log("  ok    band hidden and out of the tab order");
  }

  await page.screenshot({ path: `${OUT}/intro-lock.png` });
  await context.close();
}

await browser.close();
console.log(failed ? "\nFAILED" : "\nAll home-band checks passed");
process.exit(failed ? 1 : 0);
