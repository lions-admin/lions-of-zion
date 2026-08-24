/**
 * Real-Chrome responsive verification for the post-intro particle navigation.
 * Reduced motion bypasses the intro so every viewport reaches the final scene
 * immediately. This is geometry/correctness verification, not a performance
 * benchmark.
 *
 *   node scripts/verify-composition.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/lions-particle-nav";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MATRIX = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1254x1254", width: 1254, height: 1254 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "2560x1080", width: 2560, height: 1080 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
});
let failures = 0;

for (const viewport of MATRIX) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(4500);

  const report = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[data-node-index]"));
    return {
      backend: document.querySelector("[data-backend]")?.getAttribute("data-backend"),
      live: document.querySelector("[data-live]") !== null,
      links: links.map((link) => {
        const box = link.getBoundingClientRect();
        return {
          label: link.textContent?.trim(),
          inside:
            box.left >= 0 &&
            box.top >= 0 &&
            box.right <= innerWidth &&
            box.bottom <= innerHeight,
        };
      }),
      overlay: Boolean(document.querySelector("[data-nextjs-dialog]")),
    };
  });

  await page.screenshot({ path: `${OUT}/${viewport.name}.png` });
  const ok =
    report.links.length === 8 &&
    report.links.every((link) => link.inside) &&
    !report.overlay &&
    errors.length === 0;
  if (!ok) failures += 1;
  console.log(
    `${viewport.name.padEnd(11)} links=${report.links.length}/8 ` +
      `inside=${report.links.every((link) => link.inside)} ` +
      `backend=${report.backend ?? "none"} live=${report.live} ` +
      `errors=${errors.length} ${ok ? "ok" : "FAILED"}`,
  );
  await context.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} viewport(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${MATRIX.length} viewports passed. Screenshots in ${OUT}`);
