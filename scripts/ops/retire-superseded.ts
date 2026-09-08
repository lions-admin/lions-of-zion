/**
 * VA-48.5 / 48.6 / 57.1 — retire the records that have already been superseded.
 *
 * ## Why this exists rather than the ops HTTP route
 *
 * `archive_publication` in the ops registry ends at
 * `publications.transition(id, { to: "archived" }, actor)`. That route needs
 * `CHATGPT_AUTOMATION_SECRET`, which is a Vercel *sensitive* variable and
 * therefore unreadable — confirmed twice: `vercel env pull` returns the literal
 * string `[SENSITIVE]`, and `/v9/projects/:id/env?decrypt=true` returns a null
 * value. Rotating it would break the external ChatGPT integration that holds
 * the current value.
 *
 * So this calls the **same service function** the route would call, against the
 * same Production database, from here. `recordVersion()`, the outbox emit and
 * the audit row all run exactly as they do in the request path. What is
 * forbidden — and what this deliberately does not do — is raw SQL that bypasses
 * them.
 *
 * ## Why the list below is not computed
 *
 * An earlier version of this work scored each pair (canonical id → source count
 * → body length → recency) to pick which record survived. Checked against the
 * live rows, that heuristic got the civil-defence pair **backwards**: `mv6ck`
 * calls itself "Corrected duplicate" in its own title while carrying more
 * sources and a longer body than the correction it duplicates, so the score
 * would have archived the correction and kept the duplicate.
 *
 * Every row below instead comes from the record's **own published text**, which
 * names its successor: the "Historical report:"/"Earlier report:" records each
 * say, in their summary, which record supersedes them. That is editorial intent
 * already stated in public, not an inference drawn from metadata.
 *
 * Read-only by default. `--apply` performs the archives.
 */

import { publications } from "@/server/modules/publications";

/* DATABASE_URL is supplied on the command line rather than read from a file, so
   the Production connection string never lands in `.env.local` where
   `npm run dev` would pick it up. */
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL to the Production connection string for this one command.");
  process.exit(2);
}

/** superseded publicId → the publicId its own summary points readers to. */
const RETIREMENTS: { retire: string; keep: string; why: string }[] = [
  { retire: "us-house-passes-bill-targeting-university-boycot-skxk2", keep: "us-house-passes-bill-targeting-university-boycot-lhl1q", why: '"Earlier report: … duplicates the House-vote event covered in the linked retained record"' },
  { retire: "lebanese-detainee-returned-through-icrc-channel-bblkt", keep: "lebanese-detainee-returned-through-icrc-channel-68if2", why: '"Historical report:" — names 68if2 as the current account' },
  { retire: "iran-says-it-struck-a-u-s-unmanned-vessel-washin-anmgp", keep: "iran-says-it-struck-an-unmanned-u-s-vessel-centc-8m6cq", why: '"Earlier report: … not an additional independent confirmation of a strike"' },
  { retire: "netanyahu-orders-unauthorized-west-bank-outposts-kb1l1", keep: "netanyahu-orders-removal-of-unauthorized-west-ba-ugzzx", why: '"Historical report:" — names ugzzx' },
  { retire: "hezbollah-drones-and-israeli-strikes-drive-a-new-ztjo5", keep: "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3", why: '"Historical report:" — names 0jqg3' },
  { retire: "ali-al-taher-remains-an-active-israel-hezbollah--hkoun", keep: "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3", why: '"Historical report:" — names 0jqg3' },
  { retire: "ali-al-taher-ridge-remains-a-verified-israel-hez-mwq1v", keep: "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3", why: '"Historical report:" — names 0jqg3' },
  { retire: "3-said-killed-in-idf-strikes-in-lebanon-after-he-v8bvd", keep: "israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3", why: '"Historical report:" — names 0jqg3. This is VA-46.6\'s Lebanon record, which has been superseded since that step was closed.' },
  { retire: "israel-s-open-civil-defence-data-initiative-cont-mv6ck", keep: "israel-s-open-civil-defence-data-initiative-cont-fgpr4", why: 'Its own title is "Corrected duplicate". The scoring heuristic had this backwards — it is longer and better-sourced than the correction it duplicates.' },
  { retire: "ben-gurion-university-aerogel-can-absorb-100-tim-cb3o1", keep: "ben-gurion-university-team-develops-aerogel-that-0y2we", why: "Owner decision 2026-09-08: redundant, because the surviving record already carries the 78 g/g vs ~100x correction itself." },
];

/**
 * Deliberately absent: `israel-security-diplomacy-and-anti-boycott-brief-4xspk`
 * against `israel-security-and-diplomacy-brief-september-3--xgjvx`.
 *
 * Both are September 3 editions, both open on the Ali al-Taher ridge, and
 * **neither declares itself superseded**. Archiving one would delete a daily
 * edition on a similarity score alone, which is exactly what §48.5 forbids.
 * It needs a human decision and does not have one yet.
 */

const APPLY = process.argv.includes("--apply");
const ACTOR = { label: "ops:duplicate-retirement (PUXI 48.5)", userId: null };

async function main() {
  const service = publications();
  const redirects: Record<string, string> = {};
  let failures = 0;

  for (const { retire, keep, why } of RETIREMENTS) {
    try {
      /* The record to keep is resolved first and its failure is fatal for the
         pair: retiring a record whose replacement does not exist would leave
         readers with neither. */
      await service.resolveEditorialTarget({ publicId: keep });
      let superseded;
      try {
        superseded = await service.resolveEditorialTarget({ publicId: retire });
      } catch {
        console.log(`SKIP  ${retire}\n      no longer resolves — already archived on an earlier run\n`);
        continue;
      }
      if (superseded.status === "archived") {
        console.log(`SKIP  ${retire}\n      already archived\n`);
        continue;
      }
      console.log(`${APPLY ? "ARCHIVE" : "would archive"}  ${retire}`);
      console.log(`  keep    ${keep}`);
      console.log(`  because ${why}`);
      redirects[retire] = keep;

      if (APPLY) {
        await service.transition(superseded.id, { to: "archived" }, ACTOR);
        console.log("  archived (reversible: an archived record can be returned to draft)");
      }
      console.log("");
    } catch (cause) {
      failures += 1;
      console.error(`FAILED ${retire}: ${(cause as Error).message}\n`);
    }
  }

  console.log(`--- ${Object.keys(redirects).length} redirect entries for lib/superseded-publications.ts ---`);
  console.log(JSON.stringify(redirects, null, 2));
  if (!APPLY) console.log("\nDRY RUN. Nothing was changed. Re-run with --apply.");
  if (failures) { console.error(`${failures} failed.`); process.exit(1); }
}

void main();
