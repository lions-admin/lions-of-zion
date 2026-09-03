#!/usr/bin/env node
/**
 * What every public route actually ships, and whether it still fits.
 *
 * Next 16's Turbopack build prints route names, revalidate and expire — and
 * no sizes. The "First Load JS" column this repository's notes still refer to
 * does not exist any more, so a per-route budget has to be computed from the
 * build's own manifests rather than scraped from its stdout. Everything below
 * is read out of `.next/` after `npm run build`; nothing here estimates.
 *
 * Where the numbers come from
 * ---------------------------
 * `.next/server/app/**\/page_client-reference-manifest.js` assigns
 * `globalThis.__RSC_MANIFEST["<route>/page"]`. Its `entryJSFiles` and
 * `entryCSSFiles` name, per entry, exactly the chunks the router sends for
 * that route; `clientModules` names every module that crossed a `"use client"`
 * boundary to get there. Adding `rootMainFiles` + `polyfillFiles` from
 * `.next/build-manifest.json` — the framework payload every route pays for —
 * gives first-load JS. Sizes are the emitted files on disk, and gzip is
 * `zlib.gzipSync(level 9)`, which tracks a CDN's `content-encoding: gzip`
 * closely enough to budget against and is reproducible on any machine.
 * Preloaded font bytes come from `.next/server/next-font-manifest.json`,
 * which lists per route the woff2 files Next emits a `<link rel=preload>` for.
 *
 * Sections
 * --------
 *   routes   per-route first-load JS, route CSS, preloaded fonts
 *   client   the `"use client"` census, and the client modules per route
 *   css      every CSS Module class no TSX file names — evidence for
 *            CLEAN-008, which is where deletion happens; this script only
 *            reports
 *   assets   oversized and unreferenced files under `public/` and `logos/`
 *   runtime  LCP, CLS, INP, GPU startup and archive interaction, measured in
 *            headless Chromium against a server you are already running
 *
 * Usage
 * -----
 *   npm run perf:report                     all static sections + budget check
 *   npm run perf:report -- --markdown       the same, as a Markdown report
 *   npm run perf:report -- --json           machine-readable
 *   npm run perf:report -- --warn-only      never exit non-zero
 *   npm run perf:report -- --update-budgets rewrite the budget file from what
 *                                           is measured now (review the diff)
 *   npm run perf:runtime -- http://localhost:3000
 *   npm run perf:runtime -- http://localhost:3000 --update-budgets
 *
 * The runtime section needs a port. It never starts a server itself and never
 * picks one: you pass the origin of a `next start` you control. A budget it
 * has never been calibrated against is reported as `uncalibrated` and warns —
 * it is never silently treated as a pass.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const NEXT = path.join(ROOT, ".next");
const BUDGET_FILE = path.join(HERE, "perf-budgets.json");

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const RUNTIME_BASE = argv.find((a) => /^https?:\/\//.test(a));
const AS_JSON = has("--json");
const AS_MARKDOWN = has("--markdown");
const WARN_ONLY = has("--warn-only");
const UPDATE = has("--update-budgets");

/* ── plumbing ──────────────────────────────────────────────────────────── */

const kb = (n) => (n / 1024).toFixed(1);
const sizeCache = new Map();

/** Raw and gzip bytes of one emitted asset, keyed by its `.next`-relative path. */
function assetSize(rel) {
  if (sizeCache.has(rel)) return sizeCache.get(rel);
  let value = { raw: 0, gz: 0 };
  try {
    const buf = readFileSync(path.join(NEXT, rel));
    value = { raw: buf.length, gz: gzipSync(buf, { level: 9 }).length };
  } catch {
    /* A chunk named by a manifest but not emitted contributes nothing rather
       than crashing the report — an inlined CSS entry is the normal case. */
  }
  sizeCache.set(rel, value);
  return value;
}

function walk(dir, match, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(entry.name, full)) out.push(full);
  }
  return out;
}

function requireBuild() {
  if (existsSync(path.join(NEXT, "build-manifest.json"))) return;
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

/* ── routes ────────────────────────────────────────────────────────────── */

/**
 * Reads every route's client-reference manifest.
 *
 * The manifest file is a plain assignment to `globalThis.__RSC_MANIFEST`, so
 * it is evaluated rather than parsed — it is this build's own output, written
 * seconds ago by `next build`, and re-implementing its shape would rot.
 */
function collectRoutes() {
  const build = JSON.parse(readFileSync(path.join(NEXT, "build-manifest.json"), "utf8"));
  const sharedFiles = [...build.rootMainFiles, ...build.polyfillFiles];
  const shared = sharedFiles.reduce(
    (acc, f) => {
      const s = assetSize(f);
      return { raw: acc.raw + s.raw, gz: acc.gz + s.gz, files: acc.files + 1 };
    },
    { raw: 0, gz: 0, files: 0 },
  );

  let fontManifest = { app: {} };
  try {
    fontManifest = JSON.parse(readFileSync(path.join(NEXT, "server", "next-font-manifest.json"), "utf8"));
  } catch {
    /* No next/font in the tree; fonts simply report as zero. */
  }

  const routes = [];
  for (const file of walk(path.join(NEXT, "server", "app"), (n) => n === "page_client-reference-manifest.js")) {
    const src = readFileSync(file, "utf8");
    globalThis.__RSC_MANIFEST = {};
    new Function(src)();
    for (const [key, manifest] of Object.entries(globalThis.__RSC_MANIFEST)) {
      const entry = `[project]/app${key}`;
      const route = key.replace(/\/page$/, "") || "/";

      const js = new Set(sharedFiles);
      for (const f of manifest.entryJSFiles?.[entry] ?? []) js.add(f);
      const css = new Set();
      for (const f of manifest.entryCSSFiles?.[entry] ?? []) css.add(f.path);

      const sum = (files) =>
        [...files].reduce(
          (acc, f) => {
            const s = assetSize(f);
            return { raw: acc.raw + s.raw, gz: acc.gz + s.gz };
          },
          { raw: 0, gz: 0 },
        );

      const fonts = (fontManifest.app?.[entry] ?? []).reduce(
        (acc, f) => acc + assetSize(f).raw,
        0,
      );

      /* Project modules only. A `node_modules` entry is React's own client
         runtime and says nothing about this repository's boundaries. */
      const clientModules = [
        ...new Set(
          Object.keys(manifest.clientModules ?? {})
            .filter((m) => !m.includes("node_modules/"))
            .map((m) =>
              m
                .replace("[project]/", "")
                .replace(/ \[app-client\].*$/, "")
                .replace(/ \[app-ssr\].*$/, ""),
            ),
        ),
      ].sort();

      routes.push({
        route,
        js: sum(js),
        css: sum(css),
        fontPreloadBytes: fonts,
        fontPreloadCount: (fontManifest.app?.[entry] ?? []).length,
        clientModules,
      });
    }
  }
  routes.sort((a, b) => b.js.gz - a.js.gz || a.route.localeCompare(b.route));
  return { shared, routes };
}

/* ── client boundary census ────────────────────────────────────────────── */

function collectClientCensus() {
  const sources = [
    ...walk(path.join(ROOT, "app"), (n) => /\.(tsx?|jsx?)$/.test(n)),
    ...walk(path.join(ROOT, "components"), (n) => /\.(tsx?|jsx?)$/.test(n)),
    ...walk(path.join(ROOT, "lib"), (n) => /\.(tsx?|jsx?)$/.test(n)),
  ];
  const marked = [];
  const clientPages = [];
  for (const file of sources) {
    const head = readFileSync(file, "utf8").slice(0, 4096);
    if (!/^\s*(\/\*[\s\S]*?\*\/\s*)*["']use client["']/m.test(head)) continue;
    const rel = path.relative(ROOT, file);
    marked.push(rel);
    if (/^app\/.*\/?page\.tsx$/.test(rel)) clientPages.push(rel);
  }
  marked.sort();
  return { count: marked.length, files: marked, clientPages: clientPages.sort() };
}

/* ── CSS: classes no component names ───────────────────────────────────── */

/**
 * Evidence for CLEAN-008, and only evidence.
 *
 * A CSS Module class is reported unreferenced when no `.ts`/`.tsx` file in the
 * repository contains it after a `styles.` accessor, inside a `styles[...]`
 * index, or as a bare quoted string. That last, deliberately loose, test is
 * what keeps a class built by `styles[`item${n}`]`, passed through a
 * `classNames` map, or named in a `data-` attribute selector from being called
 * dead. It over-reports safety, never under-reports it: a name listed here
 * still has to be read before it is deleted, which is exactly why this script
 * deletes nothing.
 */
function collectCss() {
  const modules = [
    ...walk(path.join(ROOT, "app"), (n) => n.endsWith(".module.css")),
    ...walk(path.join(ROOT, "components"), (n) => n.endsWith(".module.css")),
  ].sort();

  const sources = [
    ...walk(path.join(ROOT, "app"), (n) => /\.tsx?$/.test(n)),
    ...walk(path.join(ROOT, "components"), (n) => /\.tsx?$/.test(n)),
    ...walk(path.join(ROOT, "lib"), (n) => /\.tsx?$/.test(n)),
  ].map((f) => readFileSync(f, "utf8"));
  const haystack = sources.join("\n");

  const files = [];
  let totalLines = 0;
  let totalBytes = 0;
  for (const file of modules) {
    const text = readFileSync(file, "utf8");
    totalLines += text.split("\n").length;
    totalBytes += Buffer.byteLength(text);
    const classes = new Set();
    /* Class selectors only. `:global(...)`, element and attribute selectors
       are not module-scoped and are not this check's business. */
    const stripped = text.replace(/:global\([^)]*\)/g, "");
    for (const m of stripped.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(m[1]);

    const unreferenced = [...classes].filter((name) => {
      if (haystack.includes(`styles.${name}`)) return false;
      if (haystack.includes(`.${name}`) && new RegExp(`\\.${name}\\b`).test(haystack)) return false;
      if (new RegExp(`["'\`]${name}["'\`]`).test(haystack)) return false;
      return true;
    });
    files.push({
      file: path.relative(ROOT, file),
      bytes: Buffer.byteLength(text),
      lines: text.split("\n").length,
      classes: classes.size,
      unreferenced: unreferenced.sort(),
    });
  }

  const emitted = walk(path.join(NEXT, "static"), (n) => n.endsWith(".css")).map((f) => ({
    file: path.relative(NEXT, f),
    raw: statSync(f).size,
    gz: gzipSync(readFileSync(f), { level: 9 }).length,
  }));

  return {
    moduleCount: modules.length,
    sourceLines: totalLines,
    sourceBytes: totalBytes,
    emittedRaw: emitted.reduce((a, e) => a + e.raw, 0),
    emittedGz: emitted.reduce((a, e) => a + e.gz, 0),
    emitted: emitted.sort((a, b) => b.raw - a.raw),
    files: files.sort((a, b) => b.unreferenced.length - a.unreferenced.length),
  };
}

/* ── assets ────────────────────────────────────────────────────────────── */

const ASSET_WARN_BYTES = 512 * 1024;

function collectAssets() {
  const dirs = [path.join(ROOT, "public"), path.join(ROOT, "logos")];
  const media = /\.(png|jpe?g|webp|avif|gif|svg|mp4|webm|mov|woff2?|bin|ktx2)$/i;
  const sources = [
    ...walk(path.join(ROOT, "app"), (n) => /\.(tsx?|css|mjs|json)$/.test(n)),
    ...walk(path.join(ROOT, "components"), (n) => /\.(tsx?|css|mjs|json)$/.test(n)),
    ...walk(path.join(ROOT, "lib"), (n) => /\.(tsx?|css|mjs|json)$/.test(n)),
    ...walk(path.join(ROOT, "scripts"), (n) => /\.(tsx?|mjs|json|sh)$/.test(n)),
  ].map((f) => readFileSync(f, "utf8"));
  const haystack = sources.join("\n");

  const found = [];
  for (const dir of dirs) {
    for (const file of walk(dir, (n) => media.test(n))) {
      const rel = path.relative(ROOT, file);
      const base = path.basename(file);
      const served = rel.replace(/^public/, "");
      /* An asset named by a template literal — `/icons/${item.id}.sdf.png` in
         `particle-nav/config.ts` is the one that matters here — has no literal
         filename to find, so the served directory followed by an interpolation
         counts as a reference. Matching the bare stem instead was tried first
         and was useless: every `public/editorial/*.png` shares a stem with a
         route name, so nothing was ever reported. */
      const interpolated = new RegExp(
        `${path.posix.dirname(served).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^"'\`\\n]*\\$\\{`,
      );
      const referenced = haystack.includes(base) || haystack.includes(served) || interpolated.test(haystack);
      found.push({ file: rel, bytes: statSync(file).size, referenced });
    }
  }
  found.sort((a, b) => b.bytes - a.bytes);
  return {
    total: found.reduce((a, f) => a + f.bytes, 0),
    oversized: found.filter((f) => f.bytes >= ASSET_WARN_BYTES),
    unreferenced: found.filter((f) => !f.referenced && f.bytes >= 4096),
    all: found,
  };
}

/* ── runtime ───────────────────────────────────────────────────────────── */

/**
 * The five numbers that only exist in a browser.
 *
 * `PerformanceObserver` is used for LCP and layout shift because that is what
 * Chrome reports to the field; INP is approximated by driving one real
 * interaction and reading the `event` entry's `duration`, which is the same
 * clock the metric is built on. GPU startup is wall time from navigation to
 * the homepage canvas having painted a frame, which is the number a reader
 * feels. Archive interaction is wall time from a filter keystroke to the
 * record list settling.
 */
async function measureRuntime(base) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const instrument = () => {
    globalThis.__perf = { lcp: 0, cls: 0, inp: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) globalThis.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) globalThis.__perf.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        globalThis.__perf.inp = Math.max(globalThis.__perf.inp, e.duration);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  };

  const visit = async (route) => {
    await page.addInitScript(instrument);
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    /* Layout shift keeps accruing after `networkidle`: fonts swap in and
       below-fold media resolves. A second of quiet is what separates a real
       CLS reading from an optimistic one. */
    await page.waitForTimeout(1000);
    return page.evaluate(() => globalThis.__perf);
  };

  const out = {};

  const home = await visit("/");
  out.home_lcp_ms = Math.round(home.lcp);
  out.home_cls = Number(home.cls.toFixed(4));
  out.home_gpu_first_frame_ms = await page.evaluate(async () => {
    const start = performance.now();
    const canvas = document.querySelector("canvas");
    if (!canvas) return 0;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Math.round(performance.now() - start);
  });

  const reading = await visit("/israels-story");
  out.reading_lcp_ms = Math.round(reading.lcp);
  out.reading_cls = Number(reading.cls.toFixed(4));

  const archive = await visit("/october-7/testimonies");
  out.archive_lcp_ms = Math.round(archive.lcp);
  out.archive_cls = Number(archive.cls.toFixed(4));

  /* One real interaction on the archive filter, timed end to end. */
  const filter = page.locator('input[type="search"], input[type="text"]').first();
  if (await filter.count()) {
    const started = Date.now();
    await filter.click();
    await filter.type("kib", { delay: 30 });
    await page.waitForTimeout(400);
    out.archive_filter_ms = Date.now() - started;
    out.archive_inp_ms = Math.round((await page.evaluate(() => globalThis.__perf)).inp);
  }

  await browser.close();
  return out;
}

/* ── budgets ───────────────────────────────────────────────────────────── */

function loadBudgets() {
  try {
    return JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Compares one measurement against its budget.
 *
 * A budget of `null` means "never measured on a machine we trust". It reports
 * as `uncalibrated` and warns; it does not pass. The only way to a pass is a
 * number somebody ran and committed.
 */
function checkBudget(name, actual, budget, unit) {
  if (budget === null || budget === undefined) {
    return { name, actual, budget: null, unit, state: "uncalibrated" };
  }
  return {
    name,
    actual,
    budget,
    unit,
    state: actual > budget ? "over" : "ok",
    headroom: budget - actual,
  };
}

/* ── output ────────────────────────────────────────────────────────────── */

function renderText(data) {
  const lines = [];
  const p = (s = "") => lines.push(s);

  p(`Shared framework payload: ${kb(data.shared.raw)} kB raw / ${kb(data.shared.gz)} kB gzip across ${data.shared.files} chunks`);
  p();
  p("Route                                                         JS gz     JS raw    CSS gz   Fonts   Client");
  p("-".repeat(108));
  for (const r of data.routes) {
    p(
      `${r.route.padEnd(58)}${kb(r.js.gz).padStart(8)}kB${kb(r.js.raw).padStart(10)}kB${kb(r.css.gz).padStart(9)}kB` +
        `${kb(r.fontPreloadBytes).padStart(8)}kB${String(r.clientModules.length).padStart(8)}`,
    );
  }
  p();
  p(`"use client" files: ${data.client.count}`);
  if (data.client.clientPages.length) {
    p(`Route pages that are themselves client components (${data.client.clientPages.length}):`);
    for (const f of data.client.clientPages) p(`  ${f}`);
  } else {
    p("No app/**/page.tsx is a client component.");
  }
  p();
  p(
    `CSS: ${data.css.moduleCount} modules, ${data.css.sourceLines} source lines, ` +
      `${kb(data.css.emittedRaw)} kB emitted raw / ${kb(data.css.emittedGz)} kB gzip`,
  );
  const dead = data.css.files.filter((f) => f.unreferenced.length);
  p(`CSS Module classes no TSX file names: ${dead.reduce((a, f) => a + f.unreferenced.length, 0)} across ${dead.length} files`);
  for (const f of dead) p(`  ${f.file}  (${f.unreferenced.length}/${f.classes})  ${f.unreferenced.join(" ")}`);
  p();
  p(`Static assets: ${kb(data.assets.total)} kB in public/ and logos/`);
  for (const a of data.assets.oversized) p(`  oversized     ${kb(a.bytes).padStart(9)} kB  ${a.file}`);
  for (const a of data.assets.unreferenced) p(`  unreferenced  ${kb(a.bytes).padStart(9)} kB  ${a.file}`);
  p();
  p("Budgets");
  p("-".repeat(108));
  for (const c of data.checks) {
    const flag = c.state === "over" ? "OVER  " : c.state === "uncalibrated" ? "UNCAL " : "ok    ";
    const budget = c.budget === null ? "(never measured)" : `${c.budget}${c.unit}`;
    p(`  ${flag}${c.name.padEnd(46)} ${String(c.actual).padStart(10)}${c.unit}  budget ${budget}`);
  }
  return lines.join("\n");
}

function renderMarkdown(data) {
  const lines = [];
  const p = (s = "") => lines.push(s);
  p("| Route | First-load JS (gzip) | First-load JS (raw) | Route CSS (gzip) | Preloaded fonts | Client modules |");
  p("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const r of data.routes) {
    p(
      `| \`${r.route}\` | ${kb(r.js.gz)} kB | ${kb(r.js.raw)} kB | ${kb(r.css.gz)} kB | ${kb(r.fontPreloadBytes)} kB | ${r.clientModules.length} |`,
    );
  }
  p();
  p(`Shared framework payload: **${kb(data.shared.raw)} kB raw / ${kb(data.shared.gz)} kB gzip** across ${data.shared.files} chunks.`);
  return lines.join("\n");
}

/* ── main ──────────────────────────────────────────────────────────────── */

requireBuild();

const budgets = loadBudgets() ?? { bundle: {}, runtime: {} };
const { shared, routes } = collectRoutes();
const client = collectClientCensus();
const css = collectCss();
const assets = collectAssets();

const publicRoutes = routes.filter((r) => !/^\/(admin|_|particle-demo)/.test(r.route));
const readingRoutes = publicRoutes.filter(
  (r) => !["/", "/pipeline", "/fake-resistance/network"].includes(r.route),
);
const worstReading = readingRoutes.reduce((a, b) => (b.js.gz > a.js.gz ? b : a), readingRoutes[0]);
const home = routes.find((r) => r.route === "/");

const measured = {
  shared_js_gz_kb: Number(kb(shared.gz)),
  reading_route_js_gz_kb: Number(kb(worstReading.js.gz)),
  home_js_gz_kb: Number(kb(home.js.gz)),
  route_css_gz_kb: Number(kb(Math.max(...publicRoutes.map((r) => r.css.gz)))),
  font_preload_kb: Number(kb(Math.max(...publicRoutes.map((r) => r.fontPreloadBytes)))),
  client_module_files: client.count,
  client_page_components: client.clientPages.length,
};

const checks = [
  checkBudget("shared framework JS", measured.shared_js_gz_kb, budgets.bundle.shared_js_gz_kb, " kB gz"),
  checkBudget("worst public reading route JS", measured.reading_route_js_gz_kb, budgets.bundle.reading_route_js_gz_kb, " kB gz"),
  checkBudget("homepage JS", measured.home_js_gz_kb, budgets.bundle.home_js_gz_kb, " kB gz"),
  checkBudget("worst route CSS", measured.route_css_gz_kb, budgets.bundle.route_css_gz_kb, " kB gz"),
  checkBudget("preloaded fonts per route", measured.font_preload_kb, budgets.bundle.font_preload_kb, " kB"),
  checkBudget('"use client" files', measured.client_module_files, budgets.bundle.client_module_files, " files"),
  checkBudget("client route pages", measured.client_page_components, budgets.bundle.client_page_components, " pages"),
];

let runtime = null;
if (RUNTIME_BASE) {
  runtime = await measureRuntime(RUNTIME_BASE);
  for (const [key, value] of Object.entries(runtime)) {
    const unit = key.endsWith("_ms") ? " ms" : "";
    checks.push(checkBudget(`runtime: ${key}`, value, budgets.runtime[key], unit));
  }
} else if (budgets.runtime && Object.keys(budgets.runtime).length) {
  const calibrated = Object.values(budgets.runtime).filter((v) => v !== null).length;
  checks.push({
    name: `runtime metrics (${calibrated}/${Object.keys(budgets.runtime).length} calibrated)`,
    actual: "not run",
    budget: null,
    unit: "",
    state: "skipped",
  });
}

const data = { shared, routes, client, css, assets, measured, runtime, checks };

if (UPDATE) {
  const next = {
    ...budgets,
    measuredOn: new Date().toISOString().slice(0, 10),
    bundle: { ...budgets.bundle },
    runtime: { ...budgets.runtime },
  };
  for (const [key, value] of Object.entries(measured)) {
    /* Headroom is 5 % on a size and one whole unit on a count, so ordinary
       churn does not turn the build red while a real regression still does.
       A count budget is an integer: "73.5 client files" is not a thing. */
    next.bundle[key] = key.endsWith("_kb") ? Number((value * 1.05).toFixed(1)) : Math.ceil(value) + 1;
  }
  if (runtime) {
    for (const [key, value] of Object.entries(runtime)) {
      next.runtime[key] = key.endsWith("_ms") ? Math.round(value * 1.25) : Number((value * 1.5).toFixed(3));
    }
  }
  writeFileSync(BUDGET_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.error(`Wrote ${path.relative(ROOT, BUDGET_FILE)} — review the diff before committing.`);
}

if (AS_JSON) console.log(JSON.stringify(data, null, 2));
else if (AS_MARKDOWN) console.log(renderMarkdown(data));
else console.log(renderText(data));

const over = checks.filter((c) => c.state === "over");
const uncalibrated = checks.filter((c) => c.state === "uncalibrated");
if (uncalibrated.length && !AS_JSON) {
  console.error(`\n${uncalibrated.length} budget(s) never measured — run with --update-budgets on a machine you trust.`);
}
if (over.length) {
  if (!AS_JSON) console.error(`\n${over.length} budget(s) exceeded.`);
  process.exit(WARN_ONLY || UPDATE ? 0 : 1);
}
