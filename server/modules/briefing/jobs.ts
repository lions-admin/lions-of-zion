import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { queueClient } from "@/server/core/queue-client";
import { assertBriefingResourceIsolation, briefingFeatures } from "@/server/core/config";
import { briefingLog } from "@/server/core/log";
import { db } from "@/server/db/client";
import { ingestSource } from "@/server/modules/sources/ingest";
import { CONNECTORS } from "@/server/modules/sources/connectors";
import { sourceRepo } from "@/server/modules/sources/repo";
import { shouldCollectSource } from "@/server/modules/sources";
import { briefingRepo } from "@/server/modules/briefing/repo";
import {
  BRIEFING_CONTRACT_VERSION,
  BRIEFING_PROMPT_VERSION,
  briefingService,
  israelLocalHour,
  nextEditorialStage,
} from "@/server/modules/briefing/service";
import type { Source } from "@/server/db/schema";
import type { Actor } from "@/server/core/audit";

export const BRIEFING_JOB_STAGES = ["collect", "enrich", "cluster", "triage", "draft", "quality", "publish"] as const;
export type BriefingJobStage = (typeof BRIEFING_JOB_STAGES)[number];
export const BRIEFING_JOB_CONTRACT_VERSION = 1;
/** Vercel Queue's documented maximum message retention. The job ledger—not
 * the broker—is responsible for longer-lived audit and recovery history. */
export const BRIEFING_QUEUE_RETENTION_SECONDS = 86_400;

export const briefingJobMessageSchema = z.object({
  version: z.literal(BRIEFING_JOB_CONTRACT_VERSION),
  jobId: z.uuid(),
});
export type BriefingJobMessage = z.infer<typeof briefingJobMessageSchema>;

type JobRow = {
  id: string;
  jobKey: string;
  contractVersion: number;
  stage: BriefingJobStage;
  localDate: string;
  sourceId: string | null;
  editionId: string | null;
  state: "pending" | "running" | "completed" | "quarantined";
  attempts: number;
  maxAttempts: number;
  checkpoint: unknown;
};

type Db = { execute: <T>(query: unknown) => Promise<{ rows: T[] }> };

export function briefingJobStore(database: unknown) {
  const d = database as Db;
  return {
    async createCollectJob(source: Source, localDate: string, windowKey: string): Promise<JobRow> {
      const result = await d.execute<JobRow>(sql`
        INSERT INTO briefing_job (
          job_key, contract_version, stage, local_date, source_id, state, available_at
        ) VALUES (
          ${`collect:${source.id}:${windowKey}`}, ${BRIEFING_JOB_CONTRACT_VERSION}, 'collect', ${localDate}, ${source.id}, 'pending', now()
        )
        ON CONFLICT (job_key) DO UPDATE SET updated_at = now()
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      return result.rows[0]!;
    },

    async createStageJob(
      editionId: string,
      localDate: string,
      stage: Exclude<BriefingJobStage, "collect">,
      options: { forceReady?: boolean } = {},
    ): Promise<JobRow> {
      const result = await d.execute<JobRow>(sql`
        INSERT INTO briefing_job (
          job_key, contract_version, stage, local_date, edition_id, state, available_at
        ) VALUES (
          ${`${stage}:${localDate}:v${BRIEFING_JOB_CONTRACT_VERSION}`},
          ${BRIEFING_JOB_CONTRACT_VERSION}, ${stage}, ${localDate}, ${editionId}, 'pending', now()
        )
        ON CONFLICT (job_key) DO UPDATE SET
          state = CASE
            /* This option is used only by the authenticated administrator's
             * explicit "Run now" action. A transient provider failure such
             * as AbortError must be recoverable just as an empty model output
             * is; leaving it quarantined made the control report "queued"
             * while dispatching a job that could never be claimed. */
            WHEN ${options.forceReady ? 1 : 0} = 1
              AND briefing_job.state = 'quarantined'
            THEN 'pending'
            ELSE briefing_job.state
          END,
          attempts = CASE
            WHEN ${options.forceReady ? 1 : 0} = 1
              AND briefing_job.state = 'quarantined'
            THEN 0
            ELSE briefing_job.attempts
          END,
          available_at = CASE
            WHEN ${options.forceReady ? 1 : 0} = 1
              AND briefing_job.state IN ('pending', 'quarantined')
            THEN now()
            ELSE briefing_job.available_at
          END,
          last_error = CASE
            WHEN ${options.forceReady ? 1 : 0} = 1
              AND briefing_job.state IN ('pending', 'quarantined')
            THEN NULL
            ELSE briefing_job.last_error
          END,
          finished_at = CASE
            WHEN ${options.forceReady ? 1 : 0} = 1
              AND briefing_job.state = 'quarantined'
            THEN NULL
            ELSE briefing_job.finished_at
          END,
          updated_at = now()
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      return result.rows[0]!;
    },

    async stageJob(editionId: string, stage: Exclude<BriefingJobStage, "collect">): Promise<JobRow | undefined> {
      const result = await d.execute<JobRow>(sql`
        SELECT id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
        FROM briefing_job
        WHERE edition_id = ${editionId} AND stage = ${stage}
        LIMIT 1
      `);
      return result.rows[0];
    },

    // This preserves the old delivery rows and run/artifact audit trail while
    // making a human-requested regeneration possible after a quality gate
    // quarantines an otherwise unpublished edition.
    async restartStageJob(id: string): Promise<JobRow | undefined> {
      const result = await d.execute<JobRow>(sql`
        UPDATE briefing_job
        SET state = 'pending', attempts = 0, available_at = now(), last_error = NULL,
            finished_at = NULL, updated_at = now()
        WHERE id = ${id}
          AND (state <> 'running' OR lease_until < now())
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      return result.rows[0];
    },

    async pending(limit = 100): Promise<JobRow[]> {
      const result = await d.execute<JobRow>(sql`
        SELECT id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
        FROM briefing_job
        WHERE state = 'pending' AND available_at <= now()
        ORDER BY available_at, created_at
        LIMIT ${limit}
      `);
      return result.rows;
    },

    async collectionJobCount(localDate: string): Promise<number> {
      const result = await d.execute<{ count: number | string }>(sql`
        SELECT count(*) AS count FROM briefing_job
        WHERE local_date = ${localDate} AND stage = 'collect'
      `);
      return Number(result.rows[0]?.count ?? 0);
    },

    async activeCollectionCount(localDate: string): Promise<number> {
      const result = await d.execute<{ count: number | string }>(sql`
        SELECT count(*) AS count
        FROM briefing_job
        WHERE local_date = ${localDate}
          AND stage = 'collect'
          AND state IN ('pending', 'running')
      `);
      return Number(result.rows[0]?.count ?? 0);
    },

    async recoverStale(limit = 100): Promise<JobRow[]> {
      const result = await d.execute<JobRow>(sql`
        UPDATE briefing_job
        SET state = CASE WHEN attempts >= max_attempts THEN 'quarantined' ELSE 'pending' END,
            available_at = now(),
            lease_until = NULL,
            last_error = coalesce(last_error, 'Worker lease expired before completion.'),
            finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE finished_at END,
            updated_at = now()
        WHERE id IN (
          SELECT id
          FROM briefing_job
          WHERE state = 'running' AND lease_until < now()
          ORDER BY lease_until
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      return result.rows;
    },

    /**
     * A deployment can fail closed before it touches any source when a
     * resource label or the dedicated briefing store has not yet been wired.
     * Those jobs are safe to retry exactly once after the configuration has
     * been repaired: no source fetch occurred, and normal evidence
     * de-duplication remains the authority if a delivery did get that far.
     *
     * This deliberately does not revive ordinary source or model failures.
     * The previous failure is retained in the checkpoint for the admin trace.
     */
    async recoverConfigurationFailures(limit = 100): Promise<JobRow[]> {
      const result = await d.execute<JobRow>(sql`
        UPDATE briefing_job
        SET state = 'pending',
            attempts = 0,
            available_at = now(),
            lease_until = NULL,
            heartbeat_at = NULL,
            finished_at = NULL,
            checkpoint = coalesce(checkpoint, '{}'::jsonb) || jsonb_build_object(
              'configurationRecovery', jsonb_build_object(
                'error', last_error,
                'recoveredAt', now()
              )
            ),
            last_error = 'Configuration repaired; collection job queued for one controlled retry.',
            updated_at = now()
        WHERE id IN (
          SELECT id
          FROM briefing_job
          WHERE state = 'quarantined'
            AND stage = 'collect'
            AND coalesce(checkpoint -> 'configurationRecovery', 'null'::jsonb) = 'null'::jsonb
            AND (
              last_error LIKE 'DATABASE_RESOURCE_ENV must equal production%'
              OR last_error LIKE 'BLOB_RESOURCE_ENV must equal production%'
              OR last_error LIKE 'QUEUE_RESOURCE_ENV must equal production%'
              OR last_error LIKE 'SEARCH_RESOURCE_ENV must equal production%'
              OR last_error LIKE 'Vercel Blob: Access denied%'
            )
          ORDER BY finished_at NULLS LAST, created_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      return result.rows;
    },

    /** A manual or scheduled processing resume should not wait for the
     * previous pause backoff. Only editorial work explicitly deferred because
     * processing was disabled is eligible; collection cadence remains intact. */
    async resumePausedProcessing(limit = 100): Promise<JobRow[]> {
      const result = await d.execute<JobRow>(sql`
        UPDATE briefing_job
        SET available_at = now(),
            lease_until = NULL,
            heartbeat_at = NULL,
            last_error = NULL,
            updated_at = now()
        WHERE id IN (
          SELECT id
          FROM briefing_job
          WHERE state = 'pending'
            AND stage <> 'collect'
            AND last_error = 'Briefing processing is paused.'
          ORDER BY available_at, created_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      return result.rows;
    },

    async claim(jobId: string, messageId: string, deliveryCount: number): Promise<{ status: "claimed" | "duplicate" | "busy"; job?: JobRow }> {
      const delivery = await d.execute<{ inserted: boolean }>(sql`
        INSERT INTO briefing_job_delivery (message_id, job_id, delivery_count, status)
        VALUES (${messageId}, ${jobId}, ${deliveryCount}, 'received')
        ON CONFLICT (message_id) DO UPDATE
        SET delivery_count = EXCLUDED.delivery_count,
            status = 'received',
            finished_at = NULL
        WHERE briefing_job_delivery.status NOT IN ('completed', 'quarantined')
        RETURNING true AS inserted
      `);
      if (!delivery.rows[0]?.inserted) return { status: "duplicate" };

      const result = await d.execute<JobRow>(sql`
        UPDATE briefing_job
        SET state = 'running',
            attempts = attempts + 1,
            started_at = coalesce(started_at, now()),
            heartbeat_at = now(),
            lease_until = now() + interval '8 minutes',
            updated_at = now()
        WHERE id = ${jobId}
          AND attempts < max_attempts
          AND (
            (state = 'pending' AND available_at <= now())
            OR (state = 'running' AND lease_until < now())
          )
        RETURNING id,
          job_key AS "jobKey",
          contract_version AS "contractVersion",
          stage,
          local_date AS "localDate",
          source_id AS "sourceId",
          edition_id AS "editionId",
          state,
          attempts,
          max_attempts AS "maxAttempts",
          checkpoint
      `);
      if (result.rows[0]) return { status: "claimed", job: result.rows[0] };

      const current = await d.execute<{ state: string }>(sql`SELECT state FROM briefing_job WHERE id = ${jobId}`);
      const duplicate = ["completed", "quarantined"].includes(current.rows[0]?.state ?? "");
      await d.execute(sql`
        UPDATE briefing_job_delivery
        SET status = ${duplicate ? "duplicate" : "failed"}, finished_at = now()
        WHERE message_id = ${messageId}
      `);
      return { status: duplicate ? "duplicate" : "busy" };
    },

    async heartbeat(jobId: string, checkpoint?: unknown): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_job
        SET heartbeat_at = now(),
            lease_until = now() + interval '8 minutes',
            checkpoint = coalesce(${checkpoint === undefined ? null : JSON.stringify(checkpoint)}::jsonb, checkpoint),
            updated_at = now()
        WHERE id = ${jobId} AND state = 'running'
      `);
    },

    async complete(jobId: string, messageId: string, checkpoint?: unknown): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_job
        SET state = 'completed',
            checkpoint = coalesce(${checkpoint === undefined ? null : JSON.stringify(checkpoint)}::jsonb, checkpoint),
            lease_until = NULL,
            heartbeat_at = now(),
            finished_at = now(),
            last_error = NULL,
            updated_at = now()
        WHERE id = ${jobId}
      `);
      await d.execute(sql`
        UPDATE briefing_job_delivery SET status = 'completed', finished_at = now()
        WHERE message_id = ${messageId}
      `);
    },

    async defer(jobId: string, messageId: string, reason: string): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_job
        SET state = 'pending', attempts = greatest(attempts - 1, 0), available_at = now() + interval '15 minutes',
            lease_until = NULL, heartbeat_at = now(), last_error = ${reason.slice(0, 1_000)}, updated_at = now()
        WHERE id = ${jobId}
      `);
      await d.execute(sql`
        UPDATE briefing_job_delivery SET status = 'deferred', finished_at = now()
        WHERE message_id = ${messageId}
      `);
    },

    async fail(job: JobRow, messageId: string, cause: unknown): Promise<{ quarantined: boolean; retryAfterSeconds: number }> {
      const error = sanitizeError(cause);
      const quarantined = job.attempts >= job.maxAttempts;
      const retryAfterSeconds = retryDelay(job.attempts, job.id);
      await d.execute(sql`
        UPDATE briefing_job
        SET state = ${quarantined ? "quarantined" : "pending"},
            available_at = ${new Date(Date.now() + retryAfterSeconds * 1_000)},
            lease_until = NULL,
            last_error = ${error},
            finished_at = CASE WHEN ${quarantined} THEN now() ELSE finished_at END,
            updated_at = now()
        WHERE id = ${job.id}
      `);
      await d.execute(sql`
        UPDATE briefing_job_delivery
        SET status = ${quarantined ? "quarantined" : "failed"}, finished_at = now()
        WHERE message_id = ${messageId}
      `);
      return { quarantined, retryAfterSeconds };
    },
  };
}

export async function dispatchBriefingJob(job: JobRow): Promise<void> {
  await queueClient.send(`briefing-${job.stage}`, {
    version: BRIEFING_JOB_CONTRACT_VERSION,
    jobId: job.id,
  } satisfies BriefingJobMessage, {
    // Database state is the idempotency authority. A resumed job needs a new
    // queue delivery after a pause or lease recovery, so this key identifies
    // a delivery attempt rather than permanently suppressing the job itself.
    idempotencyKey: `briefing-delivery-${job.id}-${job.attempts}-${crypto.randomUUID()}`,
    // Vercel Queues permits at most 24 hours. The database job ledger is the
    // durable seven-day audit/recovery record; asking the provider for seven
    // days would reject the enqueue and leave a manual run apparently queued.
    retentionSeconds: BRIEFING_QUEUE_RETENTION_SECONDS,
  });
}

export async function processBriefingJob(job: JobRow, actor: Actor): Promise<unknown> {
  if (job.contractVersion !== BRIEFING_JOB_CONTRACT_VERSION) {
    throw new Error(`Unsupported briefing job contract version ${job.contractVersion}.`);
  }
  const requestId = `briefing-job:${job.id}`;
  briefingLog("info", "briefing.job.started", {
    requestId, runId: job.id, stage: job.stage, sourceId: job.sourceId ?? undefined,
    editionId: job.editionId ?? undefined,
  });
  try {
    if (job.stage === "collect") {
      if (!job.sourceId) throw new Error("Collect job has no source ID.");
      const result = await ingestSource(db(), job.sourceId, actor, { requestId });
      briefingLog("info", "briefing.job.completed", { requestId, runId: job.id, stage: job.stage, sourceId: job.sourceId }, { evidenceCreated: result.evidenceCreated });
      return result;
    }
    if (!job.editionId) throw new Error(`Briefing stage ${job.stage} has no edition ID.`);
    const database = db();
    const result = await briefingService(database).runStage(
      job.stage,
      job.localDate,
      actor,
      requestId,
    );
    const next = nextEditorialStage(job.stage);
    const jobs = briefingJobStore(database);
    const shouldAdvance = result.shouldContinue
      || (result.status === "already_run" && await stageCanAdvance(database, job.editionId, job.stage));
    if (shouldAdvance && next) {
      const nextJob = await jobs.createStageJob(job.editionId, job.localDate, next);
      if (nextJob.state !== "completed") await dispatchBriefingJob(nextJob);
    }
    briefingLog("info", "briefing.job.completed", { requestId, runId: job.id, stage: job.stage, editionId: job.editionId }, {
      status: result.status, inputCount: result.inputCount, outputCount: result.outputCount,
    });
    return result;
  } catch (cause) {
    briefingLog("error", "briefing.job.failed", {
      requestId, runId: job.id, stage: job.stage, sourceId: job.sourceId ?? undefined,
      editionId: job.editionId ?? undefined,
    }, { errorClass: cause instanceof Error ? cause.name : "UnknownError" });
    throw cause;
  }
}

export async function enqueueEditorialPipeline(
  now = new Date(),
  options: { force?: boolean; regenerateCompleted?: boolean } = {},
): Promise<{
  status: "queued" | "outside_schedule" | "waiting_for_collection" | "already_completed";
  localDate: string;
  jobId?: string;
  activeCollectionJobs?: number;
}> {
  const localDate = israelCollectionWindow(now).localDate;
  if (!options.force && israelLocalHour(now) !== 7) return { status: "outside_schedule", localDate };

  const database = db();
  const jobs = briefingJobStore(database);
  const window = israelCollectionWindow(now);
  // The editorial cutoff is 07:00 Israel time. On the first scheduler tick,
  // create any due work before examining the ledger; later retries only wait
  // for that fixed packet, never open a new collection window mid-edition.
  if (window.windowKey.endsWith("T07:00") || await jobs.collectionJobCount(localDate) === 0) {
    await enqueueDueCollectionJobs(now);
  }
  const activeCollectionJobs = await jobs.activeCollectionCount(localDate);
  if (activeCollectionJobs > 0) {
    return { status: "waiting_for_collection", localDate, activeCollectionJobs };
  }

  const editions = briefingRepo(database);
  // `ensureEdition` reopens a failed edition for normal scheduler recovery.
  // Preserve the pre-open state so an explicit administrator run can reset
  // downstream artifacts instead of skipping straight to a later stage.
  const editionBeforeForce = options.force ? await editions.editionByDate(localDate) : undefined;
  const editionId = await editions.ensureEdition(localDate, BRIEFING_CONTRACT_VERSION, BRIEFING_PROMPT_VERSION);
  if (options.force) {
    const stages = BRIEFING_JOB_STAGES.filter((candidate) => candidate !== "collect") as Exclude<BriefingJobStage, "collect">[];
    const edition = editionBeforeForce ?? await editions.editionByDate(localDate);
    /* A failed or quarantined edition has no public output. A deliberate
       manual run starts at triage and resets its downstream stages, retaining
       all prior artifacts and delivery audit rows for inspection. */
    const quality = await editions.artifact(editionId, "quality") as { passed?: unknown } | undefined;
    // A first forced regeneration reopens the edition as `processing` but
    // deliberately retains `published_at` until its replacement passes every
    // gate. A second explicit request must therefore still restart from
    // triage rather than treating completed stale jobs as the current edition.
    const regenerateCompleted = options.regenerateCompleted && Boolean(edition?.publishedAt);
    const restartFrom = regenerateCompleted || edition?.status === "quarantined" || edition?.status === "failed" || quality?.passed === false
      ? "triage"
      : undefined;
    if (restartFrom) {
      if (regenerateCompleted) {
        await editions.reopenPublishedEdition(editionId, BRIEFING_CONTRACT_VERSION, BRIEFING_PROMPT_VERSION);
      } else {
        await editions.reopenQuarantinedEdition(editionId);
      }
      const start = stages.indexOf(restartFrom);
      for (const stage of stages.slice(start)) {
        const existing = await jobs.stageJob(editionId, stage);
        if (existing) await jobs.restartStageJob(existing.id);
        await editions.reopenRunForManualRetry(localDate, stage);
      }
      const job = await jobs.stageJob(editionId, restartFrom)
        ?? await jobs.createStageJob(editionId, localDate, restartFrom, { forceReady: true });
      await dispatchBriefingJob(job);
      return { status: "queued", localDate, jobId: job.id };
    }

    /* Continue from the first incomplete durable stage. A completed enrich job
       must not hide a later failed triage/draft job from the administrator's
       explicit “Run now” command. */
    for (const stage of stages) {
      const existing = await jobs.stageJob(editionId, stage);
      if (existing?.state === "completed") continue;
      const job = await jobs.createStageJob(editionId, localDate, stage, { forceReady: true });
      await dispatchBriefingJob(job);
      return { status: "queued", localDate, jobId: job.id };
    }
    return { status: "already_completed", localDate };
  }

  const job = await jobs.createStageJob(editionId, localDate, "enrich");
  if (job.state === "completed") return { status: "already_completed", localDate, jobId: job.id };
  await dispatchBriefingJob(job);
  return { status: "queued", localDate, jobId: job.id };
}

export async function recoverAndDispatchBriefingJobs(limit = 100): Promise<{
  recovered: number;
  configurationRecovered: number;
  processingResumed: number;
  dispatched: number;
  quarantined: number;
}> {
  const database = db();
  const jobs = briefingJobStore(database);
  // Do not revive historical configuration failures until this deployment
  // itself has passed the same isolation gate those jobs originally hit.
  assertBriefingResourceIsolation();
  const configurationRecovered = await jobs.recoverConfigurationFailures(limit);
  const recovered = await jobs.recoverStale(limit);
  const processingResumed = briefingFeatures().processing
    ? await jobs.resumePausedProcessing(Math.max(0, limit - configurationRecovered.length - recovered.length))
    : [];
  const alreadyRecovered = [...configurationRecovered, ...recovered, ...processingResumed];
  const ready = await jobs.pending(Math.max(0, limit - alreadyRecovered.length));
  const candidates = [...alreadyRecovered, ...ready.filter((job) => !alreadyRecovered.some((entry) => entry.id === job.id))];
  let dispatched = 0;
  for (const job of candidates) {
    if (job.state !== "pending") continue;
    if (job.stage !== "collect" && !await editorialJobReadyToDispatch(database, job)) continue;
    await dispatchBriefingJob(job);
    dispatched += 1;
  }
  return {
    recovered: recovered.length,
    configurationRecovered: configurationRecovered.length,
    processingResumed: processingResumed.length,
    dispatched,
    quarantined: recovered.filter((job) => job.state === "quarantined").length,
  };
}

async function editorialJobReadyToDispatch(database: unknown, job: JobRow): Promise<boolean> {
  if (!job.editionId || job.stage === "enrich") return true;
  const previous: Partial<Record<Exclude<BriefingJobStage, "collect">, Exclude<BriefingJobStage, "collect">>> = {
    cluster: "enrich",
    triage: "cluster",
    draft: "triage",
    quality: "draft",
    publish: "quality",
  };
  const prior = previous[job.stage as Exclude<BriefingJobStage, "collect">];
  return prior ? stageCanAdvance(database, job.editionId, prior) : false;
}

async function stageCanAdvance(database: unknown, editionId: string, stage: Exclude<BriefingJobStage, "collect">): Promise<boolean> {
  if (stage === "publish") return false;
  const result = await (database as Db).execute<{ payload: unknown }>(sql`
    SELECT payload FROM briefing_stage_artifact
    WHERE edition_id = ${editionId} AND stage = ${stage}
    ORDER BY artifact_version DESC LIMIT 1
  `);
  const payload = result.rows[0]?.payload as Record<string, unknown> | undefined;
  if (!payload) return false;
  if (stage === "enrich") return Array.isArray(payload.evidenceIds) && payload.evidenceIds.length > 0;
  if (stage === "cluster") return Array.isArray(payload.clusters) && payload.clusters.length > 0;
  if (stage === "triage") return Array.isArray(payload.stories) && payload.stories.length > 0;
  if (stage === "draft") return Boolean(payload.edition);
  return payload.passed === true;
}

export async function enqueueDueCollectionJobs(now = new Date()): Promise<Array<{
  sourceId: string;
  jobId: string;
  status: "queued" | "already_completed" | "dispatch_failed";
  error?: string;
}>> {
  const database = db();
  const jobs = briefingJobStore(database);
  const { localDate, windowKey } = israelCollectionWindow(now);
  const results: Array<{
    sourceId: string;
    jobId: string;
    status: "queued" | "already_completed" | "dispatch_failed";
    error?: string;
  }> = [];
  for (const connector of CONNECTORS) {
    const active = await sourceRepo(database).activeByKind(connector.kind);
    for (const source of active) {
      if (!(await shouldCollectSource(source, now))) continue;
      const job = await jobs.createCollectJob(source, localDate, windowKey);
      if (job.state === "completed") {
        results.push({ sourceId: source.id, jobId: job.id, status: "already_completed" });
        continue;
      }
      try {
        await dispatchBriefingJob(job);
        results.push({ sourceId: source.id, jobId: job.id, status: "queued" });
      } catch (cause) {
        results.push({
          sourceId: source.id,
          jobId: job.id,
          status: "dispatch_failed",
          error: sanitizeError(cause),
        });
      }
    }
  }
  return results;
}

export function israelCollectionWindow(now = new Date()): { localDate: string; windowKey: string } {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0) < 30 ? "00" : "30";
  return { localDate, windowKey: `${localDate}T${String(hour).padStart(2, "0")}:${minute}` };
}

function retryDelay(attempt: number, seed: string): number {
  const base = Math.min(3_600, 30 * 2 ** Math.max(0, attempt - 1));
  const jitter = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % Math.max(1, Math.floor(base * 0.25));
  return base + jitter;
}

function sanitizeError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message
    .replace(/(Bearer|token|api[_-]?key|secret)\s*[:=]?\s*[^\s,;]+/gi, "$1 [redacted]")
    .slice(0, 1_000);
}

export type BriefingJobStore = ReturnType<typeof briefingJobStore>;
