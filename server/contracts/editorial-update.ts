import { z } from 'zod';
import { createPublicationSchema, updatePublicationSchema } from './publication';
import { externalMediaSchema } from './external-briefing';

/** Persistence and transport parsing only; no editorial scoring or quotas. */
export const editorialStageSchema = z.enum(['research', 'classification', 'media', 'publication', 'homepage', 'report']);
export const editorialRunStatusSchema = z.enum(['queued', 'running', 'completed', 'partial', 'failed']);
const keySchema = z.string().trim().min(1).max(200);
export const editorialOperationSchema = z.discriminatedUnion('action', [
  z.object({ key: keySchema, action: z.literal('create'), publication: createPublicationSchema, media: externalMediaSchema.nullable().optional() }),
  z.object({ key: keySchema, action: z.literal('update'), publicationId: z.uuid(), publication: updatePublicationSchema, media: externalMediaSchema.nullable().optional() }),
]);
export const startEditorialRunSchema = z.object({
  runId: keySchema,
  mode: z.enum(['daily', 'operations']),
  operations: z.array(editorialOperationSchema).default([]),
}).superRefine((run, ctx) => {
  const keys = run.operations.map(operation => operation.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['operations'], message: 'Operation keys must be unique within the run.' });
  if (run.mode === 'daily' && run.operations.length) ctx.addIssue({ code: 'custom', path: ['operations'], message: 'Daily research produces its own operations.' });
  if (run.mode === 'operations' && !run.operations.length) ctx.addIssue({ code: 'custom', path: ['operations'], message: 'Provide at least one operation.' });
});
export const editorialFailureSchema = z.object({
  stage: editorialStageSchema,
  operationKey: keySchema.nullable(),
  message: z.string(),
  recovery: z.string(),
});
export type EditorialStage = z.infer<typeof editorialStageSchema>;
export type EditorialRunStatus = z.infer<typeof editorialRunStatusSchema>;
export type EditorialOperation = z.infer<typeof editorialOperationSchema>;
export type StartEditorialRun = z.infer<typeof startEditorialRunSchema>;
export type EditorialFailure = z.infer<typeof editorialFailureSchema>;

export const editorialRunMessageSchema = z.object({ runId: z.uuid() });
