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
  delivery?: EditorialRunDelivery | null;
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

/** A finished run the Action must still report as a failure: the run itself
 *  failed, any operation failed, or the homepage stage did. Partial success
 *  is a valid outcome for the site and still a red Action, on purpose — the
 *  composer has to look. */
export function runFailed(run: PolledRun): boolean {
  return run.status === 'failed'
    || (run.report?.publications?.failed ?? 0) > 0
    || Boolean(run.report?.errors?.some(error => error.stage === 'homepage'));
}

/** The lines printed once, on the terminal state. */
export function formatTerminalReport(run: PolledRun): { out: string[]; err: string[] } {
  const counts = run.report?.publications ?? {};
  const out = [`runId=${run.runId} status=${run.status} created=${counts.created ?? 0} updated=${counts.updated ?? 0} failed=${counts.failed ?? 0}`];
  for (const url of run.report?.urls ?? []) out.push(`url=${url}`);
  const err = (run.report?.errors ?? []).map(error => `error=${error.operationKey ?? 'homepage'} stage=${error.stage} message=${error.message}`);
  if (runFailed(run)) {
    const homepageFailed = run.report?.errors?.some(error => error.stage === 'homepage');
    err.push(`[${homepageFailed ? 'homepage failure' : 'publication execution failure'}] Durable run ${run.runId} finished ${run.status}.`);
  }
  return { out, err };
}

/** Why a timeout is a failure and not a pass: the last thing the poller saw
 *  is the diagnosis, and it goes into the error rather than being lost. */
export function formatTimeout(lastLine: string | null, minutes: number): string {
  return `Timed out after ${minutes} minutes waiting for the editorial run to finish. Last observed: ${lastLine ?? 'no status read succeeded'}`;
}
