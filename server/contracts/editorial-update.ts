import { z } from 'zod';
import { createPublicationSchema, updatePublicationSchema } from './publication';
import { externalMediaSchema } from './external-briefing';

/** Persistence and transport parsing for externally composed editorial work. */
export const editorialStageSchema = z.enum(['media', 'publication', 'homepage', 'report']);
export const editorialRunStatusSchema = z.enum(['queued', 'running', 'completed', 'partial', 'failed']);
const keySchema = z.string().trim().min(1).max(200);
export const editorialUpdateTargetSchema = z.object({
  publicId: z.string().trim().min(1).max(200).optional(),
  canonicalStoryId: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).optional(),
}).refine(target => Boolean(target.publicId || target.canonicalStoryId), {
  message: 'An editorial update target requires publicId or canonicalStoryId.',
});
export const editorialOperationSchema = z.discriminatedUnion('action', [
  z.object({ key: keySchema, action: z.literal('create'), publication: createPublicationSchema, media: externalMediaSchema.nullable().optional() }),
  z.object({ key: keySchema, action: z.literal('update'), publicationId: z.uuid().optional(), target: editorialUpdateTargetSchema.optional(), publication: updatePublicationSchema, media: externalMediaSchema.nullable().optional() })
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
});
export type EditorialStage = z.infer<typeof editorialStageSchema>;
export type EditorialRunStatus = z.infer<typeof editorialRunStatusSchema>;
export type EditorialOperation = z.infer<typeof editorialOperationSchema>;
export type StartEditorialRun = z.infer<typeof startEditorialRunSchema>;
export type EditorialFailure = z.infer<typeof editorialFailureSchema>;

export const editorialRunMessageSchema = z.object({ runId: z.uuid() });
