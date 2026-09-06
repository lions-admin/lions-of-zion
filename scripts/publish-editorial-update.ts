/** Validate, submit and poll one whole-site editorial package. It deliberately
 * has no database, model or content-generation capability. */

import { readFile } from 'node:fs/promises';
import { wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';
import { formatRunStatusLine, formatTerminalReport, formatTimeout, isTerminal, type PolledRun } from './editorial-run-status';

function usage(): never {
  console.error('Usage: npm run editorial:publish -- <path-to-package.json> [--dry-run]');
  process.exit(2);
}

function fail(stage: string, detail: string): never {
  throw new Error(`[${stage}] ${detail}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const path = args.find(arg => !arg.startsWith('--'));
  if (!path) usage();
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    console.error(`Cannot parse ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  }
  const parsed = wholeSiteUpdatePackageSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`${path} does not satisfy whole-site-update-v1:`);
    for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    process.exit(1);
  }
  const pkg = parsed.data;
  console.log(`runId=${pkg.runId} composer=${pkg.composer} creates=${pkg.creates.length} updates=${pkg.updates.length}`);
  console.log(`homepage=${Object.keys(pkg.homepage).length} recommendations=${pkg.siteRecommendations.length}`);
  if (dryRun) return;

  const baseUrl = process.env.EDITORIAL_UPDATE_INGEST_BASE_URL?.trim() || 'https://lionsofzion.io';
  const secret = process.env.EDITORIAL_UPDATE_INGEST_SECRET;
  if (!secret) fail('configuration', 'EDITORIAL_UPDATE_INGEST_SECRET is required to submit a package.');
  const ingestUrl = new URL('/api/internal/editorial-updates/ingest', baseUrl);
  const submitted = await fetch(ingestUrl, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-editorial-update-secret': secret }, body: JSON.stringify(pkg),
  });
  if (!submitted.ok) fail('ingest rejection', `HTTP ${submitted.status}: ${await submitted.text()}`);
  const accepted = await submitted.json() as { runId: string; statusUrl: string };
  console.log(`accepted runId=${accepted.runId}`);
  const statusUrl = new URL(accepted.statusUrl, baseUrl);
  const timeoutMinutes = 20;
  const deadline = Date.now() + timeoutMinutes * 60_000;
  /* Twenty minutes is a safety boundary, not a budget: a package of a few
     records finishes in well under one. A run that is still queued at the
     end of it is a delivery fault, and the last line says which kind. */
  let lastLine: string | null = null;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5_000));
    const response = await fetch(statusUrl, { headers: { 'x-editorial-update-secret': secret } });
    if (!response.ok) fail('polling/status failure', `HTTP ${response.status}: ${await response.text()}`);
    const result = await response.json() as PolledRun;
    const line = formatRunStatusLine(result);
    if (line !== lastLine) {
      console.log(line);
      lastLine = line;
    }
    if (!isTerminal(result)) continue;
    const { out, err } = formatTerminalReport(result);
    for (const entry of out) console.log(entry);
    for (const entry of err) console.error(entry);
    if (err.length) process.exitCode = 1;
    return;
  }
  fail('timeout', formatTimeout(lastLine, timeoutMinutes));
}

main().catch(cause => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
});
