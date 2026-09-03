import "server-only";

/**
 * Materialises an externally composed Daily Brief edition into the existing
 * publication pipeline, atomically.
 *
 * `server/contracts/external-briefing.ts` is the wire contract this reads —
 * read its header before this file, it explains the package-local citation
 * key design this module exists to resolve. This is the "publish" half of
 * `POST /api/internal/briefing/external-publish`; the route (owned
 * separately) authenticates the request, parses the body against
 * `externalBriefingPackageSchema`, and calls `publish()` here with the
 * already-validated package.
 *
 * ## One transaction, no exceptions
 *
 * Idempotency reservation, source/evidence materialisation, claim/narrative
 * materialisation, quality evaluation, and the publication write all happen
 * inside a single `database.transaction()`. Any failure — a failed quality
 * check, a write error — throws and rolls back naturally, which is
 * deliberate: a failed attempt leaves zero trace (including the ledger
 * reservation row), so the caller can retry the same `runId` after fixing the
 * problem. There is no quarantine/partial-state bookkeeping here; that
 * machinery in `service.ts` exists for the internal pipeline's own
 * staged/checkpointed model, which does not apply to a single atomic call.
 *
 * ## Reused vs. reimplemented
 *
 * `dedupeDraftPassages` is imported and reused directly from `./service`.
 * `evaluateCandidate` and every `QualityCandidate`/`QualityBasis` field is
 * imported and reused directly from `./quality` — no quality check is ever
 * skipped, and this runs the exact same function the internal pipeline does.
 * The private helpers in `service.ts` that build a `QualityCandidate` and a
 * `CreatePublication` from a drafted edition (`dailyAsContent`, `dailyBody`,
 * `qualityCandidate`, `bodyFromPassages`, `publicationPassages`) are not
 * exported, so their *logic* is reimplemented below against this contract's
 * `citationKeys` instead of the internal draft schema's `evidenceIds` — see
 * `resolveDailyBrief`/`resolveArticle`/`buildCandidate`/`publicationPassages`.
 */

import { sql } from "drizzle-orm";
import { ApiError } from "@/server/http/responses";
import { briefingFeatures } from "@/server/core/config";
import { integrityHash } from "@/server/core/hash";
import { setIdentity } from "@/server/core/versioning";
import { itemService } from "@/server/modules/items/service";
import { itemEvidenceService } from "@/server/modules/assessments/service";
import { narrativeService } from "@/server/modules/narratives/service";
import { publicationService } from "@/server/modules/publications/service";
import { createEvidenceInTx, findEvidenceByUrl } from "@/server/modules/evidence";
import { sourceFamilyRepo, sourceRepo } from "@/server/modules/sources/repo";
import { sourceCategoryForDomain } from "@/server/modules/sources/catalog";
import { briefingRepo } from "./repo";
import { dedupeDraftPassages } from "./service";
import { evaluateCandidate } from "./quality";
import { narrativeWatchTitle } from "@/server/contracts/publication";
import {
  EXTERNAL_BRIEFING_AUTHOR,
  externalBriefingPublishResultSchema,
} from "@/server/contracts/external-briefing";
import { SITE_URL } from "@/lib/site-config";
import type {
  ExternalArticle,
  ExternalBriefingPackage,
  ExternalBriefingPublication,
  ExternalBriefingPublishResult,
  ExternalClaim,
  ExternalDailyBrief,
  ExternalNarrativeWatch,
  ExternalPassage,
  ExternalPublisher,
} from "@/server/contracts/external-briefing";
import type { CreatePublication, EvidenceBasis, NarrativeWatchDetails } from "@/server/contracts/publication";
import type { DraftClaim, DraftPassage, QualityBasis, QualityCandidate } from "./quality";
import type { Actor } from "@/server/core/audit";
import type { InformationItem, Publication } from "@/server/db/schema";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };
type RawDb = { execute: <T>(query: unknown) => Promise<{ rows: T[] }> };

export type ExternalBriefingPublishService = {
  publish(
    pkg: ExternalBriefingPackage,
    actor: Actor,
    requestId?: string,
  ): Promise<ExternalBriefingPublishResult>;
};

/** One record (the Daily Brief, or one article) after citation keys have been
 * resolved to real evidence ids, ready to feed both a `QualityCandidate` and
 * a `CreatePublication`. */
type Resolved = {
  /** Possibly `narrativeWatchTitle`-prefixed; see `resolveArticle`. */
  title: string;
  summary: string;
  evidenceIds: string[];
  claims: DraftClaim[];
  /** Deduped, for the quality candidate and for `publicationPassages`. */
  passages: DraftPassage[];
  /** The publication body: raw, undeduped passages joined (or, for the Daily
   * Brief, one `## label` section per sub-section) — this is deliberately
   * NOT the deduped set the quality candidate scores, mirroring exactly what
   * `service.ts`'s `publish()` stores for an internally drafted edition. */
  rawBody: string;
};

export function externalBriefingPublishService(database: unknown): ExternalBriefingPublishService {
  const runner = database as Runner;

  return {
    async publish(
      pkg: ExternalBriefingPackage,
      actor: Actor,
      requestId?: string,
    ): Promise<ExternalBriefingPublishResult> {
      const packageHash = integrityHash(stableStringify(pkg));

      return runner.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const d = tx as RawDb;

        /* ── 1. Idempotency reservation ─────────────────────────────────── */
        const reservation = await d.execute<{ id: string }>(sql`
          INSERT INTO external_briefing_submission (
            run_id, local_date, contract_version, composer, package_hash, status, evidence_created, result
          ) VALUES (
            ${pkg.runId}, ${pkg.localDate}, ${pkg.contractVersion}, ${pkg.composer}, ${packageHash}, 'published', 0, '{}'::jsonb
          )
          ON CONFLICT (run_id) DO NOTHING
          RETURNING id
        `);

        let submissionId: string;
        if (reservation.rows[0]) {
          submissionId = reservation.rows[0].id;
        } else {
          /* Someone else's insert won the race (or ran earlier). The unique
           * index blocked this INSERT until that transaction resolved, so the
           * row is now visible one way or another. */
          const existingResult = await d.execute<{ packageHash: string; result: unknown }>(sql`
            SELECT package_hash AS "packageHash", result
            FROM external_briefing_submission
            WHERE run_id = ${pkg.runId}
            LIMIT 1
          `);
          const existing = existingResult.rows[0];
          if (!existing) {
            throw new ApiError(
              "INTERNAL_ERROR",
              "The idempotency ledger entry could not be located after a conflicting insert.",
            );
          }
          if (existing.packageHash !== packageHash) {
            throw new ApiError(
              "CONFLICT",
              `runId "${pkg.runId}" was already submitted with different package content.`,
            );
          }
          return externalBriefingPublishResultSchema.parse({
            ...(existing.result as Record<string, unknown>),
            status: "duplicate",
          });
        }

        /* ── 2. One briefing_run row per external submission ──────────────
         * Internal stages retain their daily idempotency key. External
         * submissions are instead keyed by their already-unique runId, so
         * distinct editions may be published for the same local date. */
        const runResult = await d.execute<{ id: string }>(sql`
          INSERT INTO briefing_run (local_date, stage, status, started_at)
          VALUES (${pkg.localDate}, ${externalPublishStage(pkg.runId)}, 'running', now())
          RETURNING id
        `);
        const briefingRunId = runResult.rows[0]!.id;

        const store = briefingRepo(tx);
        const sources = sourceRepo(tx);
        const families = sourceFamilyRepo(tx);
        const transactionDb: Runner = { transaction: async (fn) => fn(tx) };
        const itemWriter = itemService(transactionDb);
        const evidenceWriter = itemEvidenceService(transactionDb);
        const narrativeWriter = narrativeService(transactionDb);
        const publicationWriter = publicationService(transactionDb);

        /* ── 3. Publishers → source rows ─────────────────────────────────── */
        const sourceByPublisherKey = new Map<string, { sourceId: string; sourceFamilyId: string }>();
        for (const publisher of pkg.publishers) {
          sourceByPublisherKey.set(
            publisher.key,
            await resolvePublisherSource(sources, families, publisher, pkg.composer),
          );
        }

        /* ── 4. Citations → evidence rows ────────────────────────────────── */
        const evidenceIdByCitationKey = new Map<string, string>();
        let evidenceCreated = 0;
        for (const citation of pkg.citations) {
          const publisherSource = sourceByPublisherKey.get(citation.publisherKey)!;
          const canonicalUrl = citation.canonicalUrl ?? citation.url;
          /* `createEvidenceInTx` dedupes internally by canonical URL (and by
           * externalId / contentHash, neither of which this contract sets)
           * but does not return whether it inserted or found an existing row
           * — see its docstring in evidence/service.ts. Canonical URL is the
           * only dedup path reachable from this contract, so a pre-check
           * against the same lookup `insertOrGet` uses internally gives an
           * exact created-count without changing that shared module. */
          const preexisting = await findEvidenceByUrl(tx, canonicalUrl);
          const row = await createEvidenceInTx(tx, {
            sourceId: publisherSource.sourceId,
            kind: "article",
            dataClass: "public",
            title: citation.title,
            excerpt: citation.excerpt,
            url: citation.url,
            canonicalUrl,
            publisherDomain: hostnameOf(citation.url),
            usableTextLength: citation.excerpt.length,
            retrievalStatus: "fetched",
            accessState: "open",
            language: citation.language,
            publishedAt: citation.publishedAt,
          }, actor, { requestId });
          if (!preexisting) evidenceCreated += 1;
          evidenceIdByCitationKey.set(citation.key, row.id);
        }

        /* The exact evidence packet this edition rests on — the external
         * equivalent of `evidenceForArtifact` in service.ts, scoped to this
         * package's citations instead of a collection window. */
        const evidenceRows = await store.recentEvidenceByIds([...evidenceIdByCitationKey.values()]);
        const evidenceById = new Map(evidenceRows.map((row) => [row.id, row]));

        /* ── 5. Resolve content and build quality candidates ─────────────── */
        const resolvedDaily = resolveDailyBrief(pkg.dailyBrief, evidenceIdByCitationKey);
        const dailyCandidate = buildCandidate("daily-brief", resolvedDaily, "daily_brief", {
          evidenceBasis: "sourced",
          refutedClaim: null,
          verificationState: null,
        });

        const articleWork = pkg.articles.map((article, index) => {
          const evidenceBasis: EvidenceBasis = article.citationKeys.length === 0 ? "analysis" : "sourced";
          const resolved = resolveArticle(article, evidenceIdByCitationKey, evidenceBasis);
          const basis: QualityBasis = {
            evidenceBasis,
            refutedClaim: article.narrativeWatch?.exactClaim ?? null,
            verificationState: article.narrativeWatch?.verificationState ?? null,
          };
          const candidate = buildCandidate(`article-${index + 1}`, resolved, article.section, basis);
          return { index, article, resolved, evidenceBasis, candidate };
        });

        const candidates: QualityCandidate[] = [dailyCandidate, ...articleWork.map((w) => w.candidate)];

        /* Every candidate is evaluated and every check is recorded — no
         * candidate is skipped just because an earlier one already failed,
         * matching the internal `quality()` stage. The whole transaction
         * (including these rows) rolls back if anything fails, so recording
         * them here is for a complete audit trail on the success path and a
         * fully-informative error on the failure path, not durable state on
         * failure. */
        const failures: string[] = [];
        for (const candidate of candidates) {
          const decision = evaluateCandidate(candidate, evidenceById);
          await store.recordQualityChecks(briefingRunId, candidate.key, decision.checks);
          if (!decision.passed) {
            const failedNames = decision.checks
              .filter((check) => check.status === "fail")
              .map((check) => `${check.name}: ${check.detail}`);
            failures.push(`${candidate.key} — ${failedNames.join("; ")}`);
          }
        }
        if (failures.length) {
          throw new ApiError(
            "VALIDATION_ERROR",
            `The submitted edition did not meet the publication quality gate: ${failures.join(" | ")}`,
          );
        }

        /* ── 6. Materialise claims and narratives ─────────────────────────── */
        const dailyItems = await materializeClaims(itemWriter, evidenceWriter, store, resolvedDaily.claims, actor, requestId);
        const articleItemsByIndex = new Map<number, InformationItem[]>();
        for (const [index, work] of articleWork.entries()) {
          articleItemsByIndex.set(
            index,
            await materializeClaims(itemWriter, evidenceWriter, store, work.resolved.claims, actor, requestId),
          );
        }

        const narrativeIdByTitle = new Map<string, string>();
        for (const [index, work] of articleWork.entries()) {
          const { article, resolved } = work;
          if (article.section !== "narrative_watch" || !article.narrativeTitle) continue;
          const narrative = await narrativeWriter.autoCreateNarrative({
            slug: `${pkg.localDate}-narrative-${integrityHash(article.narrativeTitle).slice(0, 12)}`,
            title: article.narrativeTitle,
            summary: `Monitored from an external briefing submission for ${pkg.localDate}.`,
            language: "en",
          }, actor, requestId);
          for (const item of articleItemsByIndex.get(index) ?? []) {
            await narrativeWriter.linkItem(narrative.id, {
              itemId: item.id,
              rationale: "This source-attributed atomic claim forms part of the monitored narrative.",
            }, actor);
          }
          for (const evidenceId of resolved.evidenceIds) {
            await narrativeWriter.observe(narrative.id, {
              evidenceId,
              platform: article.arena,
              note: `Observed in an external briefing submission for ${pkg.localDate}; no actor attribution was inferred.`,
            }, actor);
          }
          narrativeIdByTitle.set(article.narrativeTitle, narrative.id);
        }

        /* ── 7. Build the publication inputs ──────────────────────────────── */
        const inputs: CreatePublication[] = [
          {
            kind: "brief",
            section: "daily_brief",
            title: resolvedDaily.title,
            summary: resolvedDaily.summary,
            body: resolvedDaily.rawBody,
            language: "en",
            itemIds: dailyItems.map((item) => item.id),
            evidenceIds: resolvedDaily.evidenceIds,
            passages: publicationPassages(resolvedDaily.passages, dailyItems.map((item) => item.id)),
          },
          ...articleWork.map((work) => {
            const { index, article, resolved, evidenceBasis } = work;
            const items = articleItemsByIndex.get(index) ?? [];
            const narrativeWatchDetails: NarrativeWatchDetails | undefined = article.narrativeWatch
              ? resolveNarrativeWatchDetails(article.narrativeWatch, evidenceBasis, evidenceIdByCitationKey)
              : undefined;
            return {
              kind: "news_update" as const,
              section: article.section,
              title: resolved.title,
              summary: resolved.summary,
              body: resolved.rawBody,
              language: "en",
              itemIds: items.map((item) => item.id),
              evidenceIds: resolved.evidenceIds,
              passages: publicationPassages(resolved.passages, items.map((item) => item.id)),
              narrativeIds: article.section === "narrative_watch" && article.narrativeTitle
                ? [narrativeIdByTitle.get(article.narrativeTitle)!]
                : undefined,
              editorialTopic: article.editorialTopic,
              primaryActor: article.primaryActor ?? undefined,
              arena: article.arena,
              featuredIsraelStory: article.featuredIsraelStory,
              narrativeWatchDetails,
            } satisfies CreatePublication;
          }),
        ];

        /* ── 8. Publish, honouring the operator kill switch ───────────────── */
        const features = briefingFeatures();
        const control = await store.control();
        const automaticPublication = features.autoPublish && !control.automaticPublicationPaused;
        const candidateKeys = candidates.map((candidate) => candidate.key);
        const provenance = {
          briefingRunId,
          machineAuthor: EXTERNAL_BRIEFING_AUTHOR,
          candidateKeys,
          supersedeLocalDate: undefined,
        };

        const created: Publication[] = automaticPublication
          ? await publicationWriter.autoPublishMany(inputs, provenance, actor, requestId)
          : await publicationWriter.createMany(inputs, actor, requestId, {
              briefingRunId: provenance.briefingRunId,
              machineAuthor: provenance.machineAuthor,
              candidateKeys: provenance.candidateKeys,
            });

        /* ── 9. Build and persist the result ──────────────────────────────── */
        const publications: ExternalBriefingPublication[] = created.map((row) => ({
          id: row.id,
          publicId: row.publicId,
          section: row.section,
          title: row.title,
          path: `/articles/${row.publicId}`,
          url: `${SITE_URL}/articles/${row.publicId}`,
        }));

        const result = externalBriefingPublishResultSchema.parse({
          runId: pkg.runId,
          status: automaticPublication ? "published" : "draft",
          localDate: pkg.localDate,
          evidenceCreated,
          publications,
          briefUrl: `${SITE_URL}/geopolitical-brief`,
        });

        await d.execute(sql`
          UPDATE external_briefing_submission
          SET status = ${result.status},
              evidence_created = ${evidenceCreated},
              result = ${JSON.stringify(result)}::jsonb,
              briefing_run_id = ${briefingRunId}
          WHERE id = ${submissionId}
        `);

        return result;
      });
    },
  };
}

/* ── Idempotency helpers ─────────────────────────────────────────────────── */

/** A stable, recursively key-sorted JSON string. Plain `JSON.stringify` does
 * not guarantee key order is stable across two equivalent objects built by
 * different code paths, and hashing the raw request body text would make
 * whitespace-only differences look like a content mismatch. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Keep external runs independent without weakening the internal pipeline's
 * `(local_date, stage)` idempotency constraint. `runId` is contract-validated
 * and unique in `external_briefing_submission`. */
function externalPublishStage(runId: string): string {
  return `external_publish:${runId}`;
}

/* ── Publisher and citation resolution ───────────────────────────────────── */

function hostnameOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** Registers a package publisher as a `source` row, mirroring the
 * `findOrCreateFallbackSource`-style block in `sources/ingest.ts`
 * (`resolveEvidenceSource`, ~line 247) that registers a publisher first seen
 * through attribution rather than through its own feed.
 *
 * The contract's header comment calls this a `source.kind` of
 * `external_package`, but that is not a legal value — `SOURCE_KINDS` in
 * `server/contracts/enums.ts` has no such entry. `manual` is the value the
 * existing ingest fallback already uses for exactly this situation (a
 * publisher registered by attribution, not by its own feed), so this reuses
 * it rather than inventing a new one the schema does not accept. */
async function resolvePublisherSource(
  sources: ReturnType<typeof sourceRepo>,
  families: ReturnType<typeof sourceFamilyRepo>,
  publisher: ExternalPublisher,
  composer: string,
): Promise<{ sourceId: string; sourceFamilyId: string }> {
  const homepageUrl = publisher.homepageUrl.replace(/\/$/, "");
  const existing = await sources.byHomepageUrl(homepageUrl);
  if (existing) return { sourceId: existing.id, sourceFamilyId: existing.sourceFamilyId };

  const host = hostnameOf(homepageUrl);
  const suffix = integrityHash(homepageUrl).slice(0, 12);
  const familySlug = `publisher-${suffix}`;
  const family = (await families.bySlug(familySlug)) ?? await families.insert({
    slug: familySlug,
    label: publisher.name || host,
    description: `Publisher first registered from an external briefing submission (${composer}).`,
  });
  const category = sourceCategoryForDomain(host)
    ?? (publisher.official && publisher.country === "IL" ? "official_israeli" : null);
  const created = await sources.insert({
    sourceFamilyId: family.id,
    kind: "manual",
    slug: `publisher-${suffix}`,
    name: publisher.name || host,
    homepageUrl,
    feedUrl: null,
    language: publisher.language,
    country: publisher.country,
    active: false,
    config: {
      discoveredBy: "external_briefing",
      hostname: host,
      category,
      composer,
      official: publisher.official,
    },
  });
  return { sourceId: created.id, sourceFamilyId: created.sourceFamilyId };
}

/* ── Claim / passage resolution ──────────────────────────────────────────── */

function mustResolveEvidenceId(map: ReadonlyMap<string, string>, citationKey: string): string {
  const evidenceId = map.get(citationKey);
  if (!evidenceId) {
    /* Unreachable once the package has passed `externalBriefingPackageSchema`
     * — its superRefine requires every citationKey used anywhere to resolve
     * to a real `citations[]` entry. Guarded anyway rather than trusting a
     * non-null assertion across a module boundary. */
    throw new ApiError("INTERNAL_ERROR", `Citation key "${citationKey}" did not resolve to an evidence row.`);
  }
  return evidenceId;
}

function resolveClaim(claim: ExternalClaim, map: ReadonlyMap<string, string>): DraftClaim {
  return {
    title: claim.title,
    text: claim.text,
    layer: claim.layer,
    assessment: claim.assessment,
    attributedTo: claim.attributedTo,
    uncertainty: claim.uncertainty,
    evidenceLinks: claim.citationLinks.map((link) => ({
      evidenceId: mustResolveEvidenceId(map, link.citationKey),
      relation: link.relation,
      strength: link.strength,
      rationale: link.rationale,
    })),
  };
}

function resolvePassage(passage: ExternalPassage, map: ReadonlyMap<string, string>): DraftPassage {
  return {
    text: passage.text,
    claimIndex: passage.claimIndex,
    evidenceIds: passage.citationKeys.map((key) => mustResolveEvidenceId(map, key)),
  };
}

/** Text-only: the publication `body` is the raw (undeduped) passage text,
 * never the quality candidate's deduped set — exactly what `bodyFromPassages`
 * in service.ts does for an internally drafted edition. Works on both the
 * raw `ExternalPassage[]` (for a publication body) and a resolved
 * `DraftPassage[]` (for a quality candidate body), since both carry `.text`. */
function bodyFromPassages(passages: readonly { text: string }[]): string {
  return passages.map((passage) => passage.text.trim()).join("\n\n");
}

/** The `dailyAsContent` + `dailyBody` logic from service.ts, combined and
 * adapted to citation keys. */
function resolveDailyBrief(brief: ExternalDailyBrief, map: ReadonlyMap<string, string>): Resolved {
  const sections = [
    { label: brief.situation.label, passages: brief.situation.passages },
    { label: brief.keyEvents.label, passages: brief.keyEvents.passages },
    ...(brief.israeliPosition ? [{ label: brief.israeliPosition.label, passages: brief.israeliPosition.passages }] : []),
    ...(brief.internationalResponses
      ? [{ label: brief.internationalResponses.label, passages: brief.internationalResponses.passages }]
      : []),
    { label: brief.watchPoints.label, passages: brief.watchPoints.passages },
  ];
  const rawBody = sections.map((section) => `## ${section.label}\n\n${bodyFromPassages(section.passages)}`).join("\n\n");
  const allPassages = sections.flatMap((section) => section.passages);
  return {
    title: brief.title,
    summary: brief.summary,
    evidenceIds: brief.citationKeys.map((key) => mustResolveEvidenceId(map, key)),
    claims: brief.claims.map((claim) => resolveClaim(claim, map)),
    passages: dedupeDraftPassages(allPassages.map((passage) => resolvePassage(passage, map))),
    rawBody,
  };
}

/** The `qualityCandidate`-feeding half of an article, adapted to citation
 * keys. `evidenceBasis` drives the `narrativeWatchTitle` prefix exactly as
 * `normalizeEditionForQuality` bakes it into the stored title at draft time
 * in service.ts — `narrativeWatchTitle()` is the only headline prefixer
 * (see CLAUDE.md), and it is idempotent, so this is safe even if a composer
 * already sent a prefixed title. */
function resolveArticle(
  article: ExternalArticle,
  map: ReadonlyMap<string, string>,
  evidenceBasis: EvidenceBasis,
): Resolved {
  const title = article.section === "narrative_watch"
    ? narrativeWatchTitle(article.title, evidenceBasis).slice(0, 300)
    : article.title;
  return {
    title,
    summary: article.summary,
    evidenceIds: article.citationKeys.map((key) => mustResolveEvidenceId(map, key)),
    claims: article.claims.map((claim) => resolveClaim(claim, map)),
    passages: dedupeDraftPassages(article.passages.map((passage) => resolvePassage(passage, map))),
    rawBody: bodyFromPassages(article.passages),
  };
}

function resolveNarrativeWatchDetails(
  details: ExternalNarrativeWatch,
  evidenceBasis: EvidenceBasis,
  map: ReadonlyMap<string, string>,
): NarrativeWatchDetails {
  return {
    exactClaim: details.exactClaim,
    propagators: details.propagators,
    arenas: details.arenas,
    trendDirection: details.trendDirection,
    israeliPosition: details.israeliPosition,
    securityContext: details.securityContext,
    supportingEvidenceIds: details.supportingCitationKeys.map((key) => mustResolveEvidenceId(map, key)),
    contradictingEvidenceIds: details.contradictingCitationKeys.map((key) => mustResolveEvidenceId(map, key)),
    verificationState: details.verificationState,
    knownUnknowns: details.knownUnknowns,
    evidenceBasis,
  };
}

/** The `qualityCandidate` helper from service.ts. `basis` carries what the
 * candidate's prose cannot answer on its own: whether it cites anything,
 * which claim it answers, and what it concluded — derived upstream from
 * `citationKeys.length === 0`, never read off the package. */
function buildCandidate(
  key: string,
  resolved: Resolved,
  section: QualityCandidate["section"],
  basis: QualityBasis,
): QualityCandidate {
  return {
    key,
    section,
    title: resolved.title,
    summary: resolved.summary,
    body: bodyFromPassages(resolved.passages),
    evidenceIds: resolved.evidenceIds,
    claims: resolved.claims,
    passages: resolved.passages,
    basis,
  };
}

/** The `publicationPassages` helper from service.ts. */
function publicationPassages(
  passages: readonly DraftPassage[],
  claimItemIds: readonly string[],
): NonNullable<CreatePublication["passages"]> {
  return dedupeDraftPassages(passages).map((passage) => ({
    text: passage.text,
    itemId: claimItemIds[passage.claimIndex],
    evidenceIds: passage.evidenceIds,
  }));
}

/* ── Claim materialisation ───────────────────────────────────────────────── */

/** The `materializeClaims` closure from `service.ts`'s `publish()`, adapted
 * to take its collaborators as parameters rather than closing over them. */
async function materializeClaims(
  itemWriter: ReturnType<typeof itemService>,
  evidenceWriter: ReturnType<typeof itemEvidenceService>,
  store: ReturnType<typeof briefingRepo>,
  claims: readonly DraftClaim[],
  actor: Actor,
  requestId?: string,
): Promise<InformationItem[]> {
  const claimItems: InformationItem[] = [];
  for (const claim of claims) {
    const item = await itemWriter.autoCreate({
      type: "claim",
      title: claim.title,
      canonicalText: claim.text,
      summary: `${claim.assessment}: machine classification from linked public source material.`,
      language: "en",
    }, actor, requestId);
    /* No `ai_run` row backs a claim materialised from an externally composed
     * package; `recordClaim`'s `aiRunId` parameter is nullable for this. */
    await store.recordClaim(item.id, claim, null);
    for (const link of claim.evidenceLinks) {
      await evidenceWriter.link(item.id, link, actor, requestId);
    }
    claimItems.push(item);
  }
  return claimItems;
}
