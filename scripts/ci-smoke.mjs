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
  "/fake-resistance/playbook",
  "/fake-resistance/network",
  "/fake-resistance/official-narrative",
  "/fake-resistance/social-media",
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

/**
 * One research case file, read from the imported index rather than named here
 * so a renamed or held case cannot leave this script checking a dead route.
 */
async function sampleResearchRoute() {
  try {
    const index = JSON.parse(
      await readFile(
        new URL("../content-packages/fake-resistance/index.json", import.meta.url),
        "utf8",
      ),
    );
    const first = index.cases?.[0];
    return first ? [`/fake-resistance/cases/${first.slug}`] : [];
  } catch {
    console.log("note: fake-resistance research not imported — skipping case route");
    return [];
  }
}

ROUTES.push(...(await sampleRecordRoutes()), ...(await sampleResearchRoute()));

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

/* The no-JavaScript invariant, which nothing else in CI can see.
 *
 * CLAUDE.md marks "do not reintroduce a root-level `loading.tsx`" as
 * load-bearing: a root Suspense boundary makes streaming SSR emit the real
 * markup inside `<div hidden id="S:0">` for an inline script to reveal, so
 * with scripting off the loading shell stays and the page never appears.
 * Every check above runs with JavaScript enabled and would pass against
 * exactly that build. `scripts/final-verify.mjs` catches it, but needs real
 * Chrome on macOS — so on Linux this is the only guard there is.
 *
 * The home route is the test case because it is the one with the most to
 * lose: eight orbit links and the poster are the whole navigation for a
 * reader without scripting. */
const noJs = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
const noJsPage = await noJs.newPage();
const noJsResponse = await noJsPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

if ((noJsResponse?.status() ?? 0) !== 200) {
  console.error(`FAIL /: HTTP ${noJsResponse?.status() ?? 0} with JavaScript disabled`);
  failed = true;
} else {
  const links = await noJsPage.locator("a[data-node-index]").count();
  const poster = await noJsPage.locator("picture img, img[src*='particle-nav']").count();
  const shell = await noJsPage.locator('div[hidden][id^="S:"]').count();

  if (links < 8 || poster < 1 || shell > 0) {
    console.error(
      `FAIL / without JavaScript: ${links}/8 orbit links, ${poster} poster, ` +
        `${shell} hidden Suspense shell(s).` +
        (shell > 0 ? " A root-level loading.tsx is the usual cause — see CLAUDE.md." : ""),
    );
    failed = true;
  } else {
    console.log(`ok   /            (no JavaScript: ${links} links, poster present)`);
  }
}
await noJs.close();

await browser.close();

if (failed) {
  console.error("\nSmoke test failed.");
  process.exit(1);
}
console.log("\nAll routes clean.");
