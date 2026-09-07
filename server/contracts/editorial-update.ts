import { z } from 'zod';
import { createPublicationSchema, updatePublicationSchema } from './publication';
import { externalMediaSchema } from './external-briefing';

/** Persistence and transport parsing for externally composed editorial work. */
export const editorialStageSchema = z.enum(['media', 'publication', 'homepage', 'report']);
export const editorialRunStatusSchema = z.enum(['queued', 'running', 'completed', 'partial', 'failed']);
const keySchema = z.string().trim().min(1).max(200);

const httpUrlSchema = z.string().trim().max(2_000).refine(value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Must be an absolute http(s) URL.');

/**
 * One cited web page, as a composer working from the open web can describe
 * it: the address, what it is called, and the outlet. It becomes a `source`
 * row and an `evidence` row on ingest (`editorial-update/sources.ts`), which
 * is how a record published through this path gets a public source stack
 * without anyone inventing an internal UUID. Everything beyond `url` and
 * `title` is optional on purpose — launch posture, `docs/editorial-dna.md`
 * §11 — and no fetch is made; an excerpt is recorded as read, its absence as
 * discovered.
 */
export const editorialSourceSchema = z.object({
  url: httpUrlSchema,
  title: z.string().trim().min(1).max(500),
  /** The outlet's name; the hostname when omitted. */
  publisher: z.string().trim().min(1).max(200).optional(),
  /** The outlet's front page; the origin of `url` when omitted. Dedup key for the outlet. */
  publisherUrl: httpUrlSchema.optional(),
  /** A government, military or institutional outlet. */
  official: z.boolean().optional(),
  canonicalUrl: httpUrlSchema.optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  excerpt: z.string().trim().min(1).max(10_000).optional(),
  language: z.string().trim().regex(/^[a-z]{2}(-[A-Za-z0-9-]+)*$/).default('en'),
}).strict();
export type EditorialSource = z.infer<typeof editorialSourceSchema>;
/** Optional rather than defaulted: runs recorded before the field existed carry no `sources`, and the executor reads their absence as none. */
export const editorialSourcesSchema = z.array(editorialSourceSchema).max(40).optional();

export const editorialUpdateTargetSchema = z.object({
  publicId: z.string().trim().min(1).max(200).optional(),
  canonicalStoryId: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).optional(),
}).refine(target => Boolean(target.publicId || target.canonicalStoryId), {
  message: 'An editorial update target requires publicId or canonicalStoryId.',
});
export const editorialOperationSchema = z.discriminatedUnion('action', [
  z.object({ key: keySchema, action: z.literal('create'), publication: createPublicationSchema, media: externalMediaSchema.nullable().optional(), sources: editorialSourcesSchema }),
  z.object({ key: keySchema, action: z.literal('update'), publicationId: z.uuid().optional(), target: editorialUpdateTargetSchema.optional(), publication: updatePublicationSchema, media: externalMediaSchema.nullable().optional(), sources: editorialSourcesSchema })
    .refine(operation => Boolean(operation.publicationId || operation.target), {
      message: 'An editorial update requires publicationId or a public identifier target.',
    }),
]);
export const startEditorialRunSchema = z.object({
  runId: keySchema,
  mode: z.literal('operations'),
  operations: z.array(editorialOperationSchema),
  delivery: z.object({
    contractVersion: z.literal('whole-site-update-v1'),
    composer: z.string().trim().min(1).max(200),
    createdAt: z.iso.datetime(),
    homepage: z.unknown(),
    siteRecommendations: z.array(z.string()),
  }).optional(),
}).superRefine((run, ctx) => {
  const keys = run.operations.map(operation => operation.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['operations'], message: 'Operation keys must be unique within the run.' });
});
export const editorialFailureSchema = z.object({
  stage: editorialStageSchema,
  operationKey: keySchema.nullable(),
  message: z.string(),
  recovery: z.string(),
  /** The driver's own words, when the thrown error wrapped another. Drizzle
   * reports a query fault as "Failed query: select …" and puts the reason
   * (permission denied, column does not exist, connection terminated) in
   * `cause`; run `chatgpt-test-2026-09-07-0332-k4m9` failed on exactly such
   * an error and the reason was never recorded anywhere. */
  cause: z.string().optional(),
  /** How many times a worker has attempted this run. Present only on a
   * run-level failure that is being retried, and the bound that eventually
   * makes one terminal. Carried in the failure record rather than a new
   * column so this needs no migration against Production. */
  attempts: z.number().int().positive().optional(),
});
export type EditorialStage = z.infer<typeof editorialStageSchema>;
export type EditorialRunStatus = z.infer<typeof editorialRunStatusSchema>;
export type EditorialOperation = z.infer<typeof editorialOperationSchema>;
export type StartEditorialRun = z.infer<typeof startEditorialRunSchema>;
export type EditorialFailure = z.infer<typeof editorialFailureSchema>;

export const editorialRunMessageSchema = z.object({ runId: z.uuid() });

/**
 * Where a queued run's job intent stands in the outbox, read back for the
 * status endpoint. `publishedAt` set means the drain handed the row to the
 * queue; `attempts` with a `lastError` means the drain tried and the queue
 * refused. Null when no row exists for the run at all, which is itself a
 * finding — `start()` always writes one in the same transaction.
 */
export const editorialRunDeliverySchema = z.object({
  outboxId: z.string(),
  createdAt: z.iso.datetime(),
  availableAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
});
export type EditorialRunDelivery = z.infer<typeof editorialRunDeliverySchema>;

/**
 * One word for "where is my run", finer than `status` alone.
 *
 * `status` says queued / running / terminal; it cannot say whether a queued
 * run is still waiting for the outbox drain, has been handed to the queue and
 * is waiting for a worker, or was handed over and the worker has not claimed
 * it. For two days every run sat `queued` and the poller printed nothing for
 * twenty minutes, because the difference between "not yet drained" and "the
 * queue refuses every send" was visible only in the outbox row. This puts it
 * on the status endpoint, derived and never stored.
 */
export const EDITORIAL_RUN_PHASES = [
  'queued:awaiting-drain',
  'queued:drain-failing',
  'queued:dispatched',
  'running:media',
  'running:publication',
  'running:homepage',
  'running:report',
  'completed',
  'partial',
  'failed',
] as const;
export type EditorialRunPhase = (typeof EDITORIAL_RUN_PHASES)[number];

export function describeEditorialRunPhase(run: { status: string; stage: string }, delivery: Pick<EditorialRunDelivery, 'publishedAt' | 'attempts'> | null): EditorialRunPhase {
  if (run.status === 'completed' || run.status === 'partial' || run.status === 'failed') return run.status;
  if (run.status === 'running') {
    const stage = ['media', 'publication', 'homepage', 'report'].includes(run.stage) ? run.stage : 'media';
    return `running:${stage}` as EditorialRunPhase;
  }
  if (delivery?.publishedAt) return 'queued:dispatched';
  if (delivery && delivery.attempts > 0) return 'queued:drain-failing';
  return 'queued:awaiting-drain';
}

/** The three states a poller may stop on. Anything else keeps polling. */
export function isTerminalEditorialRunStatus(status: string): boolean {
  return status === 'completed' || status === 'partial' || status === 'failed';
}
