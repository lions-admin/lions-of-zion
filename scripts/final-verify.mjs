import { chromium } from "playwright-core";
const exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ executablePath: exe, headless: true });

// ---------- 1. Desktop full sequence ----------
const desktop = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const p1 = await desktop.newPage();
const errors = [];
p1.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p1.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await p1.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

const shots = [
  [1200, "01-darkness"],
  [2600, "02-eyes"],
  [4200, "03-face"],
  [5600, "04-muzzle"],
  [7000, "05-mane"],
  [9200, "06-full-title"],
];
let prev = 0;
for (const [t, name] of shots) {
  await p1.waitForTimeout(t - prev);
  prev = t;
  await p1.screenshot({ path: `/tmp/final-${name}.png` });
  console.log("shot", name);
}
// click -> dissolve mid
await p1.mouse.click(800, 450);
await p1.waitForTimeout(620);
await p1.screenshot({ path: "/tmp/final-07-dissolve.png" });
console.log("shot 07-dissolve");
await p1.waitForTimeout(1500);
await p1.screenshot({ path: "/tmp/final-08-rebuilt.png" });
console.log("shot 08-rebuilt");

// ---------- 2. Mobile portrait ----------
const mob = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const p2 = await mob.newPage();
p2.on("pageerror", (e) => errors.push("mobile pageerror: " + e.message));
await p2.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await p2.waitForTimeout(9500);
await p2.screenshot({ path: "/tmp/final-09-mobile.png" });
console.log("shot 09-mobile");

// ---------- 3. Reduced motion ----------
const rm = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  reducedMotion: "reduce",
});
const p3 = await rm.newPage();
p3.on("pageerror", (e) => errors.push("reduced pageerror: " + e.message));
await p3.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await p3.waitForTimeout(3500);
await p3.screenshot({ path: "/tmp/final-10-reduced.png" });
console.log("shot 10-reduced");

const appErrors = await p1.evaluate(() => (window).__ceedErrors || []);
console.log("app trapped errors:", appErrors);
console.log("browser errors:", errors.length ? errors : "NONE");
await browser.close();
