/**
 * End-to-end single-renderer check in real Chrome:
 * intro → skip/outro → the editorial home, plus the full forced-WebGL2 path.
 *
 * This asserted `a[data-node-index]` count === 8 at five points until
 * 2026-09-01, when the radial navigation was removed. The intro was kept, so
 * the intro, skip, WebGL2, no-JavaScript and console-error coverage survives;
 * the orbit assertions are replaced by the header navigation, which is what a
 * reader actually gets after the handoff.
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/lions-final";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const NAV = 'nav[aria-label="Primary navigation"] a[href^="/"]';

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
const before = await page.evaluate((nav) => ({
  intro: Boolean(document.querySelector("[aria-label='The battlefield for truth']")),
  // The destination is held inert while the intro owns the screen.
  homeInert: document.querySelector("[inert]") !== null,
  links: document.querySelectorAll(nav).length,
}), NAV);
await page.screenshot({ path: `${OUT}/intro.png` });

await page.click("[aria-label='Skip intro']");
await page.waitForFunction(
  () => document.querySelector("[data-intro-active]") === null,
  null,
  { timeout: 30_000 },
);
await page.waitForTimeout(4000);
const after = await page.evaluate((nav) => ({
  intro: Boolean(document.querySelector("[aria-label='The battlefield for truth']")),
  // Nothing may stay inert once the intro has handed off.
  homeInert: document.querySelector("[inert]") !== null,
  wordmark: Boolean(document.querySelector("#home-wordmark")),
  links: document.querySelectorAll(nav).length,
}), NAV);

/* Focus must reach a real header link with a visible ring. It used to be an
   orbit node; the requirement — keyboard reaches navigation, and you can see
   where you are — is unchanged. */
for (let attempt = 0; attempt < 12; attempt += 1) {
  await page.keyboard.press("Tab");
  const onNavLink = await page.evaluate(
    (nav) => document.activeElement?.matches(nav) ?? false,
    NAV,
  );
  if (onNavLink) break;
}
const keyboard = await page.evaluate((nav) => {
  const active = document.activeElement;
  const style = active instanceof HTMLElement ? getComputedStyle(active) : null;
  return {
    onNavLink: active instanceof HTMLElement ? active.matches(nav) : false,
    href: active instanceof HTMLAnchorElement ? active.getAttribute("href") : undefined,
    outlineWidth: style?.outlineWidth,
    outlineStyle: style?.outlineStyle,
  };
}, NAV);
await page.screenshot({ path: `${OUT}/home.png` });

await context.close();

const webgl = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const fallback = await webgl.newPage();
fallback.on("pageerror", (error) => errors.push(`webgl pageerror: ${error}`));
await fallback.goto(`${BASE}/?forceWebGL=1`, { waitUntil: "networkidle" });
await fallback.waitForTimeout(5000);
const webglReport = await fallback.evaluate((nav) => ({
  backend: document.querySelector("[data-backend]")?.getAttribute("data-backend"),
  links: document.querySelectorAll(nav).length,
  overlay: Boolean(document.querySelector("[data-nextjs-dialog]")),
}), NAV);
await fallback.screenshot({ path: `${OUT}/webgl2.png` });
await webgl.close();

const noJs = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  javaScriptEnabled: false,
});
const staticPage = await noJs.newPage();
await staticPage.goto(BASE, { waitUntil: "load" });
const noJsReport = await staticPage.evaluate((nav) => ({
  // The intro enhancement must be hidden, never a blank screen over the page.
  introVisible: (() => {
    const element = document.querySelector("[data-intro-only]");
    return element instanceof HTMLElement && getComputedStyle(element).display !== "none";
  })(),
  homeInert: document.querySelector("main[inert]") !== null,
  links: document.querySelectorAll(nav).length,
  poster: Boolean(document.querySelector("picture img")),
  // A root-level loading.tsx would strand the page inside a Suspense shell.
  shells: document.querySelectorAll('div[hidden][id^="S:"]').length,
}), NAV);
await staticPage.screenshot({ path: `${OUT}/no-js.png` });
await noJs.close();
await browser.close();

const ok =
  before.intro &&
  before.homeInert &&
  !after.intro &&
  !after.homeInert &&
  after.wordmark &&
  after.links >= 4 &&
  keyboard.onNavLink &&
  keyboard.outlineStyle !== "none" &&
  keyboard.outlineWidth === "2px" &&
  webglReport.backend === "webgl2" &&
  !webglReport.overlay &&
  !noJsReport.introVisible &&
  !noJsReport.homeInert &&
  noJsReport.links >= 4 &&
  noJsReport.poster &&
  noJsReport.shells === 0 &&
  errors.length === 0;

console.log("before:", before);
console.log("after:", after);
console.log("keyboard:", keyboard);
console.log("forced WebGL2:", webglReport);
console.log("no JavaScript:", noJsReport);
console.log("errors:", errors.length ? errors : "none");
if (!ok) process.exit(1);
