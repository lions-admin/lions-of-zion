#!/usr/bin/env node
/**
 * VA-48.5 — resolve the duplicate canonical stories VA-48.4's sweep found.
 *
 * Goes through the authorized ops path (`POST /api/internal/chatgpt/actions`),
 * never through the database. Every call is audit-recorded server-side, and
 * the retirement it performs is `archive_publication` — a transition to
 * `archived`, which is reversible back to draft. Nothing here can delete.
 *
 * The secret is read from the environment and never printed. Put it in
 * `.env.local` (gitignored) as CHATGPT_AUTOMATION_SECRET_PROD, or export it
 * for one command.
 *
 *   node scripts/ops/dedupe-publications.mjs                 # dry run
 *   node scripts/ops/dedupe-publications.mjs --apply         # perform it
 *   node scripts/ops/dedupe-publications.mjs --only=1,3      # a subset
 *
 * Dry run is the default on purpose: it resolves both records of every pair,
 * shows which one it would keep and why, and writes the redirect entries the
 * merge will require — so the decision is reviewable before anything moves.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { argv, env, exit } from "node:process";

const BASE = env.OPS_BASE_URL ?? "https://lionsofzion.io";

/**
 * The pairs VA-48.4 confirmed, in the order the sweep tabulated them.
 *
 * `certain` are exact-title, same-section matches. `strong` are near-identical
 * wordings of the same event. The two pairs the heuristic flagged that are NOT
 * duplicates — the 6 September briefing against the 3 September briefs — are
 * deliberately absent; they are different daily editions and merging them
 * would destroy a real record. Do not add them.
 */
const PAIRS = [
  { n: 1, confidence: "certain", section: "israel_update", ids: ["us-house-passes-bill-targeting-university-boycot-lhl1q", "us-house-passes-bill-targeting-university-boycot-skxk2"] },
  { n: 2, confidence: "certain", section: "israel_update", ids: ["lebanese-detainee-returned-through-icrc-channel-68if2", "lebanese-detainee-returned-through-icrc-channel-bblkt"] },
  { n: 3, confidence: "certain", section: "daily_brief", ids: ["israel-s-open-civil-defence-data-initiative-cont-fgpr4", "israel-s-open-civil-defence-data-initiative-cont-mv6ck"] },
  { n: 4, confidence: "strong", overlap: 0.88, section: "influence_investigation", ids: ["iran-says-it-struck-an-unmanned-u-s-vessel-centc-8m6cq", "iran-says-it-struck-a-u-s-unmanned-vessel-washin-anmgp"] },
  { n: 5, confidence: "strong", overlap: 0.88, section: "israel_update", ids: ["ali-al-taher-remains-an-active-israel-hezbollah--hkoun", "ali-al-taher-ridge-remains-a-verified-israel-hez-mwq1v"] },
  { n: 6, confidence: "strong", overlap: 1.0, section: "daily_brief", ids: ["israel-security-diplomacy-and-anti-boycott-brief-4xspk", "israel-security-and-diplomacy-brief-september-3--xgjvx"] },
  { n: 7, confidence: "strong", overlap: 0.67, section: "news", ids: ["netanyahu-orders-unauthorized-west-bank-outposts-kb1l1", "netanyahu-orders-removal-of-unauthorized-west-ba-ugzzx"] },
  { n: 8, confidence: "strong", overlap: 0.62, section: "news", ids: ["israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3", "hezbollah-drones-and-israeli-strikes-drive-a-new-ztjo5"] },
];

function secret() {
  const direct = env.CHATGPT_AUTOMATION_SECRET_PROD ?? env.CHATGPT_AUTOMATION_SECRET;
  if (direct) return direct;
  try {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.startsWith("CHATGPT_AUTOMATION_SECRET_PROD="));
    if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch { /* no .env.local is a normal state */ }
  console.error(
    "No ops secret found. Set CHATGPT_AUTOMATION_SECRET_PROD in .env.local (gitignored) or in the environment.\n"
    + "It is the Production value of CHATGPT_AUTOMATION_SECRET, which is a Vercel sensitive var and cannot be read back from Vercel.",
  );
  exit(2);
}

async function tool(name, args) {
  const response = await fetch(`${BASE}/api/internal/chatgpt/actions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chatgpt-automation-secret": secret() },
    body: JSON.stringify({ tool: name, args }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

/** Resolves a publicId to the full record, via the automation route's own resolver. */
async function findByPublicId(publicId) {
  const response = await fetch(`${BASE}/api/internal/chatgpt/publications/${encodeURIComponent(publicId)}`, {
    headers: { "x-chatgpt-automation-secret": secret() },
  });
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) throw new Error(`lookup ${publicId} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text);
  return body?.data ?? body;
}

/**
 * Which record of a pair to keep.
 *
 * Ordered by what actually makes a record the better public copy, not by
 * recency alone: a record that already carries a canonical story id is the one
 * other things point at; sources are the site's whole claim to authority; a
 * longer body is usually the fuller account; and only then, the later update.
 * The reasoning is printed for every pair so a wrong call is visible before
 * --apply, not after.
 */
function chooseCanonical(a, b) {
  const score = (r) => [
    r?.canonicalStoryId ? 1 : 0,
    (r?.evidenceIds?.length ?? r?.sources?.length ?? 0),
    (r?.body?.length ?? 0),
    Date.parse(r?.updatedAt ?? r?.publishedAt ?? 0) || 0,
  ];
  const [sa, sb] = [score(a), score(b)];
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) {
      const keep = sa[i] > sb[i] ? a : b;
      const why = ["carries a canonical story id", "cites more sources", "has the fuller body", "was updated later"][i];
      return { keep, retire: keep === a ? b : a, why };
    }
  }
  return { keep: a, retire: b, why: "indistinguishable on every signal — kept the first, review this one by hand" };
}

const apply = argv.includes("--apply");
const onlyArg = argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map(Number)) : null;

const redirects = {};
let failures = 0;

for (const pair of PAIRS) {
  if (only && !only.has(pair.n)) continue;
  const label = `#${pair.n} [${pair.confidence}${pair.overlap ? ` ${pair.overlap}` : ""}] ${pair.section}`;
  try {
    const [a, b] = await Promise.all(pair.ids.map(findByPublicId));
    if (!a || !b) {
      console.log(`${label}\n  SKIP — ${!a ? pair.ids[0] : pair.ids[1]} no longer resolves (already merged, or archived).\n`);
      continue;
    }
    const { keep, retire, why } = chooseCanonical(a, b);
    console.log(`${label}`);
    console.log(`  keep    ${keep.publicId}  (${why})`);
    console.log(`  retire  ${retire.publicId}`);
    redirects[retire.publicId] = keep.publicId;

    if (!apply) { console.log("  dry run — nothing changed\n"); continue; }

    await tool("archive_publication", { id: retire.id });
    console.log(`  archived ${retire.publicId} -> reversible transition to 'archived'\n`);
  } catch (cause) {
    failures += 1;
    console.error(`${label}\n  FAILED: ${cause.message}\n`);
  }
}

const out = "scripts/ops/dedupe-redirects.json";
writeFileSync(out, `${JSON.stringify(redirects, null, 2)}\n`);
console.log(`Redirect entries for lib/superseded-publications.ts written to ${out} (${Object.keys(redirects).length} pairs).`);
if (!apply) console.log("This was a DRY RUN. Re-run with --apply to perform the archives.");
if (failures) { console.error(`${failures} pair(s) failed.`); exit(1); }
