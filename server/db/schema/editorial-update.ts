import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, nonBlank, primaryId, tsCol, updatedAt } from './_shared';
import type { EditorialFailure, EditorialOperation, EditorialRunStatus, EditorialStage, StartEditorialRun } from '@/server/contracts/editorial-update';

/** A run is independent of the legacy briefing edition and its package format. */
export const editorialRun = pgTable('editorial_run', {
  id: primaryId(),
  runKey: text('run_key').notNull().unique(),
  requestHash: text('request_hash').notNull(),
  mode: text('mode').$type<StartEditorialRun['mode']>().notNull(),
  localDate: date('local_date').notNull(),
  requestedBy: text('requested_by').notNull(),
  request: jsonb('request').$type<StartEditorialRun>().notNull(),
  status: text('status').$type<EditorialRunStatus>().notNull().default('queued'),
  stage: text('stage').$type<EditorialStage>().notNull().default('research'),
  leaseToken: uuid('lease_token'),
  leaseUntil: tsCol('lease_until'),
  failure: jsonb('failure').$type<EditorialFailure>(),
  report: jsonb('report').$type<Record<string, unknown>>(),
  startedAt: tsCol('started_at'),
  finishedAt: tsCol('finished_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [
  nonBlank(t.runKey, 'editorial_run_has_key'),
  nonBlank(t.requestedBy, 'editorial_run_has_actor'),
  check('editorial_run_mode_known', sql`${t.mode} IN ('daily','operations')`),
  check('editorial_run_status_known', sql`${t.status} IN ('queued','running','completed','partial','failed')`),
  check('editorial_run_stage_known', sql`${t.stage} IN ('research','classification','media','publication','homepage','report')`),
  check('editorial_run_hash_valid', sql`${t.requestHash} ~ '^[a-f0-9]{64}$'`),
  check('editorial_run_lease_paired', sql`(${t.leaseToken} IS NULL) = (${t.leaseUntil} IS NULL)`),
  uniqueIndex('editorial_daily_date_once').on(t.localDate).where(sql`${t.mode} = 'daily'`),
  index('editorial_run_pending').on(t.status, t.leaseUntil),
]);

export const editorialOperation = pgTable('editorial_operation', {
  id: primaryId(),
  runId: uuid('run_id').notNull().references(() => editorialRun.id, { onDelete: 'restrict' }),
  operationKey: text('operation_key').notNull(),
  position: integer('position').notNull(),
  inputHash: text('input_hash').notNull(),
  input: jsonb('input').$type<EditorialOperation>().notNull(),
  stage: text('stage').$type<EditorialStage>().notNull().default('media'),
  status: text('status').$type<'pending' | 'running' | 'completed' | 'failed'>().notNull().default('pending'),
  /** Successfully prepared assets and generation identifiers survive worker restarts. */
  artifact: jsonb('artifact').$type<Record<string, unknown>>(),
  result: jsonb('result').$type<Record<string, unknown>>(),
  failure: jsonb('failure').$type<EditorialFailure>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [
  uniqueIndex('editorial_operation_once').on(t.runId, t.operationKey),
  uniqueIndex('editorial_operation_order').on(t.runId, t.position),
  check('editorial_operation_position_positive', sql`${t.position} >= 0`),
  check('editorial_operation_status_known', sql`${t.status} IN ('pending','running','completed','failed')`),
  check('editorial_operation_stage_known', sql`${t.stage} IN ('research','classification','media','publication','homepage','report')`),
  check('editorial_operation_hash_valid', sql`${t.inputHash} ~ '^[a-f0-9]{64}$'`),
]);
export type EditorialRunRow = typeof editorialRun.$inferSelect;
export type EditorialOperationRow = typeof editorialOperation.$inferSelect;
