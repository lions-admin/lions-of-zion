#!/usr/bin/env node
/**
 * Guards the three couplings in `components/intro/story-timeline.ts` that fail
 * silently — every one of them typechecks, lints and builds clean.
 *
 *   1. Each layout's line array must rejoin to the beat's canonical `text`.
 *      Splitting "A · B · C" across rows drops the separator unless it is kept
 *      on the first row, and nothing catches that but a reader's eye.
 *   2. The beat COUNT is frozen: `STORY_PARAGRAPHS` indexes STORY_BEATS[0..N]
 *      by hand and `STORY_BEAT_STARTS` is a parallel literal array. Adding or
 *      removing a beat leaves both pointing at the wrong thing.
 *   3. `lion-scene.tsx` emphasises one beat by string id. Renaming it drops
 *      the emphasis with no error anywhere.
 *   4. The two layouts' derived durations must stay within 10% of each other,
 *      and neither cadence may fall below the dissolve. The runtime is a
 *      function of LINE count, not of anything declared, so adding one mobile
 *      line silently charges the phone another second for the same sentences.
 *
 * It prints both derived durations for the same reason.
 *
 * Reads the PostToolUse payload on stdin; no-ops for any other file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TIMELINE = "components/intro/story-timeline.ts";
const ROLLING = "components/intro/rolling-story-timeline.ts";
// The renderer that emphasises beats by id. This moved when the intro and the
// navigation were unified onto one canvas; a stale path here silently disabled
// check 3 for months, so an unreadable SCENE is now a hard error, not a skip.
const SCENE = "components/particle-nav/layers/IntroText.tsx";

const out = (obj) => {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
};
const block = (lines) =>
  out({ decision: "block", reason: `story-timeline invariants failed:\n${lines.join("\n")}` });

let payload = "";
for await (const chunk of process.stdin) payload += chunk;

let file = "";
try {
  const p = JSON.parse(payload || "{}");
  file = p.tool_response?.filePath ?? p.tool_input?.file_path ?? "";
} catch {
  process.exit(0); // Malformed payload is the harness's problem, not the copy's.
}
// Either timeline file must re-run every check: ROLLING owns the cadence
// constants that check 2's duration maths reads.
const norm = file.replaceAll("\\", "/");
const matched = [TIMELINE, ROLLING].find((rel) => norm.endsWith(rel));
if (!matched) process.exit(0);

const root = norm.slice(0, -matched.length);
const read = (rel) => {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch {
    return "";
  }
};

const src = read(TIMELINE);
if (!src) process.exit(0); // Nothing to check against.
const rolling = read(ROLLING);
const scene = read(SCENE);

/* ── Parse the beats ───────────────────────────────────────────────────── */
const beatRe =
  /id:\s*"([^"]+)",\s*\n\s*text:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*desktopLines:\s*\[([\s\S]*?)\],\s*\n\s*mobileLines:\s*\[([\s\S]*?)\],/g;
const strRe = /"((?:[^"\\]|\\.)*)"/g;
const unescape = (s) => s.replace(/\\(.)/g, "$1");

const beats = [...src.matchAll(beatRe)].map(([, id, text, d, m]) => ({
  id,
  text: unescape(text),
  desktop: [...d.matchAll(strRe)].map((x) => unescape(x[1])),
  mobile: [...m.matchAll(strRe)].map((x) => unescape(x[1])),
}));

const errors = [];
if (beats.length === 0) block(["  could not parse any beats out of STORY_BEATS"]);

/* ── 1. Joins reproduce the canonical text ─────────────────────────────── */
for (const b of beats) {
  for (const layout of ["desktop", "mobile"]) {
    const joined = b[layout].join(" ");
    if (joined !== b.text) {
      errors.push(
        `  ${b.id} (${layout}) does not rejoin to its text\n` +
          `    text:   ${JSON.stringify(b.text)}\n` +
          `    joined: ${JSON.stringify(joined)}`,
      );
    }
  }
}

/* ── 2. The beat count is pinned by two hand-written arrays ────────────── */
const paragraphRefs = [...src.matchAll(/STORY_BEATS\[(\d+)\]/g)].map((x) => +x[1]);
if (paragraphRefs.length) {
  const highest = Math.max(...paragraphRefs);
  if (highest !== beats.length - 1) {
    errors.push(
      `  STORY_PARAGRAPHS indexes STORY_BEATS[${highest}] but there are ${beats.length} beats` +
        ` (valid indices 0..${beats.length - 1})`,
    );
  }
}
const startsBlock = src.match(/STORY_BEAT_STARTS\s*=\s*\[([\s\S]*?)\]\s*as const/);
if (startsBlock) {
  const n = startsBlock[1].split(",").filter((s) => s.trim()).length;
  if (n !== beats.length) {
    errors.push(`  STORY_BEAT_STARTS has ${n} entries but there are ${beats.length} beats`);
  }
}

/* ── 3. Ids the scene reaches for by name ──────────────────────────────── */
if (!scene) {
  errors.push(`  ${SCENE} is unreadable, so beat-id emphasis is unchecked — repoint SCENE`);
} else {
  // Single or double quotes: the live renderer uses single.
  for (const [, id] of scene.matchAll(/beatId\s*===\s*['"]([^'"]+)['"]/g)) {
    if (!beats.some((b) => b.id === id)) {
      errors.push(`  ${SCENE} emphasises beatId "${id}", which no beat declares`);
    }
  }
}

if (errors.length) block(errors);

/* ── Derived duration ──────────────────────────────────────────────────── */
const num = (name, text) => {
  const m = text.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`));
  return m ? +m[1] : null;
};
const c = (name) => num(name, rolling);
const storyStart = num("RELOCATION_END", src);

let note = "";
/* Cadence is per layout now, so read both. The two totals are the thing to
   watch: the line arrays are art direction and the sentences are content, so
   a growing mobile array must not buy itself more wall clock. Printing them
   was not enough — a mobile array grew to 21 lines and bought 8.75 extra
   seconds with nobody reading the note — so the budget below blocks. */
const DRIFT_BUDGET = 0.1;
const cadences = (() => {
  const m = rolling.match(
    /ROLLING_LINE_CADENCE_BY_LAYOUT[\s\S]*?desktop:\s*([\d.]+),\s*mobile:\s*([\d.]+)/,
  );
  return m ? { desktop: +m[1], mobile: +m[2] } : null;
})();
if (cadences && storyStart !== null) {
  const tail =
    (c("ROLLING_ENTER_DURATION") ?? 0) +
    (c("ROLLING_JOIN_HOLD_DURATION") ?? 0) +
    ((c("ROLLING_WINDOW_SIZE") ?? 4) - 2) * (c("ROLLING_CLEANUP_CADENCE") ?? 0) +
    (c("ROLLING_EXIT_DURATION") ?? 0) +
    (c("ROLLING_CENTER_DURATION") ?? 0) +
    (c("ROLLING_BRAND_DELAY") ?? 0) +
    (c("ROLLING_BRAND_ENTER_DURATION") ?? 0) +
    (c("ROLLING_FINAL_HOLD_DURATION") ?? 0) +
    (c("ROLLING_OUTRO_DURATION") ?? 0);
  const total = (n, cadence) => storyStart + (n - 1) * cadence + tail;
  const d = beats.reduce((a, b) => a + b.desktop.length, 0);
  const m = beats.reduce((a, b) => a + b.mobile.length, 0);
  const desktopTotal = total(d, cadences.desktop);
  const mobileTotal = total(m, cadences.mobile);

  const budget = [];
  /* A cadence below the dissolve retires a line before it has finished
     dispersing: `ROLLING_POOL_SIZE` overruns, `IntroText`'s `index % pool`
     hands one line another's slot, and row 0 gets two dissolving clouds.
     `tests/particle-nav-layout.test.ts` asserts the same thing against the
     solved timeline; this is the copy that fires first, on the edit. */
  const exit = c("ROLLING_EXIT_DURATION");
  if (exit !== null) {
    for (const [layout, cadence] of Object.entries(cadences)) {
      if (cadence + 1e-9 < exit) {
        budget.push(
          `  ${layout} cadence ${cadence}s is below ROLLING_EXIT_DURATION ${exit}s —` +
            ` two lines would dissolve at once, overrunning the sprite pool`,
        );
      }
    }
  }
  const drift = Math.abs(mobileTotal / desktopTotal - 1);
  if (drift > DRIFT_BUDGET + 1e-9) {
    budget.push(
      `  mobile runs ${(drift * 100).toFixed(1)}% off desktop` +
        ` (${mobileTotal.toFixed(1)}s vs ${desktopTotal.toFixed(1)}s), past the` +
        ` ${DRIFT_BUDGET * 100}% budget. The same twelve sentences must not cost` +
        ` the phone more wall clock. Cadence cannot absorb this on its own —` +
        ` it is already at the dissolve floor — so re-break the mobile lines.`,
    );
  }
  if (budget.length) block(budget);

  note =
    ` — ${d} desktop lines (~${desktopTotal.toFixed(1)}s),` +
    ` ${m} mobile (~${mobileTotal.toFixed(1)}s, ${(drift * 100).toFixed(1)}% off).` +
    ` Verify in real Chrome; the preview pane suspends rAF.`;
}

out({
  systemMessage: `story-timeline ok: ${beats.length} beats, all joins exact${note}`,
  suppressOutput: true,
});
