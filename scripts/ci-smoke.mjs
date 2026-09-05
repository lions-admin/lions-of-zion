
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
  /* The two query tools. Both render their instrument and fetch nothing until
     a reader asks something, so a smoke walk here is a genuine check of the
     route and its console rather than of the API behind it. */
  "/search",
  "/ask",
  "/october-7/testimonies",
  "/october-7/documentation",
  "/fake-resistance/playbook",
  "/fake-resistance/network",
  "/fake-resistance/official-narrative",
  "/fake-resistance/social-media",
  /* The two live surfaces over the published record. Both read the API's
     public projection and both must render — with the correct empty state —
     when the build has no database, which is exactly the environment CI runs
     in, so this is the check that keeps their `StatusState` paths honest. */
  "/updates",
  "/fact-check",
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


const noJs = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
const noJsPage = await noJs.newPage();
const noJsResponse = await noJsPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

if ((noJsResponse?.status() ?? 0) !== 200) {
  console.error(`FAIL /: HTTP ${noJsResponse?.status() ?? 0} with JavaScript disabled`);
  failed = true;
} else {
  /* Kept in step with `lib/site-navigation.ts` by hand: this script is plain
     node with no bundler, so it cannot import the TypeScript module. A new
     section that is not added here is not smoke-tested. */
  const DESTINATIONS = [
    "/geopolitical-brief", "/support-us", "/information-war", "/october-7",
    "/our-heroes", "/israels-story", "/fake-resistance", "/we-are",
    "/methodology", "/corrections",
  ];

  const missing = [];
  for (const href of DESTINATIONS) {
    if ((await noJsPage.locator(`a[href="${href}"]`).count()) === 0) missing.push(href);
  }
  /* The property is "a reader with scripting off still gets a ground image,
     not a blank hero" — and how it is delivered changed on 2026-09-05.
     It used to be the particle entrance's `<picture>` fallback, which this
     line counted. The entrance is retired, and `HeroVideo` deliberately emits
     no `poster` attribute server-side (a poster is fetched even under
     `preload="none"`, and the server cannot know which frame shape the
     viewport wants). The no-JS ground is now `app/page.tsx`'s
     `<div className={styles.posterField} />`, painted by CSS
     `background-image` — so the element, not an `<img>`, is what proves it.
     `picture img` stays so a future `<picture>` hero satisfies this too. */
  const poster = await noJsPage
    .locator('picture img, div[class*="posterField"]')
    .count();
  const shell = await noJsPage.locator('div[hidden][id^="S:"]').count();

  /* The same check at phone width, and it is not redundant.
   *
   * The desktop pass above counts DOM nodes, which a `display: none` ancestor
   * does not remove — so a navigation that is present but hidden on a phone
   * passes it. That is not hypothetical: when the panels were first made to
   * render unconditionally, the section index still lived inside the
   * desktop-only link group, and the mobile sheet was being suppressed as a
   * duplicate. A phone with scripting off had NO navigation at all, and this
   * script reported "all routes clean" because it never looked below 720px.
   *
   * `isVisible()` is what closes it: it resolves layout, so an index hidden by
   * an ancestor's `display: none` fails here even though it is in the DOM. */
  const phone = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const phonePage = await phone.newPage();
  await phonePage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const phoneInvisible = [];
  for (const href of DESTINATIONS) {
    /* ANY instance visible is a pass, not the first. A destination legitimately
       appears more than once — as a bar link, as a drawer cell, and in the
       mobile sheet — and which of those is showing depends on the width. An
       earlier version of this check tested `.first()` and reported four false
       failures, because for exactly the destinations that also have a bar link,
       index 0 is the bar link, which is correctly hidden on a phone. */
    const all = phonePage.locator(`a[href="${href}"]`);
    const count = await all.count();
    let seen = false;
    for (let i = 0; i < count && !seen; i += 1) {
      seen = await all.nth(i).isVisible().catch(() => false);
    }
    if (!seen) phoneInvisible.push(href);
  }
  await phone.close();

  if (missing.length > 0 || phoneInvisible.length > 0 || poster < 1 || shell > 0) {
    console.error(
      `FAIL / without JavaScript: ${DESTINATIONS.length - missing.length}/` +
        `${DESTINATIONS.length} destinations reachable, ${poster} poster, ` +
        `${shell} hidden Suspense shell(s).` +
        (missing.length > 0
          ? ` Unreachable: ${missing.join(", ")}. A panel mounted on client state` +
            " is the usual cause — render it always and toggle `hidden`."
          : "") +
        (phoneInvisible.length > 0
          ? ` Present but NOT VISIBLE at 390px: ${phoneInvisible.join(", ")}.` +
            " A desktop-only ancestor with `display: none` is the usual cause."
          : "") +
        (shell > 0 ? " A root-level loading.tsx is the usual cause — see CLAUDE.md." : ""),
    );
    failed = true;
  } else {
    console.log(
      `ok   /            (no JavaScript: ${DESTINATIONS.length} destinations reachable and visible at 390px, poster present)`,
    );
  }
}
await noJs.close();

await browser.close();

if (failed) {
  console.error("\nSmoke test failed.");
  process.exit(1);
}
console.log("\nAll routes clean.");
