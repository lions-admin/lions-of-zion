#!/usr/bin/env node
/**
 * Captures the intro in a real, headed Chrome and reports what it saw.
 *
 * Headed and real-Chrome are both load-bearing — see SKILL.md. This replaces
 * the several ad-hoc copies of this script that kept getting rewritten.
 */

import { chromium } from "playwright-core";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const url = arg("url", "http://localhost:3000");
const mobile = flag("mobile");
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 810 };
const out = arg("out", mkdtempSync(join(tmpdir(), "intro-")));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: false, executablePath: CHROME });
const page = await browser.newPage({ viewport });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("requestfailed", (r) => {
  /* Skipping unmounts the intro, whose cleanup aborts its own in-flight
     fetches for the structure data and the typeface. Reporting those as
     failures would flag correct teardown on every skip run. */
  if (r.failure()?.errorText === "net::ERR_ABORTED") return;
  errors.push(`requestfailed: ${r.url().slice(-70)}`);
});

await page.goto(url, { waitUntil: "load" });

const started = Date.now();
const at = () => (Date.now() - started) / 1000;
const canvases = () => page.evaluate(() => document.querySelectorAll("canvas").length);

const env = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    visibility: document.visibilityState,
    renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "none",
  };
});
console.log(`layout      ${mobile ? "mobile" : "desktop"} ${viewport.width}x${viewport.height}`);
console.log(`visibility  ${env.visibility}${env.visibility !== "visible" ? "  <-- rAF WILL BE SUSPENDED" : ""}`);
console.log(`renderer    ${env.renderer}`);
if (/swiftshader|llvmpipe|software/i.test(env.renderer)) {
  console.log("            ^ software rasteriser: the homepage scene will not mount");
}

if (flag("skip")) {
  for (let i = 0; i < 60 && !(await page.$('button[aria-label="Skip intro"]')); i++) {
    await page.waitForTimeout(500);
  }
  const btn = await page.$('button[aria-label="Skip intro"]');
  if (btn) {
    console.log(`\n[${at().toFixed(1)}s] clicking Skip intro`);
    await btn.click();
  } else {
    console.log("\nskip control never appeared");
  }
}

/* Frames across the sequence. Denser early, where formation and the first
   statements land, and denser again around the handoff. */
const marks = flag("skip") ? [1, 3, 6, 10] : [2, 5, 8, 11, 14, 17, 20, 24, 28, 32, 36];
console.log("");
for (const m of marks) {
  const wait = m * 1000 - (Date.now() - started);
  if (wait > 0) await page.waitForTimeout(wait);
  const name = `t${String(m).padStart(2, "0")}s.png`;
  await page.screenshot({ path: join(out, name) });
  console.log(`  ${name}  canvases=${await canvases()}`);
}

let ended = null;
for (let i = 0; i < 200; i++) {
  if ((await canvases()) === 1) {
    ended = at();
    break;
  }
  await page.waitForTimeout(250);
}
await page.waitForTimeout(3000);
await page.screenshot({ path: join(out, "end.png") });
console.log("  end.png");

console.log(
  `\nintro ended  ${ended === null ? "did NOT end within the window" : `~${ended.toFixed(1)}s`}`,
);
console.log(`errors       ${errors.length ? errors.slice(0, 6).join("\n             ") : "none"}`);
console.log(`\nframes in    ${out}\n\nNow READ the frames — copy landing on the lion throws nothing.`);

await browser.close();
