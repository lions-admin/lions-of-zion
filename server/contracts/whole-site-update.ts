/**
 * Wire contract for GitHub-delivered editorial packages. It intentionally
 * describes content and placement only: SQL, shell commands, migrations,
 * environment values and application code have no representable field here.
 */

import { z } from 'zod';
import { externalMediaSchema } from './external-briefing';
import { editorialSourcesSchema } from './editorial-update';
import { createPublicationSchema, updatePublicationSchema } from './publication';

const keySchema = z.string().trim().min(1).max(200);
const canonicalStoryIdSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase hyphenated canonical story id.')
  .max(160);

export const WHOLE_SITE_UPDATE_CONTRACT_VERSION = 'whole-site-update-v1' as const;

export const wholeSitePublicationReferenceSchema = z.object({
  publicId: z.string().trim().min(1).max(200).optional(),
  canonicalStoryId: canonicalStoryIdSchema.optional(),
  operationKey: keySchema.optional(),
}).strict().superRefine((reference, ctx) => {
  const count = Number(Boolean(reference.publicId)) + Number(Boolean(reference.canonicalStoryId)) + Number(Boolean(reference.operationKey));
  if (count !== 1) ctx.addIssue({ code: 'custom', message: 'A homepage reference must name exactly one publication or package operation.' });
});

export const homepagePlacementDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set'), publication: wholeSitePublicationReferenceSchema }).strict(),
  z.object({ action: z.literal('remove') }).strict(),
]);

const homepageAreaSchema = z.object({
  lead: homepagePlacementDecisionSchema.optional(),
  secondary: homepagePlacementDecisionSchema.optional(),
}).strict();

export const wholeSiteHomepageSchema = z.object({
  news: homepageAreaSchema.optional(),
  fakeResistance: homepageAreaSchema.optional(),
  people: homepageAreaSchema.optional(),
}).strict().default({});

export const wholeSiteCreateSchema = z.object({
  key: keySchema,
  publication: createPublicationSchema.strict(),
  media: externalMediaSchema.nullable().optional(),
  /** Cited web pages; each becomes evidence the record links to. See `editorialSourceSchema`. */
  sources: editorialSourcesSchema,
}).strict();

export const wholeSiteUpdateTargetSchema = z.object({
  publicId: z.string().trim().min(1).max(200).optional(),
  canonicalStoryId: canonicalStoryIdSchema.optional(),
}).strict().refine(target => Boolean(target.publicId || target.canonicalStoryId), {
  message: 'An update requires publicId or canonicalStoryId.',
});

export const wholeSiteUpdateOperationSchema = z.object({
  key: keySchema,
  target: wholeSiteUpdateTargetSchema,
  publication: updatePublicationSchema.strict(),
  media: externalMediaSchema.nullable().optional(),
  /** Sources for the development being added; attached alongside those the record already cites. */
  sources: editorialSourcesSchema,
}).strict();

export const wholeSiteUpdatePackageSchema = z.object({
  contractVersion: z.literal(WHOLE_SITE_UPDATE_CONTRACT_VERSION),
  runId: keySchema,
  composer: z.string().trim().min(1).max(200),
  createdAt: z.iso.datetime(),
  creates: z.array(wholeSiteCreateSchema).max(100).default([]),
  updates: z.array(wholeSiteUpdateOperationSchema).max(100).default([]),
  homepage: wholeSiteHomepageSchema,
  siteRecommendations: z.array(z.string().trim().min(1).max(4_000)).max(50).default([]),
}).strict().superRefine((pkg, ctx) => {
  const operations = [...pkg.creates, ...pkg.updates];
  const keys = operations.map(operation => operation.key);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: 'custom', path: ['creates'], message: 'Create and update operation keys must be unique within the package.' });
  }
  if (!operations.length && !Object.keys(pkg.homepage).length) {
    ctx.addIssue({ code: 'custom', message: 'A package needs a create, update, or homepage decision.' });
  }
  for (const [area, placements] of Object.entries(pkg.homepage)) {
    for (const [position, decision] of Object.entries(placements ?? {})) {
      if (decision?.action === 'set' && decision.publication.operationKey && !keys.includes(decision.publication.operationKey)) {
        ctx.addIssue({ code: 'custom', path: ['homepage', area, position], message: `Unknown package operation "${decision.publication.operationKey}".` });
      }
    }
  }
});

export type WholeSiteUpdatePackage = z.infer<typeof wholeSiteUpdatePackageSchema>;
