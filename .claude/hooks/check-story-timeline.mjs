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
 *
 * It also prints the intro's derived duration, which is otherwise invisible:
 * the runtime is a function of LINE count, not of anything declared.
 *
 * Reads the PostToolUse payload on stdin; no-ops for any other file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TIMELINE = "components/intro/story-timeline.ts";
const ROLLING = "components/intro/rolling-story-timeline.ts";
const SCENE = "components/intro/lion-scene.tsx";

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
if (!file.replaceAll("\\", "/").endsWith(TIMELINE)) process.exit(0);

const root = file.replaceAll("\\", "/").slice(0, -TIMELINE.length);
const read = (rel) => {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch {
    return "";
  }
};

const src = readFileSync(file, "utf8");
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
for (const [, id] of scene.matchAll(/beatId\s*===\s*"([^"]+)"/g)) {
  if (!beats.some((b) => b.id === id)) {
    errors.push(`  lion-scene.tsx emphasises beatId "${id}", which no beat declares`);
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
/* Cadence is per layout now, so read both. The two totals printed below are
   the thing to watch: the line arrays are art direction and the sentences are
   content, so a growing mobile array must not buy itself more wall clock. */
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
  const total = (n, cadence) => (storyStart + (n - 1) * cadence + tail).toFixed(1);
  const d = beats.reduce((a, b) => a + b.desktop.length, 0);
  const m = beats.reduce((a, b) => a + b.mobile.length, 0);
  note =
    ` — ${d} desktop lines (~${total(d, cadences.desktop)}s),` +
    ` ${m} mobile (~${total(m, cadences.mobile)}s).` +
    ` Verify in real Chrome; the preview pane suspends rAF.`;
}

out({
  systemMessage: `story-timeline ok: ${beats.length} beats, all joins exact${note}`,
  suppressOutput: true,
});
