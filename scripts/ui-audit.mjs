/**
 * Geometry and structure audit for the UI/UX rebuild.
 *
 * `scripts/ci-smoke.mjs` answers "does the route render without exploding".
 * This answers the questions the rebuild document actually gates on, and that
 * a human cannot answer reliably by looking: is anything interactive sitting
 * outside the viewport, is any control below the coarse-pointer floor, does
 * the heading and landmark structure hold, is focus visible, does the page
 * survive with scripting off.
 *
 * It measures. It does not judge art direction — that is the owner's call and
 * a screenshot's job. Everything reported here is a number with a threshold.
 *
 *   node scripts/ui-audit.mjs                      # default matrix
 *   node scripts/ui-audit.mjs http://localhost:3000 --routes=/pipeline
 *   node scripts/ui-audit.mjs --viewports=320x568,1440x900 --json=out.json
 *
 * Exit code is 1 when any CRITICAL finding is present, so this can gate CI.
 */
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** The nine widths the rebuild document requires for complex routes. */
const REQUIRED_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
];

/** Every other public route gets the two-viewport pass. */
const BASELINE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

/**
 * The complex matrix, verbatim from the document's "Required viewport pass":
 * home, Daily Brief, article detail, Fact Check, Search, Ask, Updates,
 * Support, influence network, Information War, both October 7 indexes and
 * record types, Admin, and Pipeline. Record and article routes are appended
 * at runtime from the imported content, so this cannot rot into checking
 * records that no longer exist.
 */
const COMPLEX = [
  "/",
  "/geopolitical-brief",
  "/fact-check",
  "/search",
  "/ask",
  "/updates",
  "/support-us",
  "/fake-resistance/network",
  "/information-war",
  "/october-7/documentation",
  "/october-7/testimonies",
  "/admin",
  "/admin/login",
  "/pipeline",
];

const SIMPLE = [
  "/account",
  "/corrections",
  "/fake-resistance",
  "/fake-resistance/official-narrative",
  "/fake-resistance/playbook",
  "/fake-resistance/social-media",
  "/israels-story",
  "/methodology",
  "/october-7",
  "/our-heroes",
  "/war-update",
  "/we-are",
];

async function readPackage(pkg) {
  return JSON.parse(
    await readFile(new URL(`../content-packages/${pkg}/index.json`, import.meta.url), "utf8"),
  );
}

/** One real instance per dynamic route family, read from imported content. */
async function sampleDynamicRoutes() {
  const complex = [];
  const simple = [];
  try {
    const [testimonies, documentation] = await Promise.all([
      readPackage("october7"),
      readPackage("hamas-massacre"),
    ]);
    const multi = testimonies.find((e) => e.languages.length > 1) ?? testimonies[0];
    if (multi) {
      complex.push(`/october-7/testimonies/${multi.id}`);
      const other = multi.languages.find((l) => l !== multi.defaultLanguage);
      if (other) simple.push(`/october-7/testimonies/${multi.id}/${other}`);
    }
    const doc = documentation.find((e) => e.category) ?? documentation[0];
    if (doc) {
      complex.push(`/october-7/documentation/${doc.category ?? "uncategorized"}/${doc.id}`);
    }
  } catch {
    console.log("note: october-7 content not imported — archive record routes skipped");
  }
  try {
    const index = await readPackage("fake-resistance");
    const first = index.cases?.[0];
    if (first) simple.push(`/fake-resistance/cases/${first.slug}`);
  } catch {
    console.log("note: fake-resistance research not imported — case route skipped");
  }
  return { complex, simple };
}

/**
 * The whole measurement, evaluated inside the page.
 *
 * Every rule here skips elements that are not actually rendered — zero-size,
 * `display:none`, `visibility:hidden`, `hidden`, `inert`, or inside an
 * `aria-hidden` subtree. A closed drawer parked off-screen is not a defect,
 * and reporting it as one is how a geometry check loses its credibility.
 */
const MEASURE = (enforceTargetFloor) => {
  const vw = window.innerWidth;
  const CONTROL_FLOOR = 44;

  const isRendered = (el) => {
    if (el.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const label = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ");
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text.slice(0, 48)}"` : ""}`;
  };

  const interactive = Array.from(
    document.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [tabindex]:not([tabindex='-1'])",
    ),
  ).filter(isRendered);

  /* A link sitting in running prose is exempt from the target-size floor
     (WCAG 2.5.8 "inline" exception) — enforcing 44px there would wreck the
     editorial typography this rebuild exists to protect. A link that is a
     standalone affordance is not exempt, so the split is by context, not by
     tag. */
  const inlineProse = (el) =>
    el.tagName === "A" && !!el.closest("p, li, blockquote, figcaption, dd, td");

  /**
   * Wide content that scrolls inside its own container is correct design, not
   * a defect — the rebuild document asks for exactly that. What is a defect is
   * content that runs off the page with no way to reach it, including the case
   * where the ROOT hides it with `overflow-x: clip`, which is RESP-002's named
   * failure: the clip suppresses the symptom and leaves the control
   * unreachable.
   *
   * So: find the nearest ancestor that clips horizontally. If it is a real
   * in-page scroller sitting inside the viewport, the element is reachable.
   * If the only thing clipping is the root, it is not.
   */
  const reachableInsideScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p);
      const ox = ps.overflowX;
      if (ox === "visible") continue;
      const pr = p.getBoundingClientRect();
      /* A clipper that itself overflows the viewport does not rescue anything. */
      if (pr.left >= -1 && pr.left + pr.width <= vw + 1) {
        return ox === "auto" || ox === "scroll" || p.scrollWidth > p.clientWidth + 1;
      }
      return false;
    }
    return false;
  };

  const offscreen = [];
  const undersized = [];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    const right = r.left + r.width;
    if ((right > vw + 1 || r.left < -1) && !reachableInsideScroller(el)) {
      offscreen.push({ el: label(el), left: Math.round(r.left), right: Math.round(right) });
    }
    if (enforceTargetFloor && !inlineProse(el) && (r.width < CONTROL_FLOOR || r.height < CONTROL_FLOOR)) {
      undersized.push({
        el: label(el),
        w: Math.round(r.width),
        h: Math.round(r.height),
        inline: false,
      });
    }
  }

  /* Overflow is measured on the scrolling element, but `overflow-x: clip` on
     the root makes scrollWidth lie — it reports the clipped width, so a page
     that overflows looks contained. That is precisely the failure RESP-002
     names. So measure the real content extent from the elements instead. */
  const rootOverflowX = getComputedStyle(document.documentElement).overflowX;
  let widest = { el: null, right: 0 };
  for (const el of document.body.querySelectorAll("*")) {
    if (!isRendered(el)) continue;
    const style = getComputedStyle(el);
    if (style.position === "fixed") continue;
    if (reachableInsideScroller(el)) continue;
    const r = el.getBoundingClientRect();
    const right = r.left + r.width;
    if (right > widest.right) widest = { el: label(el), right: Math.round(right) };
  }

  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .filter(isRendered)
    .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || "").trim().slice(0, 80) }));
  const skips = [];
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i].level - headings[i - 1].level > 1) {
      skips.push(`h${headings[i - 1].level} -> h${headings[i].level} at "${headings[i].text}"`);
    }
  }

  /* A sticky or fixed band that eats most of a short viewport is the
     RESP-004 failure: it does not overlap at 1440x900 and does eat the page
     at 1024x768 or 320x568. Height, not width, is what catches it. */
  const stickyBands = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!isRendered(el)) continue;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (r.height > window.innerHeight * 0.4 && r.width > vw * 0.5) {
      stickyBands.push({
        el: label(el),
        h: Math.round(r.height),
        pct: Math.round((r.height / window.innerHeight) * 100),
      });
    }
  }

  return {
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: vw,
    rootOverflowX,
    widestElement: widest,
    interactiveCount: interactive.length,
    offscreen,
    undersized,
    headings: { h1: headings.filter((h) => h.level === 1).length, total: headings.length, skips },
    landmarks: {
      main: document.querySelectorAll("main, [role=main]").length,
      banner: document.querySelectorAll("header:not([role]), [role=banner]").length,
      contentinfo: document.querySelectorAll("footer:not([role]), [role=contentinfo]").length,
      nav: document.querySelectorAll("nav, [role=navigation]").length,
    },
    lang: {
      root: document.documentElement.lang,
      dir: document.documentElement.dir || "ltr",
      scoped: Array.from(document.querySelectorAll("[lang]"))
        .filter((el) => el !== document.documentElement)
        .map((el) => `${el.tagName.toLowerCase()}[lang=${el.getAttribute("lang")}]`)
        .slice(0, 8),
    },
    stickyBands,
  };
};

/**
 * Focus visibility, checked by actually driving Tab rather than by reading
 * CSS. A focus ring that a `overflow: hidden` ancestor clips is styled
 * correctly and still invisible, and only geometry catches that.
 */
async function auditFocus(page, steps = 25) {
  const problems = [];
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press("Tab");
    /* Tabbing scrolls the target into view; measuring before that settles
       reports the pre-scroll rectangle and invents findings. */
    await page.waitForTimeout(30);
    const state = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ");
      /* A ring is only really cut when the ancestor doing the clipping CANNOT
         scroll the element back into view. An `overflow: auto` scroller that
         has the element parked off to one side is not a defect — tabbing to
         it scrolls it in. Flagging those produced more noise than findings,
         so the axis has to be both clipped and unscrollable to count. */
      const RING = 5; /* --focus-offset 3px + a 2px outline */
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        const pr = p.getBoundingClientRect();
        const cutX =
          (ps.overflowX === "hidden" || ps.overflowX === "clip") &&
          p.scrollWidth <= p.clientWidth + 1 &&
          (r.left < pr.left + RING || r.right > pr.right - RING);
        const cutY =
          (ps.overflowY === "hidden" || ps.overflowY === "clip") &&
          p.scrollHeight <= p.clientHeight + 1 &&
          (r.top < pr.top + RING || r.bottom > pr.bottom - RING);
        if (cutX || cutY) clipped = true;
      }
      /* A borderless input inside a bordered box legitimately suppresses its
         own outline and lets the box carry the ring on `:focus-within`. Only
         reading the focused element calls that pattern unstyled, so look up a
         couple of levels for the indicator before reporting one missing. */
      const hasRing = (node) => {
        const ns = getComputedStyle(node);
        return (
          (ns.outlineStyle !== "none" && ns.outlineWidth !== "0px") || ns.boxShadow !== "none"
        );
      };
      let ringOwner = null;
      let hop = el;
      for (let i = 0; i < 3 && hop && hop !== document.body; i += 1) {
        if (hasRing(hop)) { ringOwner = hop; break; }
        hop = hop.parentElement;
      }

      return {
        el: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${text ? ` "${text.slice(0, 40)}"` : ""}`,
        ring: !!ringOwner,
        /* `input[type=date]` has internal tab stops for its day/month/year
           segments. Moving between them keeps `document.activeElement` on the
           input but stops matching `:focus-visible`, so no `:focus-visible`
           rule applies and the ring correctly disappears. Asking for one there
           is asking the browser to contradict itself. */
        focusVisible: el.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
        inViewport:
          r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0,
        clipped,
        /* A form control's name usually comes from an associated <label>,
           not from its own text — checking only text content reports every
           correctly-labelled input as nameless. Cover both label routes plus
           the ARIA ones, and fall back to a placeholder, which names a
           control weakly but does name it. */
        name: !!(
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          el.getAttribute("title") ||
          (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
          el.closest("label") ||
          el.getAttribute("placeholder") ||
          (el.textContent || "").trim()
        ),
      };
    });
    if (!state) break;
    if (!state.ring && state.focusVisible) problems.push({ kind: "no-focus-ring", ...state });
    if (state.clipped) problems.push({ kind: "focus-ring-clipped", ...state });
    if (!state.name) problems.push({ kind: "no-accessible-name", ...state });
  }
  return problems;
}

const parseViewports = (spec) =>
  spec.split(",").map((s) => {
    const [w, h] = s.split("x").map(Number);
    return { width: w, height: h };
  });

const dynamic = await sampleDynamicRoutes();
const routeFlag = flag("routes");
const viewportFlag = flag("viewports");

const plan = routeFlag
  ? routeFlag.split(",").map((r) => ({
      route: r,
      viewports: viewportFlag ? parseViewports(viewportFlag) : REQUIRED_VIEWPORTS,
    }))
  : [
      ...[...COMPLEX, ...dynamic.complex].map((route) => ({
        route,
        viewports: viewportFlag ? parseViewports(viewportFlag) : REQUIRED_VIEWPORTS,
      })),
      ...[...SIMPLE, ...dynamic.simple].map((route) => ({
        route,
        viewports: viewportFlag ? parseViewports(viewportFlag) : BASELINE_VIEWPORTS,
      })),
    ];

const browser = await chromium.launch({ headless: true });
const results = [];
let critical = 0;
let warnings = 0;

for (const { route, viewports } of plan) {
  for (const viewport of viewports) {
    /* The 44px floor in this codebase is a `@media (pointer: coarse)` rule
       (`--control-h-coarse` in globals.css), and `--control-h-sm` is
       deliberately 36px on a fine pointer. Measuring a phone width with a
       desktop mouse therefore reports hundreds of failures that do not exist
       on any real device. Emulate touch at the widths a touch device actually
       has, and only enforce the floor where the rule applies. */
    const coarse = viewport.width <= 1024;
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      hasTouch: coarse,
      isMobile: coarse && viewport.width <= 932,
    });
    const page = await context.newPage();
    let status = 0;
    let measured = null;
    let focusProblems = [];
    try {
      const response = await page.goto(`${BASE}${route}`, {
        waitUntil: "networkidle",
        timeout: 45000,
      });
      status = response?.status() ?? 0;
      if (status < 400) {
        measured = await page.evaluate(MEASURE, coarse);
        /* Focus is slow, so drive it once per route at the narrowest and the
           widest width rather than at all nine. */
        if (viewport.width === viewports[0].width || viewport.width === 1440) {
          focusProblems = await auditFocus(page);
        }
      }
    } catch (error) {
      measured = { error: String(error).slice(0, 200) };
    }
    await context.close();

    const findings = [];
    if (status >= 400 || status === 0) {
      findings.push({ level: "CRITICAL", kind: "http", detail: `HTTP ${status}` });
    } else if (measured && !measured.error) {
      const overflowBy = measured.widestElement.right - measured.innerWidth;
      if (overflowBy > 1) {
        findings.push({
          level: "CRITICAL",
          kind: "horizontal-overflow",
          detail: `content extends ${overflowBy}px past the viewport (${measured.widestElement.el}); root overflow-x: ${measured.rootOverflowX}`,
        });
      }
      for (const o of measured.offscreen) {
        findings.push({
          level: "CRITICAL",
          kind: "offscreen-control",
          detail: `${o.el} spans ${o.left}..${o.right} in a ${measured.innerWidth}px viewport`,
        });
      }
      for (const u of measured.undersized) {
        findings.push({
          level: "WARNING",
          kind: "undersized-target",
          detail: `${u.el} is ${u.w}x${u.h} (floor 44)`,
        });
      }
      if (measured.headings.h1 !== 1) {
        findings.push({
          level: "CRITICAL",
          kind: "h1-count",
          detail: `${measured.headings.h1} h1 elements (expected exactly 1)`,
        });
      }
      for (const skip of measured.headings.skips) {
        findings.push({ level: "WARNING", kind: "heading-skip", detail: skip });
      }
      if (measured.landmarks.main !== 1) {
        findings.push({
          level: "CRITICAL",
          kind: "main-count",
          detail: `${measured.landmarks.main} main landmarks (expected exactly 1)`,
        });
      }
      if (!measured.lang.root) {
        findings.push({ level: "CRITICAL", kind: "lang", detail: "html has no lang attribute" });
      }
      for (const band of measured.stickyBands) {
        findings.push({
          level: "WARNING",
          kind: "sticky-band",
          detail: `${band.el} is fixed/sticky and covers ${band.pct}% of viewport height`,
        });
      }
      for (const p of focusProblems) {
        findings.push({
          level: p.kind === "no-accessible-name" ? "CRITICAL" : "WARNING",
          kind: p.kind,
          detail: p.el,
        });
      }
    } else if (measured?.error) {
      findings.push({ level: "CRITICAL", kind: "error", detail: measured.error });
    }

    critical += findings.filter((f) => f.level === "CRITICAL").length;
    warnings += findings.filter((f) => f.level === "WARNING").length;

    const tag = `${route} @ ${viewport.width}x${viewport.height}`;
    if (findings.length === 0) {
      console.log(`ok       ${tag}`);
    } else {
      const c = findings.filter((f) => f.level === "CRITICAL").length;
      console.log(`${c > 0 ? "CRITICAL" : "warn    "} ${tag}`);
      /* De-duplicate: one selector failing at four widths is one defect, and
         printing it four times buries the other three. */
      const seen = new Set();
      for (const f of findings) {
        const key = `${f.kind}|${f.detail}`;
        if (seen.has(key)) continue;
        seen.add(key);
        console.log(`  ${f.level === "CRITICAL" ? "!" : "-"} [${f.kind}] ${f.detail}`);
      }
    }

    results.push({ route, viewport, pointer: coarse ? "coarse" : "fine", status, findings, measured });
  }
}

/* The no-JS pass. Reading routes, navigation, archive records and source
   links must survive with scripting off — QA-007. */
const noJsContext = await browser.newContext({
  javaScriptEnabled: false,
  viewport: { width: 390, height: 844 },
});
const noJsPage = await noJsContext.newPage();
const NO_JS_ROUTES = ["/", "/methodology", "/october-7/documentation", "/search", "/updates", "/geopolitical-brief"];
console.log("\n--- no-JavaScript pass (390x844) ---");
for (const route of NO_JS_ROUTES) {
  try {
    const response = await noJsPage.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    const counts = await noJsPage.evaluate(() => ({
      links: document.querySelectorAll("a[href]").length,
      headings: document.querySelectorAll("h1,h2,h3").length,
      main: document.querySelectorAll("main").length,
      /* An unresolved streaming shell means the server sent a hole that only
         script can fill — with scripting off the reader never gets content. */
      suspenseHoles: document.querySelectorAll("div[hidden][id^='S:']").length,
    }));
    const bad = status !== 200 || counts.links === 0 || counts.main !== 1 || counts.suspenseHoles > 0;
    if (bad) critical += 1;
    console.log(
      `${bad ? "CRITICAL" : "ok      "} ${route}: HTTP ${status}, ${counts.links} links, ` +
        `${counts.headings} headings, ${counts.main} main, ${counts.suspenseHoles} unresolved shells`,
    );
  } catch (error) {
    critical += 1;
    console.log(`CRITICAL ${route}: ${error}`);
  }
}
await noJsContext.close();
await browser.close();

const jsonPath = flag("json");
if (jsonPath) {
  await writeFile(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nwrote ${jsonPath}`);
}

console.log(`\n${critical} critical, ${warnings} warning across ${results.length} route/viewport pairs`);
process.exit(critical > 0 ? 1 : 0);
