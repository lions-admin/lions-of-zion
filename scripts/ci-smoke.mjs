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
import { readFile } from "node:fs/promises";
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
  "/october-7/testimonies",
  "/october-7/documentation",
];

/**
 * The archive adds ~1,177 record pages, which is far too many to walk here.
 * A handful of real ones is enough to catch what actually breaks: a bad route
 * shape, a media id that no longer resolves, a locale segment that 404s. The
 * ids are read from the imported packages rather than written down, so this
 * cannot rot into checking records that no longer exist.
 */
async function sampleRecordRoutes() {
  const read = async (pkg) =>
    JSON.parse(await readFile(new URL(`../content-packages/${pkg}/index.json`, import.meta.url), "utf8"));

  const routes = [];
  try {
    const [testimonies, documentation] = await Promise.all([
      read("october7"),
      read("hamas-massacre"),
    ]);

    // One record at its default language, and one at a second language.
    const multi = testimonies.find((e) => e.languages.length > 1) ?? testimonies[0];
    if (multi) {
      routes.push(`/october-7/testimonies/${multi.id}`);
      const other = multi.languages.find((l) => l !== multi.defaultLanguage);
      if (other) routes.push(`/october-7/testimonies/${multi.id}/${other}`);
    }

    const doc = documentation.find((e) => e.category) ?? documentation[0];
    if (doc) {
      const category = doc.category ?? "uncategorized";
      routes.push(`/october-7/documentation/${category}/${doc.id}`);
      const other = doc.languages.find((l) => l !== doc.defaultLanguage);
      if (other) routes.push(`/october-7/documentation/${category}/${doc.id}/${other}`);
    }

    // The record the source left uncategorised reaches its route only through
    // a literal segment, so it is worth one check of its own.
    const loose = documentation.find((e) => !e.category);
    if (loose) routes.push(`/october-7/documentation/uncategorized/${loose.id}`);
  } catch {
    console.log("note: content-packages/ not imported — skipping archive record routes");
  }
  return routes;
}

ROUTES.push(...(await sampleRecordRoutes()));

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
