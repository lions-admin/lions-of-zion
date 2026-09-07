/**
 * What the publisher prints while it polls, and when it stops.
 *
 * Pure so a test can drive it without a network: the publisher script owns
 * the fetch loop, this file owns the judgement. Until 2026-09-07 the loop
 * printed `accepted runId=…` and then nothing for twenty minutes, so an
 * operator reading the Action could not tell a run waiting for the outbox
 * drain from one the queue was refusing from one a worker had crashed
 * inside. Every observed transition is one line now, and an unchanged state
 * is silence — not a line every five seconds.
 */

import { describeEditorialRunPhase, isTerminalEditorialRunStatus, type EditorialRunDelivery } from '@/server/contracts/editorial-update';

export type PolledRun = {
  runId: string;
  status: string;
  stage?: string;
  phase?: string;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  delivery?: EditorialRunDelivery | null;
  /** The run-level failure: the whole diagnosis when no operation failed. */
  failure?: { stage?: string; operationKey?: string | null; message?: string; recovery?: string } | null;
  operations?: Array<{
    key?: string; status?: string; stage?: string;
    failure?: { stage?: string; message?: string; recovery?: string } | null;
    result?: { publicId?: string; url?: string; sources?: number } | null;
  }>;
  report?: {
    publications?: { created?: number; updated?: number; failed?: number };
    urls?: string[];
    errors?: Array<{ operationKey: string | null; stage: string; message: string }>;
  } | null;
};

/** The server's own phase when it sends one; derived the same way otherwise,
 *  so an older deployment's status body still reads sensibly. */
export function phaseOf(run: PolledRun): string {
  return run.phase ?? describeEditorialRunPhase({ status: run.status, stage: run.stage ?? 'media' }, run.delivery ?? null);
}

/** One line per state. Equal lines mean "nothing changed", so the caller
 *  compares this and stays quiet — a poller that prints identical lines is
 *  noise, and a poller that prints nothing is the fault this file exists to fix. */
export function formatRunStatusLine(run: PolledRun): string {
  const phase = phaseOf(run);
  const parts = [`runId=${run.runId}`, `status=${run.status}`, `phase=${phase}`];
  const delivery = run.delivery;
  if (delivery && !delivery.publishedAt) {
    parts.push(`outboxAttempts=${delivery.attempts}`);
    if (delivery.lastError) parts.push(`outboxError=${JSON.stringify(delivery.lastError.slice(0, 200))}`);
  }
  return parts.join(' ');
}

export function isTerminal(run: PolledRun): boolean {
  return isTerminalEditorialRunStatus(run.status);
}

/**
 * The Action is red only when publication execution failed or the durable run
 * itself failed. Homepage placement refusals are editorial warnings: a bad or
 * ineligible slot must not erase a successful article publication, and the
 * automatic homepage selection remains the safe fallback.
 */
export function runFailed(run: PolledRun): boolean {
  return run.status === 'failed'
    || (run.report?.publications?.failed ?? 0) > 0
    || Boolean(run.report?.errors?.some(error => error.stage !== 'homepage'));
}

/** The lines printed once, on the terminal state. */
export function formatTerminalReport(run: PolledRun): { out: string[]; err: string[] } {
  const counts = run.report?.publications ?? {};
  const out = [`runId=${run.runId} status=${run.status} created=${counts.created ?? 0} updated=${counts.updated ?? 0} failed=${counts.failed ?? 0}`];
  for (const url of run.report?.urls ?? []) out.push(`url=${url}`);

  const errors = run.report?.errors ?? [];
  for (const error of errors.filter(error => error.stage === 'homepage')) {
    out.push(`warning=${error.operationKey ?? 'homepage'} stage=${error.stage} message=${error.message}`);
  }
  const err = errors
    .filter(error => error.stage !== 'homepage')
    .map(error => `error=${error.operationKey ?? 'run'} stage=${error.stage} message=${error.message}`);

  if (runFailed(run)) {
    /* Everything the run knows, before the summary line — a terminal failure
     * used to print only "Durable run … finished failed", which for a
     * run-level failure meant the exception never left the database. */
    err.push(...formatFailureDiagnostics(run));
    err.push(`[publication execution failure] Durable run ${run.runId} finished ${run.status}.`);
  }
  return { out, err };
}

/** Why a timeout is a failure and not a pass: the last thing the poller saw
 *  is the diagnosis, and it goes into the error rather than being lost. */
export function formatTimeout(lastLine: string | null, minutes: number): string {
  return `Timed out after ${minutes} minutes waiting for the editorial run to finish. Last observed: ${lastLine ?? 'no status read succeeded'}`;
}

/**
 * The diagnosis, printed when a run ends badly.
 *
 * Deliberately verbose and deliberately field-by-field: the failure that
 * prompted it (`chatgpt-test-2026-09-07-0332-k4m9`) ended
 * `created=0 updated=0 failed=0` with no operation marked failed, so every
 * line here — the run-level failure record, each operation's own state, the
 * outbox row — is a place the cause could be hiding. Nothing here reads an
 * environment value or a header, so there is no secret to leak.
 */
export function formatFailureDiagnostics(run: PolledRun): string[] {
  const lines: string[] = [`--- diagnostics for ${run.runId} ---`];
  const counts = run.report?.publications ?? {};
  lines.push(`status=${run.status} stage=${run.stage ?? 'unknown'} phase=${phaseOf(run)}`);
  lines.push(`created=${counts.created ?? 0} updated=${counts.updated ?? 0} failed=${counts.failed ?? 0} requested=${run.operations?.length ?? 'unknown'}`);
  lines.push(`createdAt=${run.createdAt ?? 'unrecorded'} startedAt=${run.startedAt ?? 'unrecorded'} finishedAt=${run.finishedAt ?? 'unrecorded'}`);

  if (run.failure) {
    lines.push(`failure.stage=${run.failure.stage ?? 'unrecorded'}`);
    lines.push(`failure.operationKey=${run.failure.operationKey ?? 'none (run-level)'}`);
    lines.push(`failure.message=${run.failure.message ?? 'unrecorded'}`);
    lines.push(`failure.recovery=${run.failure.recovery ?? 'unrecorded'}`);
  } else {
    lines.push('failure=none recorded on the run');
  }

  for (const operation of run.operations ?? []) {
    const detail = operation.failure
      ? `stage=${operation.failure.stage ?? '?'} message=${operation.failure.message ?? '?'} recovery=${operation.failure.recovery ?? '?'}`
      : operation.result
        ? `publicId=${operation.result.publicId ?? '?'} sources=${operation.result.sources ?? 0}`
        : 'no result and no failure recorded';
    lines.push(`operation ${operation.key ?? '?'} status=${operation.status ?? '?'} stage=${operation.stage ?? '?'} ${detail}`);
  }

  const delivery = run.delivery;
  if (delivery) {
    lines.push(`outbox id=${delivery.outboxId} publishedAt=${delivery.publishedAt ?? 'not dispatched'} attempts=${delivery.attempts}${delivery.lastError ? ` lastError=${delivery.lastError.slice(0, 300)}` : ''}`);
  }
  lines.push('--- end diagnostics ---');
  return lines;
}
