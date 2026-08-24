/**
 * Stage 0 / Stage 1 / navigation verification, in a real browser.
 *
 * `tests/composition-fit.test.ts` proves the cover fit is correct as
 * mathematics. This proves the scene actually uses it: it loads the page at
 * each aspect in the task document's matrix, waits for the reveal, and reports
 * how much of the frame the lion plane occupies together with a screenshot.
 *
 * A caveat that matters, and is the reason this is a separate script rather
 * than a test: in a container this runs on SwiftShader, so the frame rate is
 * not representative of anything. Geometry, framing and layout are — which is
 * exactly what Stage 0 is about. Timing and performance still need real Chrome
 * on real hardware, as CLAUDE.md says.
 *
 *   node scripts/verify-composition.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

/* `localhost`, not `127.0.0.1`: Next's dev server treats the numeric host as
   a cross-origin dev request and answers every chunk with a 403. */
const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/composition";

/** The aspects the previous fit provably failed at, plus the ones it passed. */
const MATRIX = [
  { name: "0.46-phone-portrait", width: 390, height: 844 },
  { name: "0.75-tablet-portrait", width: 768, height: 1024 },
  { name: "1.00-square", width: 900, height: 900 },
  { name: "1.33-tablet-landscape", width: 1024, height: 768 },
  { name: "1.78-design-aspect", width: 1600, height: 900 },
  { name: "2.33-ultrawide", width: 2560, height: 1097 },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [
    /* The target is a local dev server; an ambient HTTP proxy would answer
       every asset request with a 403. */
    "--no-proxy-server",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

await mkdir(OUT, { recursive: true });
let failures = 0;

for (const size of MATRIX) {
  /* Reduced motion so the intro never mounts and the homepage reveal is over
     in ~1.5s. The framing under test does not depend on either. */
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "load" });

  /* On a software rasteriser the scene runs at a few frames a second, and the
     animation clock advances per frame rather than per wall-clock second — so
     wait for frames, not for time. 90 frames covers the reveal. */
  await page
    .waitForFunction(() => (window.__lionFrames ?? 0) > 90, null, {
      timeout: 90_000,
      polling: 500,
    })
    .catch(() => {});

  const report = await page.evaluate(() => {
    const w = window;
    return {
      aspect: w.innerWidth / w.innerHeight,
      fit: w.__lionFit ?? null,
      rafAlive: w.__lionFrames ?? null,
      visibility: document.visibilityState,
    };
  });

  await page.screenshot({ path: `${OUT}/${size.name}.png` });

  /* --- the navigation, through its states --- */
  const nodes = page.locator("nav[aria-label='Sections'] button");
  const nodeCount = await nodes.count();

  if (nodeCount > 0) {
    await nodes.nth(1).hover();
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${size.name}--hover.png` });

    await nodes.nth(1).click({ timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${size.name}--transfer.png` });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/${size.name}--active.png` });

    // A second section, so the transfer runs node-to-node rather than from
    // nothing, which is the case GRAPHIC 08 is actually about.
    // A node on the far side of the ring, so the transfer is node-to-node —
    // the case GRAPHIC 08 is actually about — and so a panel that has covered
    // a node it should have made room for fails here rather than in review.
    await nodes.nth(5).click({ timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${size.name}--switch.png` });
    await page.waitForTimeout(2200);
  }

  /* Keyboard: focus the first node and walk the ring. */
  const keyboard = await page.evaluate(async () => {
    const buttons = Array.from(
      document.querySelectorAll("nav[aria-label='Sections'] button"),
    );
    if (buttons.length === 0) return { count: 0, moved: false, labelled: false };
    buttons[0].focus();
    const first = document.activeElement;
    buttons[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 50));
    return {
      count: buttons.length,
      moved: document.activeElement !== first,
      labelled: buttons.every((b) => (b.textContent ?? "").trim().length > 0),
    };
  });

  const fit = report.fit;
  let verdict = "no fit reported";
  if (fit) {
    const covers = fit.marginX >= -1e-6 && fit.marginY >= -1e-6;
    verdict = covers ? "covered" : "*** NOT COVERED ***";
    if (!covers) failures += 1;
  } else {
    failures += 1;
  }

  const navOk =
    keyboard.count === 8 && keyboard.moved && keyboard.labelled;
  if (!navOk) failures += 1;
  if (errors.length) failures += 1;

  console.log(
    `${size.name.padEnd(24)} aspect=${report.aspect.toFixed(3)} ` +
      `scale=${fit ? fit.planeScale.toFixed(3) : "?"} ` +
      `offsetY=${fit ? fit.planeOffsetY.toFixed(3) : "?"} ` +
      `marginX=${fit ? fit.marginX.toFixed(3) : "?"} ` +
      `marginY=${fit ? fit.marginY.toFixed(3) : "?"} ` +
      `frames=${report.rafAlive ?? "?"} ` +
      `nav=${keyboard.count}/8 keys=${keyboard.moved ? "ok" : "DEAD"} ${verdict}` +
      (errors.length ? `\n    errors: ${errors.slice(0, 3).join(" | ")}` : ""),
  );

  await page.close();
}

/* --------------------------------------------------------------------- *
 * The two paths the matrix above cannot cover.
 *
 * Every page in the matrix runs with reduced motion, which is what makes it
 * fast and repeatable — and which also means it never sees the intro. These
 * two check the other side of both gates.
 * --------------------------------------------------------------------- */

{
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2500);

  /* The transcript is the intro's one unconditional landmark. The skip
     control is not: it appears part-way through the timeline, and on a
     software rasteriser the timeline advances at a fraction of wall clock. */
  const before = await page.evaluate(() => ({
    intro: Boolean(
      document.querySelector("[aria-label='The battlefield for truth']"),
    ),
    nav: document.querySelectorAll("nav[aria-label='Sections'] button").length,
  }));

  // The navigation waits for the intro; skipping should hand straight over.
  await page
    .waitForSelector("[aria-label='Skip intro']", { timeout: 180_000 })
    .catch(() => {});
  await page.click("[aria-label='Skip intro']").catch(() => {});
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll("nav[aria-label='Sections'] button").length ===
        8,
      null,
      { timeout: 60_000, polling: 500 },
    )
    .catch(() => {});

  const after = await page.evaluate(
    () => document.querySelectorAll("nav[aria-label='Sections'] button").length,
  );
  await page.screenshot({ path: `${OUT}/handoff.png` });

  const ok = before.intro && before.nav === 0 && after === 8;
  if (!ok) failures += 1;
  console.log(
    `\nintro handoff          intro=${before.intro} navDuringIntro=${before.nav} ` +
      `navAfterSkip=${after} ${ok ? "ok" : "*** FAILED ***"}`,
  );
  await page.close();
}

{
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  /* No WebGL at all. Both the scene beneath and this layer must notice and
     degrade rather than throw, and the navigation must still be operable. */
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).includes("webgl")) return null;
      return original.call(this, type, ...rest);
    };
  });

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push(`console: ${m.text()}`);
  });

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const nodes = page.locator("nav[aria-label='Sections'] button");
  const count = await nodes.count();
  const labelled = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("nav[aria-label='Sections'] button"),
    ).every((b) => (b.textContent ?? "").trim().length > 0),
  );
  if (count > 1) await nodes.nth(1).click({ timeout: 8000 }).catch(() => {});
  const panelOpen = await page
    .waitForFunction(
      () => !document.querySelector("#nav-panel")?.hasAttribute("hidden"),
      null,
      { timeout: 5000, polling: 200 },
    )
    .then(() => true)
    .catch(() => false);
  const result = { count, labelled, panelOpen };
  await page.screenshot({ path: `${OUT}/no-webgl.png` });

  const ok =
    result.count === 8 &&
    result.labelled &&
    result.panelOpen &&
    pageErrors.length === 0;
  if (!ok) failures += 1;
  console.log(
    `without webgl          nav=${result.count}/8 labelled=${result.labelled} ` +
      `panelOpens=${result.panelOpen} errors=${pageErrors.length} ` +
      `${ok ? "ok" : "*** FAILED ***"}` +
      (pageErrors.length ? `\n    ${pageErrors.slice(0, 3).join(" | ")}` : ""),
  );
  await page.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} aspect(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${MATRIX.length} aspects covered. Screenshots in ${OUT}`);
