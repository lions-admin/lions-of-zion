/**
 * End-to-end single-renderer check in real Chrome:
 * intro → skip/outro → particle navigation, plus the full forced-WebGL2 path.
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/lions-final";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: false });
const errors = [];

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(`pageerror: ${error}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("[aria-label='Skip intro']", { timeout: 30_000 });
await page.waitForTimeout(4000);
const before = await page.evaluate(() => ({
  intro: Boolean(document.querySelector("[aria-label='The battlefield for truth']")),
  navigationInert: document.querySelector("[data-intro-active] [inert]") !== null,
  links: document.querySelectorAll("a[data-node-index]").length,
}));
await page.screenshot({ path: `${OUT}/intro.png` });

await page.click("[aria-label='Skip intro']");
await page.waitForFunction(
  () =>
    document.querySelector("[data-intro-active]") === null &&
    document.querySelectorAll("a[data-node-index]").length === 8,
  null,
  { timeout: 30_000 },
);
await page.waitForTimeout(4000);
const after = await page.evaluate(() => ({
  intro: Boolean(document.querySelector("[aria-label='The battlefield for truth']")),
  backend: document.querySelector("[data-backend]")?.getAttribute("data-backend"),
  live: document.querySelector("[data-live]") !== null,
  links: document.querySelectorAll("a[data-node-index]").length,
}));
for (let attempt = 0; attempt < 12; attempt += 1) {
  await page.keyboard.press("Tab");
  const onNavLink = await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.dataset.nodeIndex !== undefined,
  );
  if (onNavLink) break;
}
const keyboard = await page.evaluate(() => {
  const active = document.activeElement;
  const style = active instanceof HTMLElement ? getComputedStyle(active) : null;
  return {
    node: active instanceof HTMLElement ? active.dataset.nodeIndex : undefined,
    outlineWidth: style?.outlineWidth,
    outlineStyle: style?.outlineStyle,
  };
});
await page.screenshot({ path: `${OUT}/navigation.png` });

await context.close();

const webgl = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const fallback = await webgl.newPage();
fallback.on("pageerror", (error) => errors.push(`webgl pageerror: ${error}`));
await fallback.goto(`${BASE}/?forceWebGL=1`, {
  waitUntil: "networkidle",
});
await fallback.waitForTimeout(5000);
const webglReport = await fallback.evaluate(() => ({
  backend: document.querySelector("[data-backend]")?.getAttribute("data-backend"),
  live: document.querySelector("[data-live]") !== null,
  links: document.querySelectorAll("a[data-node-index]").length,
  overlay: Boolean(document.querySelector("[data-nextjs-dialog]")),
}));
await fallback.screenshot({ path: `${OUT}/webgl2.png` });
await webgl.close();

const noJs = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  javaScriptEnabled: false,
});
const staticPage = await noJs.newPage();
await staticPage.goto(BASE, { waitUntil: "load" });
const noJsReport = await staticPage.evaluate(() => ({
  introVisible: (() => {
    const element = document.querySelector("[data-intro-enhancement]");
    return element instanceof HTMLElement && getComputedStyle(element).display !== "none";
  })(),
  navigationInert: document.querySelector("main[inert]") !== null,
  links: document.querySelectorAll("a[data-node-index]").length,
  poster: Boolean(document.querySelector("picture img")),
}));
await staticPage.screenshot({ path: `${OUT}/no-js.png` });
await noJs.close();
await browser.close();

const ok =
  before.intro &&
  before.navigationInert &&
  before.links === 8 &&
  !after.intro &&
  after.links === 8 &&
  after.live &&
  keyboard.node !== undefined &&
  keyboard.outlineStyle !== "none" &&
  keyboard.outlineWidth === "2px" &&
  webglReport.backend === "webgl2" &&
  webglReport.live &&
  webglReport.links === 8 &&
  !webglReport.overlay &&
  !noJsReport.introVisible &&
  !noJsReport.navigationInert &&
  noJsReport.links === 8 &&
  noJsReport.poster &&
  errors.length === 0;

console.log("before:", before);
console.log("after:", after);
console.log("keyboard:", keyboard);
console.log("forced WebGL2:", webglReport);
console.log("no JavaScript:", noJsReport);
console.log("errors:", errors.length ? errors : "none");
if (!ok) process.exit(1);
