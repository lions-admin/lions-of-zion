/**
 * Capture the public site for design review.
 *
 * Sectioned viewport captures rather than one `fullPage` strip, and the reason
 * is legibility rather than taste: a `fullPage` shot of a 6000px article at
 * deviceScaleFactor 2 is a 2880x12000 image, which every viewer downscales
 * until the type is mush — which is exactly how you end up "reviewing" a page
 * you cannot actually read. One viewport per file at DSF 2 gives 2880x1800,
 * where 12px metadata is still sharp.
 *
 * It scrolls rather than clips, so a sticky header, a scroll-linked progress
 * rail and an `IntersectionObserver` reveal all render the way a reader sees
 * them. The home route scrolls a custom container (`[data-home-scroll]`)
 * instead of the document, so the scroller is resolved per page.
 *
 *   node scripts/design-capture.mjs [--base http://localhost:3001]
 *                                   [--out <dir>] [--only <substring>]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = arg("base", "http://localhost:3001");
const OUT = arg("out", "/tmp/design-capture");
const ONLY = arg("only", null);

/* `priority` are the routes under review first; they are captured on the phone
   as well, because that is where a news layout breaks first. */
const ROUTES = [
  { slug: "updates", url: "/updates", priority: true },
  {
    slug: "article",
    url: "/articles/israel-launches-fresh-attacks-across-southern-le-86i2j",
    priority: true,
  },
  { slug: "geopolitical-brief", url: "/geopolitical-brief", priority: true },
  { slug: "war-update", url: "/war-update", priority: true },
  { slug: "fact-check", url: "/fact-check", priority: true },
  { slug: "corrections", url: "/corrections", priority: true },
  { slug: "home", url: "/", settle: 9000 },
  { slug: "search", url: "/search" },
  { slug: "methodology", url: "/methodology" },
  { slug: "we-are", url: "/we-are" },
  { slug: "our-heroes", url: "/our-heroes" },
  { slug: "israels-story", url: "/israels-story" },
  { slug: "support-us", url: "/support-us" },
  { slug: "october-7", url: "/october-7" },
  { slug: "october-7-testimonies", url: "/october-7/testimonies" },
  { slug: "october-7-documentation", url: "/october-7/documentation" },
  { slug: "fake-resistance", url: "/fake-resistance" },
  { slug: "fake-resistance-playbook", url: "/fake-resistance/playbook" },
  { slug: "fake-resistance-network", url: "/fake-resistance/network" },
  { slug: "information-war", url: "/information-war" },
  { slug: "ask", url: "/ask" },
];

const DESKTOP = { name: "desktop", width: 1440, height: 900, maxSections: 9 };
const MOBILE = { name: "mobile", width: 390, height: 844, maxSections: 7 };

async function capture(context, route, device, report) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });

  const dir = path.join(OUT, device.name);
  await mkdir(dir, { recursive: true });

  try {
    await page.goto(BASE + route.url, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
  } catch {
    /* networkidle never settles on a page holding a live connection; the load
       still happened, so fall through to the settle wait and capture anyway. */
  }
  await page.waitForTimeout(route.settle ?? 3500);

  /* The scroller is the document on most routes and a custom element on the
     home route. Ask the page which, rather than assuming. */
  const geom = await page.evaluate(() => {
    const custom = document.querySelector("[data-home-scroll]");
    const usesCustom = custom && custom.scrollHeight > custom.clientHeight;
    const el = usesCustom ? custom : document.scrollingElement;
    return {
      usesCustom: Boolean(usesCustom),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      title: document.title,
    };
  });

  const step = Math.round(device.height * 0.92); // slight overlap, no lost seam
  const sections = Math.min(
    Math.max(1, Math.ceil((geom.scrollHeight - geom.clientHeight) / step) + 1),
    device.maxSections,
  );

  const files = [];
  for (let i = 0; i < sections; i += 1) {
    const y = i * step;
    await page.evaluate(
      ([top, useCustom]) => {
        const el = useCustom
          ? document.querySelector("[data-home-scroll]")
          : document.scrollingElement;
        el.scrollTop = top;
      },
      [y, geom.usesCustom],
    );
    await page.waitForTimeout(650); // let reveals and lazy images land
    const file = path.join(
      dir,
      `${route.slug}--${String(i + 1).padStart(2, "0")}.png`,
    );
    await page.screenshot({ path: file });
    files.push(path.basename(file));
  }

  report.push({
    route: route.url,
    device: device.name,
    title: geom.title,
    pageHeight: geom.scrollHeight,
    sections: files.length,
    truncated: sections === device.maxSections,
    files,
    errors: [...new Set(errors)].slice(0, 5),
  });
  console.log(
    `  ${device.name.padEnd(7)} ${route.url.padEnd(46)} ${String(geom.scrollHeight).padStart(6)}px  ${files.length} shots${errors.length ? `  (${new Set(errors).size} console errors)` : ""}`,
  );
  await page.close();
}

const routes = ONLY ? ROUTES.filter((r) => r.slug.includes(ONLY)) : ROUTES;
const browser = await chromium.launch();
const report = [];

for (const device of [DESKTOP, MOBILE]) {
  const list = device.name === "mobile" ? routes.filter((r) => r.priority) : routes;
  if (!list.length) continue;
  console.log(`\n=== ${device.name} ${device.width}x${device.height} @2x ===`);
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 2,
    isMobile: device.name === "mobile",
    hasTouch: device.name === "mobile",
  });
  for (const route of list) await capture(context, route, device, report);
  await context.close();
}

await browser.close();
await writeFile(
  path.join(OUT, "report.json"),
  JSON.stringify(report, null, 2),
);
const shots = report.reduce((n, r) => n + r.sections, 0);
console.log(`\n${shots} images across ${report.length} captures -> ${OUT}`);
const noisy = report.filter((r) => r.errors.length);
if (noisy.length) {
  console.log(`\nconsole errors:`);
  for (const r of noisy) console.log(`  ${r.device} ${r.route}\n    ${r.errors.join("\n    ")}`);
}
