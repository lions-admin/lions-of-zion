/**
 * Mobile-first homepage evidence for the editorial-journey refinement.
 *
 * Local Chromium emulation only — an iPhone-sized viewport with a device scale
 * factor and a touch pointer, which is not a physical iPhone or Safari. It
 * writes screenshots and a machine-readable `results.json` under
 * `docs/reviews/homepage-mobile-refinement/<phase>/`.
 *
 *   node scripts/homepage/verify-mobile.mjs before   # against the current tree
 *   node scripts/homepage/verify-mobile.mjs after
 *
 * `ORIGIN` overrides the dev server (default http://localhost:3000). Playwright
 * is resolved from the project first, then from a global install.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
/* The first Playwright whose Chromium is actually on disk wins: a project copy
   that is newer than the installed browsers cannot launch anything. */
function loadPlaywright() {
  const roots = [process.env.PLAYWRIGHT_ROOT, process.cwd(), '/opt/node22/lib', '/usr/local/lib', '/usr/lib'].filter(Boolean);
  let fallback = null;
  for (const root of roots) {
    let pw;
    try { pw = require(require.resolve('playwright', { paths: [root] })); } catch { continue; }
    fallback ??= pw;
    try { if (existsSync(pw.chromium.executablePath())) return pw; } catch { /* keep looking */ }
  }
  if (fallback) return fallback;
  throw new Error('playwright is not installed. `npm i -g playwright` or set PLAYWRIGHT_ROOT.');
}
const { chromium, devices } = loadPlaywright();

const phase = process.argv[2] ?? 'after';
const origin = process.env.ORIGIN ?? 'http://localhost:3000';
const root = `docs/reviews/homepage-mobile-refinement/${phase}`;
await mkdir(root, { recursive: true });

/* The dev indicator is Next's, not the page's. Hidden so it never reads as a
   homepage control in the evidence. */
const HIDE_DEV_CHROME = 'nextjs-portal{display:none!important}';
const SECTIONS = ['news', 'fakeResistance', 'october7', 'heroes', 'israelsStory', 'system'];
/* Phone runs use Chromium's mobile emulation (device scale factor, touch,
   coarse pointer, viewport meta) at the brief's full-screen sizes. */
const phone = (width, height, deviceScaleFactor) => ({ viewport: { width, height }, deviceScaleFactor, isMobile: true, hasTouch: true });
const RUNS = [
  { name: 'w320', ...phone(320, 568, 2) },
  { name: 'w375', ...phone(375, 667, 2) },
  { name: 'iphone-390x844', ...phone(390, 844, 2), fullPage: true },
  { name: 'iphone-430x932', ...phone(430, 932, 2) },
  { name: 'w768', viewport: { width: 768, height: 1024 } },
  { name: 'w1440', viewport: { width: 1440, height: 900 }, fullPage: true },
];

const report = { origin, phase, device: 'Chromium viewport/device emulation, not a physical phone', runs: [] };

/* What lies under a rectangle, by geometry rather than by hit-testing: every
   visible text line box, image and control whose client rect intersects the
   launcher's rect (inset by two pixels so a shared edge does not count). */
const OCCLUSION_PROBE = `(rect) => {
  const trigger = document.querySelector('[data-ask-launcher]');
  const inside = (el) => !!trigger && (el === trigger || trigger.contains(el));
  const inset = 2;
  const R = { l: rect.left + inset, t: rect.top + inset, r: rect.left + rect.width - inset, b: rect.top + rect.height - inset };
  const hit = (b) => b.width > 0 && b.height > 0 && b.left < R.r && b.right > R.l && b.top < R.b && b.bottom > R.t;
  const label = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0].replace(/^homepage-journey-module__\\w+__/, '') : '');
  const hits = { text: 0, image: 0, control: 0, elements: {}, snippets: [] };
  const note = (el, snippet) => { const k = label(el); hits.elements[k] = (hits.elements[k] || 0) + 1; if (snippet && hits.snippets.length < 4) hits.snippets.push(snippet); };
  const skip = (el) => inside(el) || el.closest('header, nextjs-portal, [aria-hidden="true"]') || getComputedStyle(el).visibility === 'hidden';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement; if (!el || skip(el)) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const b of range.getClientRects()) if (hit(b)) { hits.text++; note(el, node.textContent.trim().slice(0, 40)); break; }
  }
  for (const el of document.querySelectorAll('img, video, svg, canvas')) { if (skip(el)) continue; if (hit(el.getBoundingClientRect())) { hits.image++; note(el); } }
  for (const el of document.querySelectorAll('a, button, summary, input')) { if (skip(el)) continue; if (hit(el.getBoundingClientRect())) { hits.control++; note(el, el.textContent.trim().slice(0, 40)); } }
  return hits;
}`;

const scrollTo = (page, y) => page.evaluate((y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), y);

async function inspect(run) {
  const { name, fullPage = false, ...device } = run;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...device, reducedMotion: 'no-preference' });
  const errors = [];
  const open = async () => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: HIDE_DEV_CHROME });
    await page.evaluate(() => document.fonts.ready);
    /* Walk the page once so every lazy image has been asked for, then wait
       for what has arrived. A decode that never settles must not stall the
       run, so each wait is bounded. */
    const stops = await page.evaluate(() => Array.from(document.querySelectorAll('[data-home-section]')).map((el) => el.getBoundingClientRect().top + scrollY - 64));
    for (const stop of stops) {
      await scrollTo(page, stop);
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => Promise.race([
      Promise.all(Array.from(document.images).map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => {})))),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]));
    await scrollTo(page, 0);
    await page.waitForTimeout(300);
    return page;
  };

  /* The full-page capture gets a page of its own: under mobile emulation
     Chromium resizes the viewport for it, and later captures on the same page
     came back from a displaced visual viewport. One phone and one desktop
     full-page image per phase is plenty; the rest are viewport captures. */
  if (fullPage) {
    const page = await open();
    await page.screenshot({ path: `${root}/${name}-full.png`, fullPage: true });
    await page.close();
  }
  const page = await open();
  const shot = (label, options = {}) => page.screenshot({ path: `${root}/${name}-${label}.png`, ...options });
  await shot('hero');

  /* First meaningful content: where the hero ends and where the first record's
     image and headline begin, in CSS pixels from the top of the document. */
  const arrival = await page.evaluate(() => {
    const hero = document.querySelector('main > section');
    const heroBottom = hero ? hero.getBoundingClientRect().bottom + scrollY : 0;
    const firstImg = document.querySelector('[data-home-section="news"] img');
    const firstTitle = document.querySelector('[data-home-section="news"] h3');
    const firstArticle = document.querySelector('[data-home-section="news"] article');
    const top = (el) => (el ? el.getBoundingClientRect().top + scrollY : null);
    return { heroBottom, firstArticleTop: top(firstArticle), firstImageTop: top(firstImg), firstHeadlineTop: top(firstTitle), documentHeight: document.documentElement.scrollHeight };
  });
  await scrollTo(page, Math.max(0, arrival.heroBottom - 40));
  await page.waitForTimeout(250);
  await shot('after-hero');

  const sections = {};
  for (const section of SECTIONS) {
    const locator = page.locator(`[data-home-section="${section}"]`);
    if (!(await locator.count())) continue;
    await locator.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 64, behavior: 'instant' }));
    await page.waitForTimeout(250);
    await shot(section);
    sections[section] = await locator.evaluate((el) => {
      const lineCount = (node) => {
        const cs = getComputedStyle(node);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        return Math.round(node.getBoundingClientRect().height / lh);
      };
      const heads = Array.from(el.querySelectorAll('h3')).map((h) => ({ text: h.textContent.trim().slice(0, 60), fontSize: getComputedStyle(h).fontSize, lines: lineCount(h) }));
      return { height: Math.round(el.getBoundingClientRect().height), headlines: heads, articles: el.querySelectorAll('article').length };
    });
  }

  /* The launcher at several reading positions: what sits beneath it. */
  const launcher = [];
  const positions = [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97];
  for (const fraction of positions) {
    const y = Math.round((arrival.documentHeight - run.viewport.height) * fraction);
    await scrollTo(page, y);
    await page.waitForTimeout(350);
    const state = await page.evaluate(`(() => {
      const el = document.querySelector('[data-ask-launcher]');
      if (!el) return { present: false };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05 && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const probe = (${OCCLUSION_PROBE})({ left: r.left, top: r.top, width: r.width, height: r.height });
      return { present: true, visible, rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }, position: cs.position, under: probe };
    })()`);
    const under = state.under ?? { text: 0, image: 0, control: 0 };
    launcher.push({ fraction, scrollY: y, ...state, covers: !!state.visible && under.text + under.image + under.control > 0 });
    await shot(`launcher-${Math.round(fraction * 100)}`);
  }

  /* Scrolling back up a little is how a reader asks for the chrome. */
  await page.evaluate(() => window.scrollBy({ top: -160, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const afterScrollUp = await page.evaluate(() => {
    const el = document.querySelector('[data-ask-launcher]');
    if (!el) return { present: false };
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { visible: cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.top < innerHeight && r.bottom > 0, rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } };
  });
  await shot('launcher-after-scroll-up');

  /* Keyboard: the launcher must be reachable and visible when focused. */
  await scrollTo(page, 0);
  let launcherFocused = false, tabs = 0;
  for (; tabs < 80; tabs++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement; if (!el) return null;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { launcher: el.hasAttribute('data-ask-launcher'), visible: cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.width > 0 && r.top < innerHeight && r.bottom > 0 };
    });
    if (focused?.launcher) { launcherFocused = focused.visible; break; }
  }
  if (launcherFocused) await shot('launcher-focus');

  const layout = await page.evaluate(() => {
    const wide = Array.from(document.querySelectorAll('body *')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).slice(0, 5).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''));
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, overflowing: wide, main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length };
  });

  report.runs.push({ name, viewport: run.viewport, deviceScaleFactor: run.deviceScaleFactor ?? 1, arrival, sections, launcher, afterScrollUp, keyboard: { launcherFocused, tabs }, layout, errors });
  await context.close();
  await browser.close();
}

/* `ONLY=w320,w1440` limits a run while iterating on one width. */
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
for (const run of RUNS) {
  if (only && !only.has(run.name)) continue;
  const started = Date.now();
  await inspect(run);
  console.error(`${run.name}: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/* Reduced motion and no JavaScript, on the phone. */
{
  const browser = await chromium.launch({ headless: true });
  const rm = await browser.newContext({ ...phone(390, 844, 3), reducedMotion: 'reduce' });
  const p = await rm.newPage();
  await p.goto(origin, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE_DEV_CHROME });
  await p.screenshot({ path: `${root}/iphone-390x844-reduced-motion-hero.png` });
  await p.locator('[data-home-section="news"]').evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 64, behavior: 'instant' }));
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${root}/iphone-390x844-reduced-motion-news.png` });
  report.reducedMotion = { videoVisible: await p.evaluate(() => Array.from(document.querySelectorAll('video')).some((v) => getComputedStyle(v).display !== 'none')) };
  await rm.close();

  const nojs = await browser.newContext({ ...phone(390, 844, 3), javaScriptEnabled: false });
  const q = await nojs.newPage();
  await q.goto(origin, { waitUntil: 'networkidle' });
  await q.screenshot({ path: `${root}/iphone-390x844-no-js-full.png`, fullPage: true });
  report.noJS = { records: await q.locator('[data-home-record]').count(), main: await q.locator('main').count(), noscriptLinks: await q.locator('noscript a').count(), launcherPresent: await q.locator('[data-ask-launcher]').count() };
  await nojs.close();
  await browser.close();
}

await writeFile(`${root}/results.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ phase, runs: report.runs.map((r) => ({ name: r.name, overflow: r.layout.documentWidth > r.layout.viewport, arrival: Math.round(r.arrival.firstHeadlineTop - r.arrival.heroBottom), launcher: r.launcher.map((l) => `${Math.round(l.fraction * 100)}%:${l.visible ? (l.covers ? 'shown-over-content' : 'shown-clear') : 'hidden'}`).join(' '), keyboard: r.keyboard, errors: r.errors.length })), noJS: report.noJS }, null, 2));
