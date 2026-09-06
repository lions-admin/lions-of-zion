/**
 * The wire contract for an externally composed Daily Brief edition.
 *
 * An outside task (a scheduled GitHub Action, an operator script) reads public
 * sources, composes an edition, and posts it to
 * `POST /api/internal/briefing/external-publish`. This file is the whole of
 * what that caller is allowed to say.
 *
 * ## Why this is not the internal draft schema
 *
 * `server/modules/briefing/service.ts` already has schemas for a drafted
 * edition, and they cite evidence by **database UUID**. An external composer
 * cannot know those UUIDs: it read the articles itself, and nothing it fetched
 * exists in `evidence` yet. Handing it UUIDs would mean either letting it
 * invent them — which the `known_evidence` quality check exists to refuse — or
 * giving it a second endpoint to pre-register evidence, which would put a
 * partially ingested edition on disk before validation and break requirement 7
 * (no partial edition).
 *
 * So the package carries its own closed reference space:
 *
 *   - `publishers[]` — who published the material, keyed by `key`.
 *   - `citations[]`  — the individual pieces read, keyed by `key`, each
 *                      pointing at one `publishers[].key`.
 *   - the edition body cites `citationKeys`, never UUIDs.
 *
 * The ingest service resolves that space to real `source` and `evidence` rows
 * inside the publish transaction and then hands the existing pipeline exactly
 * the artifact shape it already expects. Nothing downstream learns that the
 * edition arrived from outside; the quality gate, the publish trigger, the
 * archive, the outbox and the search reindex all run unchanged.
 *
 * ## Keys are package-local
 *
 * A `key` is meaningful only inside one submission. It is a slug the composer
 * picks so its own JSON can cross-reference itself. It is never stored as an
 * identity and never trusted as one — `resolveCitations` maps it to a real
 * evidence id and every downstream consumer sees only the UUID. This is what
 * keeps a caller from addressing rows it did not create.
 *
 * ## Layering
 *
 * `server/contracts/**` may import zod and nothing else (enforced in
 * `eslint.config.mjs`), so this file is loadable from a route, from the ingest
 * service, and from a test with no database. It deliberately restates the
 * field shapes rather than importing them from `server/modules/briefing`,
 * which pulls in `server-only` and a Postgres driver.
 *
 * ## Pinned service signature
 *
 * The route and the tests both code against this, and the ingest service must
 * implement it — this is the seam:
 *
 * ```ts
 * // server/modules/briefing/external-publish.ts
 * export function externalBriefingPublishService(database: unknown): {
 *   publish(
 *     pkg: ExternalBriefingPackage,
 *     actor: Actor,
 *     requestId?: string,
 *   ): Promise<ExternalBriefingPublishResult>;
 * };
 * // server/modules/briefing/index.ts
 * export const externalBriefingPublish = () => externalBriefingPublishService(db());
 * ```
 */

import { z } from "zod";

/* ── Shared primitives ──────────────────────────────────────────────────── */

/** A package-local cross-reference slug. Not an identity; see the header. */
export const packageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "A package key is lowercase alphanumeric with dots, dashes or underscores.");

/** Israel-local calendar day, `YYYY-MM-DD`. The edition's public identity. */
export const localDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "localDate must be an Israel-local calendar day formatted YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "localDate must be a real calendar date.",
  });

/** BCP-47-ish, matching the `is_language` database check. */
export const packageLanguageSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[A-Za-z0-9-]+)*$/, "language must be a BCP-47-style tag such as \"en\" or \"he-IL\".");

const httpUrlSchema = z
  .string()
  .trim()
  .max(2_000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, { message: "Must be an absolute http(s) URL." });

/* ── The idempotency key ────────────────────────────────────────────────────
 *
 * Requirement 6: the same package may not publish twice. `runId` is the
 * caller's own submission identity — a GitHub Actions run id, a ULID, a UUID.
 * It is stored unique, so a replay returns the first run's result rather than
 * creating a second edition.
 *
 * It is deliberately NOT a uuid: the natural value on the sending side is
 * `${github.run_id}-${github.run_attempt}`, and forcing a UUID would push
 * callers into inventing one per retry — which is precisely the mistake that
 * defeats idempotency. */
export const runIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "runId is alphanumeric with dots, dashes, colons or underscores.");

/* ── Publishers ─────────────────────────────────────────────────────────────
 *
 * One entry per outlet the package read. These become `source` rows (kind
 * `manual` — the same fallback `server/modules/sources/ingest.ts` already
 * uses for a publisher discovered by attribution rather than its own feed;
 * `SOURCE_KINDS` has no dedicated value for this), registered inactive: this
 * endpoint publishes an edition, it does not enrol a feed the ingestion cron
 * will then poll. */
export const externalPublisherSchema = z.object({
  key: packageKeySchema,
  name: z.string().trim().min(1).max(200),
  /** The outlet's front page. Used for the source row and for attribution. */
  homepageUrl: httpUrlSchema,
  language: packageLanguageSchema.default("en"),
  /** ISO 3166-1 alpha-2, upper case. */
  country: z.string().trim().regex(/^[A-Z]{2}$/, "country must be an ISO 3166-1 alpha-2 code.").nullable().default(null),
  /** True for a government, military or ministry publisher. The
   * `daily_brief_official_context` quality check reads this. */
  official: z.boolean().default(false),
});
export type ExternalPublisher = z.infer<typeof externalPublisherSchema>;

/* ── Citations ──────────────────────────────────────────────────────────────
 *
 * One entry per piece of source material read. Each becomes an `evidence`
 * row through the normal `createEvidenceInTx` path, so deduplication by
 * canonical URL and content hash behaves exactly as it does for RSS. */
export const externalCitationSchema = z.object({
  key: packageKeySchema,
  publisherKey: packageKeySchema,
  title: z.string().trim().min(1).max(500),
  url: httpUrlSchema,
  /** The canonical URL if it differs from the one fetched. Drives dedup. */
  canonicalUrl: httpUrlSchema.nullable().default(null),
  /** ISO 8601. When the outlet published it, not when the package read it. */
  publishedAt: z.string().trim().datetime({ offset: true }),
  /** Enough source text for `processable_source_text` and
   * `exact_fact_fidelity` to actually verify the edition against it. A
   * paragraph is not enough; this is the floor those checks need. */
  excerpt: z.string().trim().min(200).max(20_000),
  language: packageLanguageSchema.default("en"),
});
export type ExternalCitation = z.infer<typeof externalCitationSchema>;

/* ── Claims and passages ────────────────────────────────────────────────────
 *
 * Structurally identical to the internal draft schemas, with `evidenceId`
 * replaced by `citationKey` throughout. Requirement 3 keeps claim
 * classification intact: `layer` and `assessment` are the same enums the
 * `briefing_claim` table's check constraints enforce. */
export const externalCitationLinkSchema = z.object({
  citationKey: packageKeySchema,
  relation: z.enum(["supports", "partially_supports", "contradicts", "contextualizes"]),
  strength: z.enum(["strong", "adequate", "weak", "contextual"]),
  rationale: z.string().trim().min(1).max(2_000),
});
export type ExternalCitationLink = z.infer<typeof externalCitationLinkSchema>;

export const externalClaimSchema = z.object({
  title: z.string().trim().min(1).max(300),
  text: z.string().trim().min(1).max(4_000),
  layer: z.enum(["source_claim", "observed_fact", "model_inference", "editorial_conclusion"]),
  assessment: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  attributedTo: z.string().trim().min(1).max(300).nullable().default(null),
  uncertainty: z.string().trim().min(1).max(2_000).nullable().default(null),
  /** Empty only for an all-analysis Narrative Watch article; the package-level
   * refinement below is what enforces that, because a single claim cannot see
   * whether its article cites anything. */
  /* Bounded by the package's own citation budget rather than by an arbitrary
     eight: a claim may legitimately rest on more than eight sources, and no
     claim can reference more distinct citations than the package carries. */
  citationLinks: z.array(externalCitationLinkSchema).max(200),
});
export type ExternalClaim = z.infer<typeof externalClaimSchema>;

/** One rendered paragraph, traceable to a claim and its sources.
 * `paragraph_traceability` is one of the twelve checks the SQL publish gate
 * counts, so this is not decorative. */
export const externalPassageSchema = z.object({
  text: z.string().trim().min(40).max(6_000),
  /** Zero-based index into the claims array of *this same* article or brief.
   * Never a global index. */
  claimIndex: z.number().int().min(0).max(99),
  /* Same reasoning as `externalClaimSchema.citationLinks`. */
  citationKeys: z.array(packageKeySchema).max(200),
});
export type ExternalPassage = z.infer<typeof externalPassageSchema>;

/* ── Narrative Watch ────────────────────────────────────────────────────────
 *
 * `evidenceBasis` is absent by design, and its absence is load-bearing.
 * It is derived — exactly `citationKeys.length === 0` — never chosen by the
 * sender. A caller that could set it would switch off seven evidence checks
 * in one field. See `server/contracts/publication.ts`. */
export const externalNarrativeWatchSchema = z.object({
  exactClaim: z.string().trim().min(1).max(4_000),
  propagators: z.array(z.string().trim().min(1).max(300)).max(20),
  arenas: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  trendDirection: z.enum(["rising", "stable", "declining", "new", "unclear"]),
  israeliPosition: z.string().trim().min(1).max(6_000).nullable().default(null),
  securityContext: z.string().trim().min(1).max(6_000).nullable().default(null),
  supportingCitationKeys: z.array(packageKeySchema).max(30),
  contradictingCitationKeys: z.array(packageKeySchema).max(30),
  verificationState: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  knownUnknowns: z.array(z.string().trim().min(1).max(1_000)).max(20),
});
export type ExternalNarrativeWatch = z.infer<typeof externalNarrativeWatchSchema>;

/* ── Editorial media ────────────────────────────────────────────────────────
 *
 * The picture a record is published with, declared here rather than smuggled
 * into a passage as a raw URL. `inputUrl` is fetched once by
 * `server/modules/media`, validated, and stored in this site's own public
 * Blob store; the site then serves that copy. Nothing here becomes a
 * permanent hotlink to a news publisher's CDN.
 *
 * Rights travel with the image and are never invented on this side. A
 * composer that cannot establish a basis leaves `status` at `"unknown"`,
 * which stores the asset and its provenance while keeping it off every public
 * surface — that is the honest outcome, not a failure.
 *
 * `generated` marks an image made for the article because no suitable one
 * exists. It may never be presented as documentation of the event, so the
 * refinement below pins it to `editorial-illustration` and demands the
 * disclosure line that says so.
 */

export const externalMediaRightsSchema = z.object({
  status: z.enum(["cleared", "unknown", "withdrawn"]).default("unknown"),
  /** The licence or permission this rests on — "CC BY-SA 4.0", "Generated in-house". */
  basis: z.string().trim().min(1).max(300),
  /** Where that basis can be checked: a licence URL, a file page, a run id. */
  reference: z.string().trim().min(1).max(2_000),
  /** Required whenever `status` is `"cleared"`; the refinement below pins it. */
  clearedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "clearedAt is a calendar date, YYYY-MM-DD.").nullable().default(null),
  /** Which public surfaces the clearance actually covers. */
  surfaces: z.array(z.enum(["homepage", "article"])).max(2).default([]),
});
export type ExternalMediaRights = z.infer<typeof externalMediaRightsSchema>;

export const externalMediaSchema = z
  .object({
    /** The image bytes to fetch. Read once, stored, then never called again. */
    inputUrl: httpUrlSchema,
    /** The page the image was found on, for provenance and attribution. */
    sourceUrl: httpUrlSchema.nullable().default(null),
    alt: z.string().trim().min(1).max(500),
    caption: z.string().trim().min(1).max(500).nullable().default(null),
    credit: z.string().trim().min(1).max(300),
    /** What the image is *not*, stated on its own line. */
    disclosure: z.string().trim().min(1).max(300).nullable().default(null),
    role: z.enum(["documentation", "portrait", "archival-context", "editorial-illustration", "safe-cover"]),
    focalPoint: z
      .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
      .default({ x: 50, y: 50 }),
    sensitivity: z.enum(["safe", "sensitive", "unknown"]).default("unknown"),
    rights: externalMediaRightsSchema,
    /** True for an image created for this article rather than found. */
    generated: z.boolean().default(false),
  })
  .superRefine((media, ctx) => {
    if (media.rights.status === "cleared" && !media.rights.clearedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["rights", "clearedAt"],
        message: "A cleared image must record the date its rights were cleared.",
      });
    }
    if (media.rights.status === "cleared" && media.rights.surfaces.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rights", "surfaces"],
        message: "A cleared image must name the surfaces the clearance covers.",
      });
    }
    if (media.generated && media.role !== "editorial-illustration") {
      ctx.addIssue({
        code: "custom",
        path: ["role"],
        message: "A generated image is an editorial illustration; it may not claim a documentary role.",
      });
    }
    if (media.generated && !media.disclosure) {
      ctx.addIssue({
        code: "custom",
        path: ["disclosure"],
        message:
          "A generated image must carry its own disclosure, e.g. \"Editorial illustration — not incident documentation\".",
      });
    }
  });
export type ExternalMedia = z.infer<typeof externalMediaSchema>;

/* ── Articles ───────────────────────────────────────────────────────────────
 *
 * An external package composes articles into the two section jobs; the
 * Daily Brief is composed from the whole pack, security material included. */
export const EXTERNAL_ARTICLE_SECTIONS = ["israel_update", "narrative_watch"] as const;

export const externalArticleSchema = z.object({
  section: z.enum(EXTERNAL_ARTICLE_SECTIONS),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(1_200),
  citationKeys: z.array(packageKeySchema).max(20),
  claims: z.array(externalClaimSchema).min(1).max(20),
  passages: z.array(externalPassageSchema).min(2).max(30),
  /** Required for `narrative_watch`, forbidden otherwise. */
  narrativeTitle: z.string().trim().min(1).max(300).nullable().default(null),
  editorialTopic: z.string().trim().min(1).max(120),
  primaryActor: z.string().trim().min(1).max(160).nullable().default(null),
  arena: z.string().trim().min(1).max(120),
  featuredIsraelStory: z.boolean().default(false),
  narrativeWatch: externalNarrativeWatchSchema.nullable().default(null),
  /** The hero image, or null. Never a URL pasted into a passage. */
  media: externalMediaSchema.nullable().default(null),
});
export type ExternalArticle = z.infer<typeof externalArticleSchema>;

/* ── The Daily Brief itself ─────────────────────────────────────────────── */

export const externalBriefSectionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  passages: z.array(externalPassageSchema).min(1).max(10),
});
export type ExternalBriefSection = z.infer<typeof externalBriefSectionSchema>;

export const externalDailyBriefSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(1_200),
  /** The Daily Brief is never an unsourced analysis: only a Narrative Watch
   * record may cite nothing, so this floor is 1 and not 0. */
  citationKeys: z.array(packageKeySchema).min(1).max(40),
  claims: z.array(externalClaimSchema).min(1).max(30),
  situation: externalBriefSectionSchema,
  keyEvents: externalBriefSectionSchema,
  israeliPosition: externalBriefSectionSchema.nullable().default(null),
  internationalResponses: externalBriefSectionSchema.nullable().default(null),
  watchPoints: externalBriefSectionSchema,
  /** The hero image, or null. Same path and same rules as an article's. */
  media: externalMediaSchema.nullable().default(null),
});
export type ExternalDailyBrief = z.infer<typeof externalDailyBriefSchema>;

/* ── The package ────────────────────────────────────────────────────────────
 *
 * The refinements below are the whole of the referential integrity the route
 * can check before touching the database. They exist so a malformed package
 * is a 422 with a field path, not a foreign-key violation halfway through a
 * transaction. */

const externalBriefingPackageShape = {
  runId: runIdSchema,
  localDate: localDateSchema,
  /** Bumped when this contract changes shape. The service refuses a version
   * it does not implement rather than silently reading a package as if it
   * were the current one. */
  contractVersion: z.literal("external-briefing-v1"),
  /** Free-text label for the composing system, recorded on the audit trail.
   * Never used for authorization — the shared secret is. */
  composer: z.string().trim().min(1).max(120),
  /* The three caps below are request-size guards, not editorial limits: the
     whole package is parsed into memory and materialised inside one
     transaction that has to finish within the route's `maxDuration = 300`
     seconds. They are sized against that budget and against Vercel's 100 MB
     request-body ceiling, and are the only quantity limits left on this path.

     `articles` deliberately carries no cap. It used to be `.max(8)`, which was
     an arbitrary editorial ceiling that silently truncated a run: a composer
     that produced nine distinct, valid articles could not submit them. The
     real bound on how much a run may publish is the citation and publisher
     budget above plus the function's time budget, and those are enforced
     where they actually apply. */
  publishers: z.array(externalPublisherSchema).min(1).max(60),
  citations: z.array(externalCitationSchema).min(1).max(200),
  dailyBrief: externalDailyBriefSchema,
  articles: z.array(externalArticleSchema),
} as const;

export const externalBriefingPackageSchema = z
  .object(externalBriefingPackageShape)
  .superRefine((pkg, ctx) => {
    /* Unique keys. A duplicate would make a citationKey ambiguous, and the
       later entry would silently win. */
    const publisherKeys = new Set<string>();
    for (const [index, publisher] of pkg.publishers.entries()) {
      if (publisherKeys.has(publisher.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["publishers", index, "key"],
          message: `Duplicate publisher key "${publisher.key}".`,
        });
      }
      publisherKeys.add(publisher.key);
    }

    const citationKeys = new Set<string>();
    for (const [index, citation] of pkg.citations.entries()) {
      if (citationKeys.has(citation.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["citations", index, "key"],
          message: `Duplicate citation key "${citation.key}".`,
        });
      }
      citationKeys.add(citation.key);
      if (!publisherKeys.has(citation.publisherKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["citations", index, "publisherKey"],
          message: `Citation "${citation.key}" references unknown publisher "${citation.publisherKey}".`,
        });
      }
    }

    /* Every citationKey anywhere in the body must resolve inside the package.
       This is the package-local equivalent of the `known_evidence` quality
       check, and the reason the check can still be trusted after remapping. */
    const requireKeys = (keys: readonly string[], path: (string | number)[]) => {
      for (const [index, key] of keys.entries()) {
        if (!citationKeys.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: [...path, index],
            message: `Unknown citation key "${key}".`,
          });
        }
      }
    };

    const checkClaims = (claims: readonly ExternalClaim[], path: (string | number)[]) => {
      for (const [index, claim] of claims.entries()) {
        requireKeys(claim.citationLinks.map((link) => link.citationKey), [...path, index, "citationLinks"]);
      }
    };

    const checkPassages = (
      passages: readonly ExternalPassage[],
      claimCount: number,
      path: (string | number)[],
    ) => {
      for (const [index, passage] of passages.entries()) {
        requireKeys(passage.citationKeys, [...path, index, "citationKeys"]);
        if (passage.claimIndex >= claimCount) {
          ctx.addIssue({
            code: "custom",
            path: [...path, index, "claimIndex"],
            message: `claimIndex ${passage.claimIndex} is outside this record's ${claimCount} claims.`,
          });
        }
      }
    };

    const brief = pkg.dailyBrief;
    requireKeys(brief.citationKeys, ["dailyBrief", "citationKeys"]);
    checkClaims(brief.claims, ["dailyBrief", "claims"]);
    for (const name of ["situation", "keyEvents", "israeliPosition", "internationalResponses", "watchPoints"] as const) {
      const section = brief[name];
      if (section) checkPassages(section.passages, brief.claims.length, ["dailyBrief", name, "passages"]);
    }

    for (const [index, article] of pkg.articles.entries()) {
      requireKeys(article.citationKeys, ["articles", index, "citationKeys"]);
      checkClaims(article.claims, ["articles", index, "claims"]);
      checkPassages(article.passages, article.claims.length, ["articles", index, "passages"]);

      /* Narrative Watch is the only section carrying monitoring details, and
         it must carry them — mirroring the publication contract's refinement
         so the refusal is explainable rather than a constraint violation. */
      const isNarrative = article.section === "narrative_watch";
      if (isNarrative !== (article.narrativeWatch !== null)) {
        ctx.addIssue({
          code: "custom",
          path: ["articles", index, "narrativeWatch"],
          message: isNarrative
            ? "A narrative_watch article requires structured monitoring details."
            : "Only a narrative_watch article may carry monitoring details.",
        });
      }
      if (isNarrative !== (article.narrativeTitle !== null)) {
        ctx.addIssue({
          code: "custom",
          path: ["articles", index, "narrativeTitle"],
          message: isNarrative
            ? "A narrative_watch article requires a narrativeTitle to key its durable narrative."
            : "Only a narrative_watch article may carry a narrativeTitle.",
        });
      }
      if (article.narrativeWatch) {
        requireKeys(
          article.narrativeWatch.supportingCitationKeys,
          ["articles", index, "narrativeWatch", "supportingCitationKeys"],
        );
        requireKeys(
          article.narrativeWatch.contradictingCitationKeys,
          ["articles", index, "narrativeWatch", "contradictingCitationKeys"],
        );
      }

      /* All-or-nothing sourcing. An analysis article cites nothing anywhere;
         a half-sourced one is rejected outright. `evidenceBasis` is derived
         from `citationKeys.length === 0`, so a package that leaves the article
         uncited while a claim or passage still cites something would produce a
         record labelled "our own analysis" that quietly leans on sources. */
      const bodyCitationCount =
        article.claims.reduce((total, claim) => total + claim.citationLinks.length, 0)
        + article.passages.reduce((total, passage) => total + passage.citationKeys.length, 0)
        + (article.narrativeWatch
          ? article.narrativeWatch.supportingCitationKeys.length
            + article.narrativeWatch.contradictingCitationKeys.length
          : 0);

      if (article.citationKeys.length === 0) {
        if (!isNarrative) {
          ctx.addIssue({
            code: "custom",
            path: ["articles", index, "citationKeys"],
            message: "Only a narrative_watch article may cite nothing; every other section must be sourced.",
          });
        }
        if (bodyCitationCount > 0) {
          ctx.addIssue({
            code: "custom",
            path: ["articles", index, "citationKeys"],
            message:
              "An unsourced analysis must cite nothing anywhere. This article cites no sources at the top level but does inside its claims, passages or monitoring details.",
          });
        }
      } else if (article.claims.some((claim) => claim.citationLinks.length === 0)) {
        ctx.addIssue({
          code: "custom",
          path: ["articles", index, "claims"],
          message: "Every claim in a sourced article must link at least one citation.",
        });
      }
    }

    /* The Daily Brief is always sourced, so its claims always link. */
    for (const [index, claim] of brief.claims.entries()) {
      if (claim.citationLinks.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["dailyBrief", "claims", index, "citationLinks"],
          message: "Every Daily Brief claim must link at least one citation.",
        });
      }
    }

    /* A citation nobody cites is dead weight that would still create an
       evidence row, so it is a validation error rather than a silent import. */
    const cited = new Set<string>([
      ...brief.citationKeys,
      ...brief.claims.flatMap((claim) => claim.citationLinks.map((link) => link.citationKey)),
      ...(["situation", "keyEvents", "israeliPosition", "internationalResponses", "watchPoints"] as const)
        .flatMap((name) => brief[name]?.passages.flatMap((passage) => passage.citationKeys) ?? []),
      ...pkg.articles.flatMap((article) => [
        ...article.citationKeys,
        ...article.claims.flatMap((claim) => claim.citationLinks.map((link) => link.citationKey)),
        ...article.passages.flatMap((passage) => passage.citationKeys),
        ...(article.narrativeWatch?.supportingCitationKeys ?? []),
        ...(article.narrativeWatch?.contradictingCitationKeys ?? []),
      ]),
    ]);
    for (const [index, citation] of pkg.citations.entries()) {
      if (!cited.has(citation.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["citations", index, "key"],
          message: `Citation "${citation.key}" is never cited by the edition.`,
        });
      }
    }
  });

export type ExternalBriefingPackage = z.infer<typeof externalBriefingPackageSchema>;

export const EXTERNAL_BRIEFING_CONTRACT_VERSION = "external-briefing-v1";

/** The machine byline recorded on every publication this endpoint creates.
 * Distinct from the internal pipeline's author so the archive can tell an
 * externally composed edition from a locally generated one. */
export const EXTERNAL_BRIEFING_AUTHOR = "Lions of Zion external briefing composer";

/* ── The response ───────────────────────────────────────────────────────────
 *
 * Requirement 8. `publications[]` carries the ids and the public paths so the
 * caller can verify its own submission landed without a second request. No
 * secret, no internal id beyond the publication's own, and no stack detail
 * ever appears here. */

export const externalBriefingPublishStatusSchema = z.enum([
  /** This call created the edition and it is live. */
  "published",
  /** This `runId` had already been submitted; the ids below are the first
   * run's, replayed verbatim rather than recomputed. */
  "duplicate",
  /** An operator has paused automatic publication
   * (`briefing_control.automatic_publication_paused`). The package was
   * validated, materialised and quality-checked exactly as a live run would
   * be, but the resulting publications were left in `draft` and are not on
   * `/geopolitical-brief` yet. This is the same kill switch the internal
   * pipeline honours — an external composer does not get to bypass it. A
   * later resend of the same `runId` after the pause lifts promotes these
   * exact drafts rather than creating a second edition. */
  "draft",
]);
export type ExternalBriefingPublishStatus = z.infer<typeof externalBriefingPublishStatusSchema>;

export const externalBriefingPublicationSchema = z.object({
  id: z.uuid(),
  publicId: z.string(),
  section: z.enum(["daily_brief", "israel_update", "narrative_watch"]),
  title: z.string(),
  /** Site-relative path, e.g. `/geopolitical-brief`. */
  path: z.string(),
  /** Absolute public URL. */
  url: z.string(),
});
export type ExternalBriefingPublication = z.infer<typeof externalBriefingPublicationSchema>;

/** One editorial check that did not pass, reported alongside a successful
 *  publish. Advisory by construction: every name here is in
 *  `ADVISORY_QUALITY_CHECKS`, so it never refused the package. */
export const externalBriefingWarningSchema = z.object({
  /** `daily-brief`, or `article-1`, `article-2`, … */
  candidateKey: z.string(),
  /** The quality check name, e.g. `daily_brief_official_context`. */
  check: z.string(),
  detail: z.string(),
});
export type ExternalBriefingWarning = z.infer<typeof externalBriefingWarningSchema>;

export const externalBriefingPublishResultSchema = z.object({
  runId: runIdSchema,
  status: externalBriefingPublishStatusSchema,
  localDate: localDateSchema,
  /** Newly created evidence rows. Zero on a duplicate. */
  evidenceCreated: z.number().int().min(0),
  publications: z.array(externalBriefingPublicationSchema),
  /** Where the edition is visible. Always the brief hub. */
  briefUrl: z.string(),
  /** Editorial checks that failed without blocking publication. Defaulted so
   *  a result persisted before this field existed still parses on replay of a
   *  duplicate submission. */
  warnings: z.array(externalBriefingWarningSchema).default([]),
});
export type ExternalBriefingPublishResult = z.infer<typeof externalBriefingPublishResultSchema>;
