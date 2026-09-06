import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { editorialOperation, editorialRun } from '@/server/db/schema';
import { startEditorialRunSchema, type EditorialFailure, type EditorialStage, type StartEditorialRun } from '@/server/contracts/editorial-update';
import { israelEditionDate } from '@/server/contracts/homepage';
import { ApiError, notFound } from '@/server/http/responses';
import { emit, TOPICS } from '@/server/core/outbox';

/** Canonical object keys make semantically identical JSON requests replayable. */
export function editorialInputHash(value: unknown): string {
  const canonical = (input: unknown): unknown => Array.isArray(input)
    ? input.map(canonical)
    : input && typeof input === 'object'
      ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
      : input;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function editorialRepo(db: Database) {
  return {
    async start(raw: StartEditorialRun, actor: string, now = new Date()) {
      const input = startEditorialRunSchema.parse(raw);
      const requestHash = editorialInputHash(input);
      return db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'editorial:' + input.runId}))`);
        const [existing] = await tx.select().from(editorialRun).where(eq(editorialRun.runKey, input.runId));
        if (existing) {
          if (existing.requestHash !== requestHash) throw new ApiError('CONFLICT', 'This run identifier already belongs to a different request.');
          return existing;
        }
        const localDate = israelEditionDate(now);
        if (input.mode === 'daily') {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'editorial:daily:' + localDate}))`);
          const [daily] = await tx.select().from(editorialRun).where(and(eq(editorialRun.localDate, localDate), eq(editorialRun.mode, 'daily')));
          if (daily) return daily;
        }
        const [run] = await tx.insert(editorialRun).values({ runKey: input.runId, requestHash,
          requestedBy: actor, mode: input.mode, localDate, request: input,
          stage: input.mode === 'daily' ? 'research' : 'media' }).returning();
        if (input.operations.length) await tx.insert(editorialOperation).values(input.operations.map((operation, position) => ({
          runId: run.id, operationKey: operation.key, position, inputHash: editorialInputHash(operation), input: operation,
        })));
        await emit(tx as never, TOPICS.editorialRunProcess, { runId: run.id }, { entityType: 'system', entityId: run.id });
        return run;
      });
    },

    async get(id: string) {
      const [run] = await db.select().from(editorialRun).where(eq(editorialRun.id, id));
      if (!run) throw notFound('Editorial run');
      const operations = await db.select().from(editorialOperation).where(eq(editorialOperation.runId, id)).orderBy(asc(editorialOperation.position));
      return { ...run, operations };
    },

    async addOperations(id: string, token: string, operations: StartEditorialRun['operations'], now = new Date()) {
      return db.transaction(async tx => {
        await editorialRepo(tx as unknown as Database).assertLease(id, token, now);
        const existing = await tx.select({ position: editorialOperation.position }).from(editorialOperation)
          .where(eq(editorialOperation.runId, id)).orderBy(desc(editorialOperation.position)).limit(1);
        const offset = existing[0]?.position == null ? 0 : existing[0].position + 1;
        if (operations.length) {
          await tx.insert(editorialOperation).values(operations.map((operation, index) => ({
            runId: id,
            operationKey: operation.key,
            position: offset + index,
            inputHash: editorialInputHash(operation),
            input: operation,
          })));
        }
        await tx.update(editorialRun).set({ stage: 'media', updatedAt: now }).where(eq(editorialRun.id, id));
      });
    },

    async listRecent(limit = 20) {
      const runs = await db.select().from(editorialRun).orderBy(desc(editorialRun.createdAt)).limit(limit);
      if (!runs.length) return [];
      const operations = await db.select().from(editorialOperation)
        .where(inArray(editorialOperation.runId, runs.map(run => run.id)))
        .orderBy(asc(editorialOperation.position));
      return runs.map(run => ({ ...run, operations: operations.filter(operation => operation.runId === run.id) }));
    },

    /** Fencing token prevents an expired worker from completing a reclaimed run. */
    async claim(id: string, now = new Date()) {
      const token = randomUUID();
      const [run] = await db.update(editorialRun).set({ status: 'running', leaseToken: token,
        leaseUntil: new Date(now.getTime() + 300_000), startedAt: sql`coalesce(${editorialRun.startedAt}, ${now.toISOString()}::timestamptz)`, updatedAt: now,
      }).where(and(eq(editorialRun.id, id), or(eq(editorialRun.status, 'queued'),
        and(eq(editorialRun.status, 'running'), lte(editorialRun.leaseUntil, now))))).returning();
      return run ?? null;
    },

    /** Call inside the same transaction as the operation's publication changes. */
    async assertLease(id: string, token: string, now = new Date()) {
      const rows = await db.select().from(editorialRun).where(and(eq(editorialRun.id, id),
        eq(editorialRun.leaseToken, token), eq(editorialRun.status, 'running'))).for('update');
      if (!rows[0]?.leaseUntil || rows[0].leaseUntil <= now) throw new ApiError('CONFLICT', 'The editorial worker lease expired. Resume the run with a new worker.');
      return rows[0];
    },

    async checkpoint(id: string, token: string, stage: EditorialStage, now = new Date()) {
      return db.transaction(async tx => {
        await editorialRepo(tx as unknown as Database).assertLease(id, token, now);
        await tx.update(editorialRun).set({ stage, leaseUntil: new Date(now.getTime() + 300_000), updatedAt: now }).where(eq(editorialRun.id, id));
      });
    },

    async fail(id: string, token: string, failure: EditorialFailure, now = new Date()) {
      return db.transaction(async tx => {
        await editorialRepo(tx as unknown as Database).assertLease(id, token, now);
        const completed = await tx.select({ id: editorialOperation.id }).from(editorialOperation)
          .where(and(eq(editorialOperation.runId, id), eq(editorialOperation.status, 'completed')));
        await tx.update(editorialRun).set({ status: completed.length ? 'partial' : 'failed', stage: failure.stage,
          failure, finishedAt: now, leaseToken: null, leaseUntil: null, updatedAt: now }).where(eq(editorialRun.id, id));
        if (failure.operationKey) await tx.update(editorialOperation).set({ status: 'failed', failure, updatedAt: now })
          .where(and(eq(editorialOperation.runId, id), eq(editorialOperation.operationKey, failure.operationKey),
            inArray(editorialOperation.status, ['pending', 'running', 'failed'])));
      });
    },

    /** Save completed expensive work before attempting publication. */
    async saveArtifact(id: string, token: string, operationKey: string, artifact: Record<string, unknown>, now = new Date()) {
      return db.transaction(async tx => {
        await editorialRepo(tx as unknown as Database).assertLease(id, token, now);
        const [operation] = await tx.update(editorialOperation).set({ artifact, stage: 'publication', status: 'running', updatedAt: now })
          .where(and(eq(editorialOperation.runId, id), eq(editorialOperation.operationKey, operationKey),
            inArray(editorialOperation.status, ['pending', 'running']))).returning();
        if (!operation) throw new ApiError('CONFLICT', 'This operation is not awaiting an artifact.');
        return operation;
      });
    },

    /** The publication and its completion marker share one transaction. */
    async completeOperation(id: string, token: string, operationKey: string,
      publish: (tx: Database) => Promise<Record<string, unknown>>, now = new Date()) {
      return db.transaction(async tx => {
        await editorialRepo(tx as unknown as Database).assertLease(id, token, now);
        const [operation] = await tx.select().from(editorialOperation)
          .where(and(eq(editorialOperation.runId, id), eq(editorialOperation.operationKey, operationKey))).for('update');
        if (!operation) throw notFound('Editorial operation');
        if (operation.status === 'completed') return operation.result!;
        if (operation.status === 'failed') throw new ApiError('CONFLICT', 'Resume this failed operation before publishing.');
        const result = await publish(tx as unknown as Database);
        await tx.update(editorialOperation).set({ result, status: 'completed', stage: 'publication', failure: null, updatedAt: now })
          .where(eq(editorialOperation.id, operation.id));
        return result;
      });
    },

    async finish(id: string, token: string, report: Record<string, unknown>, now = new Date()) {
      return db.transaction(async tx => {
        await editorialRepo(tx as unknown as Database).assertLease(id, token, now);
        const unfinished = await tx.select({ id: editorialOperation.id }).from(editorialOperation)
          .where(and(eq(editorialOperation.runId, id), inArray(editorialOperation.status, ['pending', 'running', 'failed']))).limit(1);
        if (unfinished.length) throw new ApiError('CONFLICT', 'The run still has unfinished operations.');
        const [finished] = await tx.update(editorialRun).set({ status: 'completed', stage: 'report', report,
          failure: null, leaseToken: null, leaseUntil: null, finishedAt: now, updatedAt: now }).where(eq(editorialRun.id, id)).returning();
        await emit(tx as never, TOPICS.editorialRunReport, { runId: finished!.id }, { entityType: 'system', entityId: finished!.id });
        return finished;
      });
    },

    async resume(id: string) {
      return db.transaction(async tx => {
        const [run] = await tx.select().from(editorialRun).where(eq(editorialRun.id, id)).for('update');
        if (!run) throw notFound('Editorial run');
        if (!['failed', 'partial'].includes(run.status)) throw new ApiError('CONFLICT', 'Only a failed or partially completed run can be resumed.');
        await tx.update(editorialOperation).set({ status: 'pending', failure: null, updatedAt: new Date() })
          .where(and(eq(editorialOperation.runId, id), inArray(editorialOperation.status, ['failed', 'running'])));
        const [resumed] = await tx.update(editorialRun).set({ status: 'queued', failure: null, finishedAt: null,
          leaseToken: null, leaseUntil: null, updatedAt: new Date() }).where(eq(editorialRun.id, id)).returning();
        await emit(tx as never, TOPICS.editorialRunProcess, { runId: resumed!.id }, { entityType: 'system', entityId: resumed!.id });
        return resumed;
      });
    },
  };
}
