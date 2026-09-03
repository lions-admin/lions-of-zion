/**
 * Entry point for `npm run briefing:compose`.
 *
 * Runs entirely outside the Next.js app (a scheduled GitHub Action): collects
 * public source material, drafts one edition with a single structured AI
 * call, assembles it into the wire contract pinned by
 * `server/contracts/external-briefing.ts`, and POSTs it to
 * `/api/internal/briefing/external-publish`.
 *
 * Must run as `NODE_OPTIONS=--conditions=react-server tsx
 * scripts/external-briefing-compose.ts` — `server/core/ai/gateway.ts` starts
 * with `import "server-only"`, which that condition satisfies outside Next's
 * own build. See `npm run db:import-public` for the same convention.
 *
 * ## CLI flags
 *
 * `--dry-run`  Collect and draft for real, but print the assembled, locally
 *              validated package instead of POSTing it. Exits 0.
 * `--fixture`  Skip the real RSS/API fetch and the real AI call entirely;
 *              run the canned fixture pool and canned draft through the same
 *              assembly and validation code, then print the result. Never
 *              touches the network for drafting or submission, regardless of
 *              `--dry-run`.
 *
 * With neither flag, this collects, drafts, assembles, validates, and — only
 * if validation passes — submits.
 */

import type { ZodError } from "zod";
import { externalBriefingPackageSchema } from "@/server/contracts/external-briefing";
import { collectItems } from "./external-briefing/collect";
import { draftEdition } from "./external-briefing/draft";
import { assemblePackage } from "./external-briefing/assemble";
import { submitPackage } from "./external-briefing/submit";
import { fixtureCollectedItems, fixtureDraftOutput } from "./external-briefing/fixture";

const COMPOSER_LABEL = "github-actions-external-composer";

function reportValidationFailure(error: ZodError): void {
  console.error("Local validation against externalBriefingPackageSchema failed:");
  for (const issue of error.issues) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const fixture = argv.includes("--fixture");

  const collected = fixture ? fixtureCollectedItems() : await collectItemsWithLogging();
  if (!fixture && collected.length === 0) {
    console.error("No usable material was collected (after recency and length filtering). Refusing to draft from an empty pool.");
    process.exitCode = 1;
    return;
  }

  const modelOutput = fixture ? fixtureDraftOutput() : await draftWithLogging(collected);

  const pkg = assemblePackage(collected, modelOutput, COMPOSER_LABEL);

  const parsed = externalBriefingPackageSchema.safeParse(pkg);
  if (!parsed.success) {
    reportValidationFailure(parsed.error);
    process.exitCode = 1;
    return;
  }

  // --fixture never touches the network, for the AI call or the POST,
  // regardless of --dry-run; it always ends by printing.
  if (fixture || dryRun) {
    console.log(JSON.stringify(parsed.data, null, 2));
    return;
  }

  await submitPackage(parsed.data);
}

async function collectItemsWithLogging() {
  console.error("[external-briefing-compose] collecting from RSS and official-API candidates...");
  const items = await collectItems();
  console.error(`[external-briefing-compose] collected ${items.length} usable item(s) after recency/length filtering.`);
  return items;
}

async function draftWithLogging(collected: Awaited<ReturnType<typeof collectItems>>) {
  console.error("[external-briefing-compose] requesting one draft from the model (profile: briefingDraft)...");
  const output = await draftEdition(collected);
  console.error("[external-briefing-compose] draft received.");
  return output;
}

main().catch((cause) => {
  console.error("external-briefing-compose failed:");
  console.error(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause));
  process.exitCode = 1;
});
