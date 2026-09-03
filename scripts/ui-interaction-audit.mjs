/**
 * Interaction audit: keyboard journeys, disclosures, dialogs, reduced motion.
 *
 * `scripts/ui-audit.mjs` measures a page at rest — geometry, contrast,
 * structure. This one drives it: it opens every disclosure and dialog it can
 * find, tabs through them, presses Escape, and checks that focus went where it
 * should and came back. Those are the questions A11Y-002, A11Y-008, A11Y-010,
 * QA-004 and QA-006 actually ask, and none of them can be answered by looking
 * at a static page.
 *
 *   node scripts/ui-interaction-audit.mjs
 *   node scripts/ui-interaction-audit.mjs http://localhost:3000 --routes=/pipeline
 *
 * Exit code is 1 on any failure, so this can gate CI alongside the geometry
 * audit.
 */
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/**
 * Routes carrying real interaction. A reading route with nothing but links
 * adds nothing here — its keyboard journey is already covered by the geometry
 * audit's focus walk.
 */
const ROUTES = [
  "/",
  "/geopolitical-brief",
  "/search",
  "/ask",
  "/fact-check",
  "/updates",
  "/support-us",
  "/methodology",
  "/october-7",
  "/october-7/documentation",
  "/fake-resistance/network",
  "/pipeline",
  "/admin/login",
];

/**
 * Animations that are allowed to run forever, with the reason.
 *
 * Everything else that loops under `prefers-reduced-motion: reduce` is a
 * defect: §4 of the rebuild document requires a static result that preserves
 * meaning, and `globals.css` carries a global kill switch that is supposed to
 * make that true.
 */
const AMBIENT_EXCEPTIONS = [];

const failures = [];
/* Counted and printed because "0 failures" is worthless if the script opened
   nothing. An earlier version reported a clean run while never opening a
   single dialog — it looked for `[aria-expanded]` and the glossary button does
   not carry one. A pass has to say what it exercised. */
const exercised = { triggers: 0, dialogs: 0, disclosures: 0 };
const note = (route, kind, detail) => {
  failures.push({ route, kind, detail });
  console.log(`  FAIL [${kind}] ${detail}`);
};

/**
 * Every element that opens or expands something.
 *
 * `[aria-expanded]` alone was not enough and the gap was silent: the pipeline
 * glossary button carries no `aria-expanded` — it simply calls `showModal()` —
 * so a first version of this script reported "0 failures" while never opening
 * a single dialog. Buttons that plausibly open one are included by name and by
 * `aria-haspopup` as well, and the run at 390px is what reaches the mobile
 * drawer, which does not exist at desktop width.
 *
 * Anything that submits, navigates or destroys is excluded by construction.
 * This script drives a real browser against real routes; it must not be able
 * to publish or delete something.
 */
const FIND_TRIGGERS = () => {
  const visible = (el) => {
    if (el.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const name = (el) =>
    (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);

  /* Never press these, whatever else they look like. */
  const DESTRUCTIVE = /delete|remove|archive|publish|unpublish|sign out|revoke|reset|clear|send|submit/i;
  const OPENS = /glossary|menu|filter|open|show|explain|share|in this file|all files|options|settings/i;

  const candidates = new Set([
    ...document.querySelectorAll("[aria-expanded], [aria-haspopup], summary"),
  ]);
  for (const el of document.querySelectorAll("button")) {
    if (el.type === "submit" || el.closest("form")) continue;
    if (DESTRUCTIVE.test(name(el))) continue;
    if (OPENS.test(name(el))) candidates.add(el);
  }

  const out = [];
  let i = 0;
  for (const el of candidates) {
    if (!visible(el)) continue;
    if (DESTRUCTIVE.test(name(el))) continue;
    if (el.tagName === "BUTTON" && (el.type === "submit" || el.closest("form"))) continue;
    el.setAttribute("data-audit-id", `t${i}`);
    out.push({
      id: `t${i}`,
      tag: el.tagName.toLowerCase(),
      name: name(el),
      expanded: el.getAttribute("aria-expanded"),
      controls: el.getAttribute("aria-controls"),
      haspopup: el.getAttribute("aria-haspopup"),
    });
    i += 1;
  }
  return out;
};

/** Animations still looping after the browser was told to reduce motion. */
const RUNNING_LOOPS = () => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    const infinite =
      s.animationName !== "none" &&
      s.animationIterationCount.split(",").some((c) => c.trim() === "infinite") &&
      s.animationPlayState !== "paused";
    if (!infinite) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
    out.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} — ${s.animationName}`);
  }
  return [...new Set(out)];
};

/**
 * Information a reader can only get by hovering (RESP-003).
 *
 * A `title` on an interactive element that has no other accessible description
 * is the common case: it is invisible to touch entirely, and most screen
 * readers announce it inconsistently.
 */
const HOVER_ONLY = () => {
  const out = [];
  for (const el of document.querySelectorAll("[title]")) {
    const t = el.getAttribute("title");
    if (!t) continue;
    const own = (el.textContent || "").trim();
    const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    /* RESP-003's line is "no REQUIRED information is tooltip-only". A title
       that supplements a perfectly good visible label — "Open the glossary" on
       a button reading "Glossary" — is not that; it costs a touch reader
       nothing they did not already have. The defect is a title that is the
       only name the control has, because a touch reader never sees it and
       screen readers announce it inconsistently. */
    if (!own && !labelled) {
      out.push(`${el.tagName.toLowerCase()} is named ONLY by title="${t.slice(0, 50)}"`);
    }
  }
  return [...new Set(out)];
};

const browser = await chromium.launch({ headless: true });
const routeFlag = flag("routes");
const routes = routeFlag ? routeFlag.split(",") : ROUTES;

for (const { route, width } of routes.flatMap((route) => [
  { route, width: 390 },
  { route, width: 1440 },
])) {
  console.log(`\n=== ${route} @ ${width}`);
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    reducedMotion: "reduce",
    hasTouch: width <= 1024,
    isMobile: width <= 932,
  });
  const page = await context.newPage();
  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
    if ((res?.status() ?? 0) >= 400) {
      note(route, "http", `HTTP ${res?.status()}`);
      await context.close();
      continue;
    }
  } catch (error) {
    note(route, "load", String(error).slice(0, 120));
    await context.close();
    continue;
  }

  /* ── reduced motion (A11Y-010, QA-006) ───────────────────────────────── */
  const loops = await page.evaluate(RUNNING_LOOPS);
  for (const l of loops) {
    if (AMBIENT_EXCEPTIONS.some((e) => l.includes(e))) continue;
    note(route, "reduced-motion", `still looping under prefers-reduced-motion: ${l}`);
  }

  /* ── hover-only information (RESP-003) ───────────────────────────────── */
  for (const h of await page.evaluate(HOVER_ONLY)) {
    note(route, "hover-only", h);
  }

  /* ── disclosures and dialogs (A11Y-002, A11Y-008, QA-004) ────────────── */
  const triggers = await page.evaluate(FIND_TRIGGERS);
  console.log(`  ${triggers.length} disclosure/dialog trigger(s), ${loops.length} loop(s)`);

  for (const t of triggers) {
    const sel = `[data-audit-id="${t.id}"]`;
    const el = page.locator(sel);
    if ((await el.count()) === 0) continue;

    /* `aria-controls` must point at something that exists. A control naming a
       missing id is a promise the page does not keep. */
    if (t.controls) {
      const ok = await page.evaluate(
        (ids) => ids.split(/\s+/).every((id) => !!document.getElementById(id)),
        t.controls,
      );
      if (!ok) note(route, "aria-controls", `${t.tag} "${t.name}" points at a missing id`);
    }

    if (t.tag === "summary") continue; /* native disclosure; the platform owns it */
    /* A combobox input carries `aria-expanded` for its listbox, but Enter on
       it means submit, not expand. Driving it here tests the wrong contract
       and reports a working search as broken. */
    if (t.tag === "input" || t.tag === "textarea") continue;

    const before = await page.evaluate(() => document.querySelectorAll("dialog[open]").length);
    try {
      await el.focus();
      await el.press("Enter");
      await page.waitForTimeout(350);
    } catch {
      continue;
    }

    const after = await page.evaluate(() => ({
      dialogs: document.querySelectorAll("dialog[open]").length,
      modal: !!document.querySelector("dialog[open]")?.matches(":modal"),
    }));
    const expandedNow = await page.getAttribute(sel, "aria-expanded").catch(() => null);

    if (t.expanded !== null && expandedNow === t.expanded) {
      note(route, "aria-expanded", `${t.tag} "${t.name}" did not change on activation`);
    }

    exercised.triggers += 1;
    const opened = after.dialogs > before;
    if (opened) exercised.dialogs += 1;
    else exercised.disclosures += 1;
    if (!opened) {
      /* A disclosure that reveals inline content, not a dialog. Close it and
         move on — the geometry audit already covers its focus ring. */
      await el.press("Enter").catch(() => {});
      await page.waitForTimeout(150);
      continue;
    }

    /* A dialog must be named, trap focus, close on Escape, and give focus back. */
    const named = await page.evaluate(() => {
      const d = document.querySelector("dialog[open]");
      if (!d) return false;
      if (d.getAttribute("aria-label")) return true;
      const by = d.getAttribute("aria-labelledby");
      return !!(by && by.split(/\s+/).every((id) => document.getElementById(id)));
    });
    if (!named) note(route, "dialog-name", `dialog opened by "${t.name}" has no accessible name`);
    if (!after.modal) {
      note(route, "dialog-modal", `dialog opened by "${t.name}" is not :modal (background not inert)`);
    }

    let escaped = 0;
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const d = document.querySelector("dialog[open]");
        if (!d) return null;
        return d.contains(document.activeElement) || document.activeElement === document.body;
      });
      if (inside === null) break;
      if (inside === false) escaped += 1;
    }
    if (escaped > 0) {
      note(route, "focus-trap", `focus left the dialog opened by "${t.name}" ${escaped}/16 tab stops`);
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = await page.evaluate(() => document.querySelectorAll("dialog[open]").length);
    if (closed >= after.dialogs) {
      note(route, "dialog-escape", `dialog opened by "${t.name}" did not close on Escape`);
      await page.evaluate(() => document.querySelector("dialog[open]")?.close());
      await page.waitForTimeout(150);
      continue;
    }
    const returned = await page.evaluate(
      (id) => document.activeElement?.getAttribute("data-audit-id") === id,
      t.id,
    );
    if (!returned) {
      note(route, "focus-return", `focus did not return to "${t.name}" after Escape`);
    }
  }

  await context.close();
}

await browser.close();

console.log(
  `\nexercised ${exercised.triggers} trigger(s): ` +
    `${exercised.dialogs} opened a dialog, ${exercised.disclosures} toggled inline content`,
);
console.log(`${failures.length} interaction failure(s)`);
if (exercised.dialogs === 0) {
  console.log("  ! no dialog was opened — a clean run here proves nothing about dialogs");
}
if (failures.length > 0) {
  const byKind = {};
  for (const f of failures) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${k}`);
  }
}
process.exit(failures.length > 0 ? 1 : 0);
