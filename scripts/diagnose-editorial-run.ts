/**
 * Print one durable run's full diagnostics. Read-only: a single GET against
 * the authenticated status endpoint, no package, no publication, no write.
 *
 * The secret is read from the environment and never printed; everything this
 * emits comes from the run's own record.
 */

import { formatFailureDiagnostics, formatRunStatusLine, type PolledRun } from './editorial-run-status';

async function main(): Promise<void> {
  const runId = process.argv.slice(2).find(argument => !argument.startsWith('--'));
  if (!runId) {
    console.error('Usage: npm run editorial:diagnose -- <runId>');
    process.exit(2);
  }
  const baseUrl = process.env.EDITORIAL_UPDATE_INGEST_BASE_URL?.trim() || 'https://lionsofzion.io';
  const secret = process.env.EDITORIAL_UPDATE_INGEST_SECRET;
  if (!secret) throw new Error('EDITORIAL_UPDATE_INGEST_SECRET is required to read a run.');

  const url = new URL(`/api/internal/editorial-updates/runs/${encodeURIComponent(runId)}`, baseUrl);
  const response = await fetch(url, { headers: { 'x-editorial-update-secret': secret } });
  if (!response.ok) throw new Error(`Status endpoint returned ${response.status}: ${await response.text()}`);
  const run = await response.json() as PolledRun;

  console.log(formatRunStatusLine(run));
  for (const line of formatFailureDiagnostics(run)) console.log(line);
  /* The stored request is the other half of a contract-drift diagnosis: which
   * fields the run was actually recorded with, as opposed to what the package
   * on the branch says. Printed as a shape, not as content. */
  for (const operation of run.operations ?? []) {
    console.log(`operation ${operation.key ?? '?'} result=${JSON.stringify(operation.result ?? null)}`);
  }
}

main().catch(cause => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
});
