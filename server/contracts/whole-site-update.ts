/**
 * Wire contract for GitHub-delivered editorial packages. It intentionally
 * describes content and placement only: SQL, shell commands, migrations,
 * environment values and application code have no representable field here.
 */

import { z } from 'zod';
import { externalMediaSchema } from './external-briefing';
import { editorialSourcesSchema } from './editorial-update';
import { createPublicationSchema, updatePublicationSchema } from './publication';
import { publicationSectionSchema } from './enums';

const keySchema = z.string().trim().min(1).max(200);
const canonicalStoryIdSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase hyphenated canonical story id.')
  .max(160);

export const WHOLE_SITE_UPDATE_CONTRACT_VERSION = 'whole-site-update-v1' as const;
export const WHOLE_SITE_UPDATE_V2_CONTRACT_VERSION = 'whole-site-update-v2' as const;
export const WHOLE_SITE_UPDATE_CONTRACT_VERSIONS = [
  WHOLE_SITE_UPDATE_CONTRACT_VERSION,
  WHOLE_SITE_UPDATE_V2_CONTRACT_VERSION,
] as const;

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

/* ── whole-site-update-v2 ───────────────────────────────────────────────────
 *
 * Two things the external editor does that v1 could not represent, and whose
 * absence `docs/editorial-dna.md` §12 recorded as gaps: the ground it covered,
 * and a deliberate decision not to publish.
 *
 * The second is the one that mattered. A run that declined three stories on
 * editorial judgement and a run whose media fetch 404'd both arrived as
 * "nothing published", so the report could not tell an editor's decision from a
 * broken pipe — and on 2026-09-07 an editor vetoed three pieces and had only a
 * free-text recommendation to say so with.
 *
 * Additive and version-dispatched. v1 keeps its own schema, parses on its own,
 * and is still what the delivery workflow validates a v1 package against. Every
 * object stays `.strict()`, so a v1 receiver rejects a v2 package outright
 * rather than silently reading half of it.
 */

const researchUrlSchema = z.string().trim().max(2_000).refine(value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Must be an absolute http(s) URL.');

/** What one line of the research ledger records. Not browser history: a
 *  bounded account of an area looked at and what came of looking. */
export const wholeSiteResearchEntrySchema = z.object({
  topic: z.string().trim().min(1).max(200),
  focus: z.string().trim().min(1).max(500).optional(),
  /** External addresses, never internal ids — the same rule as `sources`. */
  sourcesReviewed: z.array(researchUrlSchema).max(20).optional(),
  conclusion: z.string().trim().min(1).max(2_000),
  outcome: z.enum(['published', 'updated', 'vetoed', 'no_action']),
}).strict();
export type WholeSiteResearchEntry = z.infer<typeof wholeSiteResearchEntrySchema>;

/**
 * One deliberate refusal to publish.
 *
 * `key` is the editor's own handle for the candidate, in the same namespace as
 * an operation key, so a veto and the create it replaced can be talked about
 * together. `ownerDecisionRequested` is the one field that asks something of a
 * human, and the report surfaces it separately for that reason.
 */
export const wholeSiteVetoSchema = z.object({
  key: keySchema,
  candidate: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(2_000),
  section: publicationSectionSchema.optional(),
  sources: z.array(researchUrlSchema).max(20).optional(),
  replacement: z.string().trim().min(1).max(500).optional(),
  ownerDecisionRequested: z.boolean().optional(),
}).strict();
export type WholeSiteVeto = z.infer<typeof wholeSiteVetoSchema>;

export const wholeSiteResearchSchema = z.array(wholeSiteResearchEntrySchema).max(25).optional();
export const wholeSiteVetoesSchema = z.array(wholeSiteVetoSchema).max(25).optional();

/* ── homepageReview ─────────────────────────────────────────────────────────
 *
 * The third thing the external editor does that the contract could not
 * represent, recorded in `docs/editorial-dna.md` §12 as gap 10: *why* a
 * homepage slot changed, and why the others stayed.
 *
 * `homepage` above says what moved. It cannot say that the editor looked at
 * the People band and kept it, that the Fake Resistance lead was held because
 * newer is not stronger, or that a candidate for the news lead was vetoed off
 * the cover. A run that never looked at the homepage and a run that reviewed
 * all seven bands and changed nothing both arrived as an empty `homepage`.
 * `docs/editorial/homepage-operating-manual.md` now requires the review; this
 * is where it lands, and `manualVersion` names the edition of the manual the
 * editor read, so a review made against a stale manual is visible as such.
 *
 * `sectionsReviewed` spans every band on the cover, including the four a run
 * may not place into. `decisions` are bounded to the three placeable areas,
 * because a decision about October 7 or the support block is a
 * `siteRecommendations` line, not a placement.
 */

/** Every band on the homepage, in reading order. Wider than the placeable
 *  areas on purpose: a review covers the whole cover. */
export const HOMEPAGE_REVIEW_SECTIONS = ['cover', 'news', 'fakeResistance', 'october7', 'people', 'system', 'support'] as const;
export type HomepageReviewSection = (typeof HOMEPAGE_REVIEW_SECTIONS)[number];

/**
 * One editorial decision about one slot.
 *
 * `promote` and `replace` put something in a slot and must be matched by a
 * `set` in `homepage`; `demote` empties one and pairs with a `remove`;
 * `retain` and `veto` change nothing and are the two the machine could never
 * infer on its own — the whole reason this block exists.
 */
export const wholeSiteHomepageReviewDecisionSchema = z.object({
  area: z.enum(['news', 'fakeResistance', 'people']),
  position: z.enum(['lead', 'secondary']).optional(),
  action: z.enum(['promote', 'replace', 'retain', 'demote', 'veto']),
  publication: wholeSitePublicationReferenceSchema.optional(),
  reason: z.string().trim().min(1).max(2_000),
}).strict();
export type WholeSiteHomepageReviewDecision = z.infer<typeof wholeSiteHomepageReviewDecisionSchema>;

export const wholeSiteHomepageReviewSchema = z.object({
  /** The `Manual version:` line of `docs/editorial/homepage-operating-manual.md` the editor worked from. */
  manualVersion: z.string().trim().min(1).max(100),
  sectionsReviewed: z.array(z.enum(HOMEPAGE_REVIEW_SECTIONS)).min(1).max(7),
  sectionsChanged: z.array(z.enum(HOMEPAGE_REVIEW_SECTIONS)).max(7).default([]),
  decisions: z.array(wholeSiteHomepageReviewDecisionSchema).max(12).default([]),
}).strict();
export type WholeSiteHomepageReview = z.infer<typeof wholeSiteHomepageReviewSchema>;

export const wholeSiteUpdateV2PackageSchema = z.object({
  contractVersion: z.literal(WHOLE_SITE_UPDATE_V2_CONTRACT_VERSION),
  runId: keySchema,
  composer: z.string().trim().min(1).max(200),
  createdAt: z.iso.datetime(),
  creates: z.array(wholeSiteCreateSchema).max(100).default([]),
  updates: z.array(wholeSiteUpdateOperationSchema).max(100).default([]),
  homepage: wholeSiteHomepageSchema,
  siteRecommendations: z.array(z.string().trim().min(1).max(4_000)).max(50).default([]),
  research: wholeSiteResearchSchema,
  vetoes: wholeSiteVetoesSchema,
  homepageReview: wholeSiteHomepageReviewSchema.optional(),
}).strict().superRefine((pkg, ctx) => {
  const operations = [...pkg.creates, ...pkg.updates];
  const keys = operations.map(operation => operation.key);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: 'custom', path: ['creates'], message: 'Create and update operation keys must be unique within the package.' });
  }
  /* A v2 package may publish nothing and still be a complete report: a run that
     researched the day and vetoed everything it found has said something, and
     v1's "a package needs a create, update or homepage decision" would have
     rejected exactly that run. Research or a veto counts as content. */
  if (!operations.length && !Object.keys(pkg.homepage).length && !pkg.research?.length && !pkg.vetoes?.length) {
    ctx.addIssue({ code: 'custom', message: 'A package needs a create, update, homepage decision, research entry, or veto.' });
  }
  const vetoKeys = (pkg.vetoes ?? []).map(veto => veto.key);
  if (new Set(vetoKeys).size !== vetoKeys.length) {
    ctx.addIssue({ code: 'custom', path: ['vetoes'], message: 'Veto keys must be unique within the package.' });
  }
  for (const [area, placements] of Object.entries(pkg.homepage)) {
    for (const [position, decision] of Object.entries(placements ?? {})) {
      if (decision?.action === 'set' && decision.publication.operationKey && !keys.includes(decision.publication.operationKey)) {
        ctx.addIssue({ code: 'custom', path: ['homepage', area, position], message: `Unknown package operation "${decision.publication.operationKey}".` });
      }
    }
  }
  /* The review must agree with the placements it explains. Kept deliberately
     narrow: a band cannot be reported as changed without being reviewed; a
     `promote`/`replace` that names a slot must be matched by a `set` on that
     slot in `homepage`, and a `demote` that names a slot by a `remove`. A
     decision without a position is an area-level note (e.g. "retained the
     People band as it stood") and is not cross-checked. `retain` and `veto`
     are never cross-checked either — they are precisely the decisions the
     placements cannot show. */
  const review = pkg.homepageReview;
  if (review) {
    const reviewed = new Set<string>(review.sectionsReviewed);
    review.sectionsChanged.forEach((section, index) => {
      if (!reviewed.has(section)) {
        ctx.addIssue({ code: 'custom', path: ['homepageReview', 'sectionsChanged', index], message: `Section "${section}" is reported as changed but not as reviewed.` });
      }
    });
    review.decisions.forEach((decision, index) => {
      if (!decision.position) return;
      const placement = pkg.homepage[decision.area]?.[decision.position];
      if ((decision.action === 'promote' || decision.action === 'replace') && placement?.action !== 'set') {
        ctx.addIssue({ code: 'custom', path: ['homepageReview', 'decisions', index], message: `A "${decision.action}" at ${decision.area}/${decision.position} needs a matching "set" in homepage.${decision.area}.${decision.position}.` });
      }
      if (decision.action === 'demote' && placement?.action !== 'remove') {
        ctx.addIssue({ code: 'custom', path: ['homepageReview', 'decisions', index], message: `A "demote" at ${decision.area}/${decision.position} needs a matching "remove" in homepage.${decision.area}.${decision.position}.` });
      }
    });
  }
});
export type WholeSiteUpdateV2Package = z.infer<typeof wholeSiteUpdateV2PackageSchema>;

/**
 * What the receiver and the validator actually parse.
 *
 * Discriminated on `contractVersion`, so a package is read as the version it
 * declares and a malformed v2 never falls back to being read as a v1.
 */
export const anyWholeSiteUpdatePackageSchema = z.discriminatedUnion('contractVersion', [
  wholeSiteUpdatePackageSchema,
  wholeSiteUpdateV2PackageSchema,
]);
export type AnyWholeSiteUpdatePackage = z.infer<typeof anyWholeSiteUpdatePackageSchema>;
