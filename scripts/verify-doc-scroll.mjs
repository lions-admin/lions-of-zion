/* Verifies the document-scroll conversion in real Chrome. The in-app browser
   reports visibilityState "hidden" and suspends rAF, so the progress bar —
   which is rAF-driven — cannot be observed there at all. */
import { chromium } from "playwright-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.argv[2] ?? "http://localhost:3000";

const browser = await chromium.launch({ executablePath: CHROME, headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

/* Per route: whether a reading-progress bar is mounted at all, and whether the
   rail that marks an active section is the one that does the marking.
   `DocPage` gates `ReadingProgress` on `withToc`, so the archive index has no
   bar to track; the Brief has its own static contents nav and no `SectionToc`,
   so nothing there ever sets `aria-current`. Asserting either would be
   asserting a feature that route does not have. */
const ROUTES = [
  { path: "/we-are", progress: true, toc: true },
  { path: "/geopolitical-brief", progress: true, toc: false },
  { path: "/october-7/documentation", progress: false, toc: false },
];

for (const { path: route, progress: hasProgress, toc: hasToc } of ROUTES) {
  console.log(`\n${route}`);
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(async () => {
    const doc = document.documentElement;
    const marked = document.querySelector("[data-reading-scroll]");
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

    const docScrolls = doc.scrollHeight > doc.clientHeight;
    const markedOverflow = marked ? getComputedStyle(marked).overflowY : "no marker";

    window.scrollTo({ top: 1400, behavior: "instant" });
    await sleep(500);
    const scrolledTo = Math.round(window.scrollY);

    const val = document.querySelector('[class*="rogressValue"], [class*="depthValue"]');
    const progressInline = val ? val.getAttribute("style") : null;

    const sticky = document.querySelector('[class*="backdrop"], [class*="RailInner"], [class*="siteHeader"]');
    const stickyTop = sticky ? Math.round(sticky.getBoundingClientRect().top) : null;
    const stickyPos = sticky ? getComputedStyle(sticky).position : null;

    const active = document.querySelector('[aria-current="true"], [class*="tocLink"][aria-current]');
    return { docScrolls, markedOverflow, scrolledTo, progressInline, stickyTop, stickyPos, tocActive: !!active };
  });

  check("document is the scroller", r.docScrolls && r.markedOverflow !== "auto" && r.markedOverflow !== "scroll",
        `doc=${r.docScrolls}, main overflow-y=${r.markedOverflow}`);
  check("window scrolls", r.scrolledTo > 1000, `scrollY=${r.scrolledTo}`);
  if (hasProgress) {
    check("progress bar tracks it", r.progressInline !== null && /scaleX\(0\.[1-9]/.test(r.progressInline),
          r.progressInline ?? "no inline transform");
  } else {
    check("no progress bar mounted, as expected", r.progressInline === null);
  }
  check("sticky chrome still pins", r.stickyPos === "sticky" || r.stickyPos === "fixed",
        `${r.stickyPos} @ top ${r.stickyTop}`);
  if (hasToc) {
    check("toc marks a section", r.tocActive, r.tocActive ? "" : "no aria-current");
  }
}

/* Back-navigation restoration is the payoff the conversion exists for. */
console.log("\nback-navigation restoration");
await page.goto(BASE + "/october-7/documentation", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.evaluate(() => window.scrollTo({ top: 3000, behavior: "instant" }));
await page.waitForTimeout(400);
const before = await page.evaluate(() => Math.round(window.scrollY));
await page.evaluate(() => { const a = document.querySelector('li[class*="recordItem"] a'); a && a.click(); });
await page.waitForTimeout(1500);
await page.goBack({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const after = await page.evaluate(() => Math.round(window.scrollY));
check("Back returns near where the reader was", Math.abs(after - before) < 400, `left at ${before}, returned to ${after}`);

await browser.close();
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
