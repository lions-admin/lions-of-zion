/**
 * Entry point for `npm run briefing:publish`.
 *
 * Validates an externally authored Daily Brief package, submits it to
 * `/api/internal/briefing/external-publish`, and verifies the result is
 * publicly visible. It does **no** collection, no source analysis and no
 * drafting: the package is composed outside this repository (by ChatGPT) and
 * arrives here as a finished JSON file. This script is deliberately the dumb
 * half of that split — if it ever starts deciding what the edition says,
 * the boundary has been broken.
 *
 * Must run as `NODE_OPTIONS=--conditions=react-server tsx
 * scripts/publish-briefing-package.ts` — the modules it reaches into start
 * with `import "server-only"`, which that condition satisfies outside Next's
 * own build. See `npm run db:import-public` for the same convention.
 *
 * ## Usage
 *
 *   npm run briefing:publish -- <path-to-package.json> [--dry-run]
 *
 * `--dry-run` validates and prints a summary, then stops before the POST.
 * Use it to check a package ChatGPT produced without publishing anything.
 *
 * ## Environment
 *
 * - `EXTERNAL_BRIEFING_INGEST_SECRET` (required to submit; not needed for
 *   `--dry-run`) — sent as the `x-external-briefing-secret` header.
 * - `BRIEFING_INGEST_BASE_URL` (optional) — defaults to
 *   https://lionsofzion.io. Point it at a preview deployment to rehearse.
 *
 * No AI credential is required or read. That is the point of this script.
 */

import { readFile } from "node:fs/promises";
import { externalBriefingPackageSchema } from "@/server/contracts/external-briefing";
import { submitPackage } from "./external-briefing/submit";
import { verifyPublished } from "./external-briefing/verify";

function usage(): never {
  console.error("Usage: npm run briefing:publish -- <path-to-package.json> [--dry-run]");
  process.exit(2);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const path = argv.find((arg) => !arg.startsWith("--"));
  if (!path) usage();

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    console.error(`Cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (cause) {
    /* Reported separately from schema failure on purpose: a malformed file
     * is a transport/copy-paste problem, a schema failure is an editorial
     * one, and they are fixed by different people. */
    console.error(`${path} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  }

  const parsed = externalBriefingPackageSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error(`${path} does not satisfy the external briefing contract:`);
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    console.error("");
    console.error("Nothing was submitted. Fix the package and run again.");
    process.exit(1);
  }

  const pkg = parsed.data;
  console.log(`Package is valid: runId=${pkg.runId} localDate=${pkg.localDate} composer=${pkg.composer}`);
  console.log(
    `  ${pkg.publishers.length} publisher(s), ${pkg.citations.length} citation(s), ${pkg.articles.length} article(s) plus the Daily Brief`,
  );
  console.log(`  Daily Brief: ${pkg.dailyBrief.title}`);
  for (const article of pkg.articles) {
    const basis = article.citationKeys.length === 0 ? " (unsourced analysis)" : "";
    console.log(`  [${article.section}]${basis} ${article.title}`);
  }

  if (dryRun) {
    console.log("");
    console.log("--dry-run: stopping before submission. Nothing was published.");
    return;
  }

  console.log("");
  const result = await submitPackage(pkg);
  if (!result) return; // submitPackage has logged and set a non-zero exit code.

  console.log("");
  if (!(await verifyPublished(result))) process.exitCode = 1;
}

main().catch((cause) => {
  console.error("publish-briefing-package failed:");
  console.error(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause));
  process.exitCode = 1;
});
