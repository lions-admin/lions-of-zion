import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT_DIR = process.argv[3] ?? join(process.cwd(), ".screenshots");

await mkdir(OUT_DIR, { recursive: true });

const ROUTES = [
  { path: "/", name: "01_home_top", scroll: false },
  { path: "/", name: "01_home_scrolled", scroll: true },
  { path: "/geopolitical-brief", name: "02_geopolitical_brief", fullPage: true },
  { path: "/information-war", name: "03_information_war", fullPage: true },
  { path: "/october-7", name: "04_october_7", fullPage: true },
  { path: "/october-7/testimonies", name: "05_october_7_testimonies", fullPage: false },
  { path: "/fake-resistance", name: "06_fake_resistance", fullPage: true },
  { path: "/fake-resistance/official-narrative", name: "07_fake_resistance_official", fullPage: true },
  { path: "/fake-resistance/playbook", name: "08_fake_resistance_playbook", fullPage: true },
  { path: "/israels-story", name: "09_israels_story", fullPage: true },
  { path: "/our-heroes", name: "10_our_heroes", fullPage: true },
  { path: "/we-are", name: "11_we_are", fullPage: true },
  { path: "/support-us", name: "12_support_us", fullPage: true },
  { path: "/war-update", name: "13_war_update", fullPage: true },
  { path: "/methodology", name: "14_methodology", fullPage: true },
  { path: "/corrections", name: "15_corrections", fullPage: true },
  { path: "/account", name: "16_account", fullPage: false },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

console.log("Starting screenshot capture from " + BASE + " to " + OUT_DIR + "...");

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});

for (const vp of VIEWPORTS) {
  console.log("\n=== Capturing Viewport: " + vp.name + " (" + vp.width + "x" + vp.height + ") ===");
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  for (const r of ROUTES) {
    const url = BASE + r.path;
    try {
      console.log("Navigating to " + url + "...");
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);

      if (r.scroll) {
        await page.evaluate(() => {
          const band = document.querySelector("[data-home-scroll]");
          if (band) band.scrollIntoView({ block: "start" });
          else window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(600);
      }

      const filename = r.name + "_" + vp.name + ".png";
      const outPath = join(OUT_DIR, filename);
      await page.screenshot({
        path: outPath,
        fullPage: r.fullPage ?? false,
      });
      console.log("  ✓ Saved " + filename);
    } catch (err) {
      console.error("  ✗ Error capturing " + r.path + ":", err.message);
    }
  }

  await context.close();
}

await browser.close();
console.log("\nFinished capturing all screenshots!");
