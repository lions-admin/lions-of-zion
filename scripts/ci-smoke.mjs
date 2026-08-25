/**
 * CI route smoke test — every real route returns 200 and logs no console
 * errors. Uses Playwright's own bundled Chromium, not the macOS-only
 * `/Applications/Google Chrome.app/...` path the real-Chrome composition
 * scripts (`final-verify.mjs`, `verify-composition.mjs`) hardcode — those
 * are for the workstation only and will not run on a Linux CI runner.
 *
 * Deliberately modest: route availability and console errors only. Real
 * WebGPU support in headless CI Chromium is unreliable, so this makes no
 * assertion about the WebGPU/particle scene rendering — that stays a
 * real-Chrome, workstation-only check.
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3000";

const ROUTES = [
  "/",
  "/geopolitical-brief",
  "/support-us",
  "/war-update",
  "/october-7",
  "/our-heroes",
  "/israels-story",
  "/fake-resistance",
  "/we-are",
  "/methodology",
  "/corrections",
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();

let failed = false;

for (const route of ROUTES) {
  const errors = [];
  const onConsole = (message) => {
    if (message.type() === "error") errors.push(message.text());
  };
  const onPageError = (error) => errors.push(`pageerror: ${error}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  const status = response?.status() ?? 0;

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  if (status !== 200) {
    console.error(`FAIL ${route}: HTTP ${status}`);
    failed = true;
  } else if (errors.length > 0) {
    console.error(`FAIL ${route}: ${errors.length} console error(s)`);
    for (const e of errors) console.error(`  ${e}`);
    failed = true;
  } else {
    console.log(`ok   ${route}`);
  }
}

await browser.close();

if (failed) {
  console.error("\nSmoke test failed.");
  process.exit(1);
}
console.log("\nAll routes clean.");
