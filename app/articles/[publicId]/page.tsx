import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { SITE_URL } from "@/lib/site-config";
import { supersededBy } from "@/lib/superseded-publications";
import { stripSourceDump } from "@/lib/source-dump";
import { facebookShareUrl, xIntentUrl } from "@/lib/content/share-text";
import { absoluteMediaUrl, articleHeroMedia } from "@/lib/content/homepage-media";
import {
  publicationHomepageSection,
  publicationHubCrumb,
  publicationParentCrumb,
  publicationSectionLabel,
  publicationSupportsInvestigationExplorer,
  routePublication,
  SECTIONS_BY_HOMEPAGE_SECTION,
} from "@/lib/publication-routing";
import Link from "next/link";
import { getPublicPublication, isMissingPublication, listBriefingPublications } from "@/lib/publications";
import {
  CONTINUATION_LABELS,
  continuationPool,
  continueTheRecord,
  type ContinuationReason,
} from "@/lib/continue-the-record";
import type { PublicationSection } from "@/server/contracts/enums";
import { ANALYSIS_AUTHOR, isAnalysisBasis, PUBLICATION_PROVENANCE, publicationProvenance } from "@/server/contracts/publication";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import {
  SECTION_LABELS,
  TREND_LABELS,
  VERIFICATION_STATES,
} from "@/components/live/publication-labels";
import {
  CorrectionHistory,
  KnownUnknownPanel,
  PublicationMeta,
  SourceList,
  type Source,
} from "@/components/content";
import {
  MediaBlock,
  isManufacturedMedia,
  mediaDisclosure,
} from "@/components/content/MediaBlock";
import { EditorialShell } from "@/components/site/EditorialShell";
import { Badge, type BadgeStatus, BADGE_GRAMMAR } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/site/Breadcrumb";
import { InvestigationExplorer } from "@/components/evidence/InvestigationExplorer";
import { ShareControls } from "@/components/support/ShareControls";
import { Card, CardDescription, CardEyebrow, CardTitle } from "@/components/ui/Card";
import styles from "./article.module.css";

type Props = { params: Promise<{ publicId: string }> };

/** A machine facet — `defense_policy_and_programs` — printed as words. */
function words(value: string): string {
  return value.replaceAll("_", " ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  try {
    const article = await getPublicPublication(publicId);
    const articleMedia = articleHeroMedia(article);
    const articleImage = articleMedia ? absoluteMediaUrl(articleMedia.src) : undefined;
    const canonical = SITE_URL + "/articles/" + article.publicId;
    /* T-12. A record with no hero used to emit no `og:image` while still
       declaring `twitter:card = summary_large_image`, so 57 of 73 articles
       previewed as a bare title stub — and `opengraph-image.tsx` in this very
       segment was rendering a real per-article card the whole time, deployed
       and returning 200, referenced by nothing. Next only applies that file
       convention when the page does not define `openGraph` itself, and this
       function does. Naming the route explicitly is what connects them.

       Preferring the generated card over the site card here is deliberate: it
       carries this article's own headline, so a shared link says which record
       it opens rather than only which site. */
    const social = articleImage
      ? [{ url: articleImage, width: articleMedia!.width, height: articleMedia!.height, alt: articleMedia!.alt }]
      : [{ url: `${canonical}/opengraph-image`, width: 1200, height: 630, alt: article.title }];
    return {
      title: article.title,
      description: article.summary ?? article.title,
      alternates: { canonical },
      openGraph: {
        type: "article",
        title: article.title,
        description: article.summary ?? article.title,
        /* T-12.b: articles were the one route family omitting og:url, so a
           scraper had to infer the address from the link it followed. */
        url: canonical,
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        images: social,
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.summary ?? article.title,
        images: [social[0]!.url],
      },
    };
  } catch (cause) {
    if (isMissingPublication(cause)) return { title: "Article not found" };
    throw cause;
  }
}

export default async function ArticlePage({ params }: Props) {
  const { publicId } = await params;
  let article: PublicPublicationDetail;
  try {
    article = await getPublicPublication(publicId);
  } catch (cause) {
    if (isMissingPublication(cause)) {
      /* VA-48.6. A record archived as a duplicate leaves the public corpus,
         which is what takes it out of search — but its URL may still be in a
         reader's history or a search index, and 404 is the wrong answer when
         the story itself is still published at the canonical address. The
         lookup runs only after the record was genuinely not found, so a stale
         map entry can never shadow a live publication. */
      const canonical = supersededBy(publicId);
      if (canonical) permanentRedirect(`/articles/${canonical}`);
      notFound();
    }
    throw cause;
  }

  /* VA-50. The pool is this record's own desk, which is where a continuation
     for it can plausibly live; `continueTheRecord` then requires a shared
     field, so a wide pool cannot turn into filler. A failure here must never
     take the article down with it — the page falls back to the hub link, which
     is the same thing an empty result produces. */
  const deskSections = SECTIONS_BY_HOMEPAGE_SECTION[publicationHomepageSection(article.section)];
  const continuations = continueTheRecord(
    article,
    await continuationPool(deskSections, (section) =>
      listBriefingPublications(`section=${section}&limit=25`)),
  );
  const desk = publicationHubCrumb(publicationHomepageSection(article.section));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: SITE_URL + "/articles/" + article.publicId,
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
  };
  const visiblePassages = collapsePublicPassages(article.passages);
  const articleMedia = articleHeroMedia(article);
  /* Read `=== "analysis"` and never the negation: a record whose basis is
     absent or unrecognised must be treated as a sourced one, which is the
     reading that keeps its citations required. */
  const isAnalysis = isAnalysisBasis(article.narrativeWatchDetails);
  const parent = publicationParentCrumb(article.section);
  const details = article.narrativeWatchDetails;
  /* VA-56. Some bodies still end with the composer's own "Sources:" block,
     which the structured stack below the prose already presents properly.
     `stripSourceDump` removes it only when every address in it is in that
     stack, so `publicSourceState` can never flip from `pending` to
     `unsourced` as a result — see `lib/source-dump.ts`. */
  const stackUrls = article.sources.map((source) => source.url).filter((url): url is string => Boolean(url));
  const readableBody = stripSourceDump(article.body, stackUrls);
  /* A record with structured passages never reaches the body fallback, and the
     dump usually sits in the last passage — so it has to be stripped there too,
     and a passage that was nothing but the dump is dropped entirely. */
  const readablePassages = visiblePassages
    .map((passage) => ({ ...passage, text: stripSourceDump(passage.text, stackUrls, { allowEmpty: true }) }))
    .filter((passage) => passage.text.trim().length > 0);
  const passages = readablePassages.length
    ? readablePassages
    : readableBody.split(/\r?\n\r?\n+/).map((text, index) => ({
        position: index + 1,
        text,
        claim: null,
        sources: [],
      }));
  const articleUrl = `${SITE_URL}/articles/${article.publicId}`;
  const shareText = article.summary ?? article.title;
  /* Whether this record may be staged as an investigation is derived from its
     section in `lib/publication-routing.ts` — the same place hub, route,
     homepage band and label come from. There is deliberately no section list
     in this file. Having content to show is still required, but it is no
     longer sufficient. */
  const showsInvestigationExplorer =
    publicationSupportsInvestigationExplorer(article.section) &&
    Boolean(details || article.sources.length || article.passages.length);
  const sourceState = publicSourceState({
    sourceCount: article.sources.length,
    isAnalysis,
    body: article.body,
    passages: visiblePassages,
  });
  /* VA-13. A picture we *made* must not be the first thing a reader of a
     contested claim interprets, so on a claim page it waits until the status
     and the claim have been stated. Both halves are derived, neither is
     hand-written here: the desk comes from `publicationSupportsInvestigation-
     Explorer` in `lib/publication-routing.ts` — the same map the hub, route,
     homepage band and label come from — and "made rather than taken" comes
     from the media contract's own `role`. A photograph keeps its place; an
     illustration moves. */
  const deferHeroMedia =
    articleMedia !== null &&
    publicationSupportsInvestigationExplorer(article.section) &&
    isManufacturedMedia(articleMedia.role);
  const heroMedia = articleMedia ? (
    <MediaBlock
      layout="reading"
      aspectRatio="8 / 5"
      /* The line that says what this image is not stays outside the control
         below it, at every width and with any credit string. */
      disclosure={mediaDisclosure(articleMedia)}
      caption={articleMedia.caption}
      credit={
        <>
          {articleMedia.credit}
          {articleMedia.sourceUrl ? (
            <>
              {" · "}
              <a href={articleMedia.sourceUrl} target="_blank" rel="noreferrer">
                Image source <span aria-hidden="true">↗︎</span>
              </a>
            </>
          ) : null}
        </>
      }
      provenance={`Rights ${articleMedia.rights.status} · ${articleMedia.rights.basis}`}
      provenanceLabel="Image credit and provenance"
    >
      <Image
        src={articleMedia.src}
        width={articleMedia.width}
        height={articleMedia.height}
        alt={articleMedia.alt}
        priority={!deferHeroMedia}
        sizes="(min-width: 1220px) 780px, calc(100vw - 40px)"
        style={{ objectPosition: `${articleMedia.focalPoint.x}% ${articleMedia.focalPoint.y}%` }}
      />
    </MediaBlock>
  ) : null;

  return (
    <EditorialShell
      routeId="articles"
      backdropSeed={article.publicId}
      /* VA-59. Every article ran the scan at the same reduced strength, which
         meant a Ministry of Defence announcement carried the same signal
         aesthetic as an influence investigation. The register is derived from
         the same predicate that decides whether a record may be staged as an
         investigation at all — so a section that changes desk changes its
         backdrop with it, and there is no section list in this file. */
      register={publicationSupportsInvestigationExplorer(article.section) ? "muted" : "silent"}
      className={styles.page}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className={styles.article} id="page-content">
        <Breadcrumb
          className={styles.breadcrumb}
          trail={[parent]}
          current={article.title}
        />

        <header className={styles.head}>
          <div className={styles.kickerRow}>
            <Badge variant="gold" dot>
              {SECTION_LABELS[article.section]}
            </Badge>
            {isAnalysis ? (
              <Badge variant="neutral">Organisation analysis · no documentary source</Badge>
            ) : null}
            {article.featuredIsraelStory ? (
              <Badge variant="gold">Featured Israel story</Badge>
            ) : null}
          </div>
          <h1>{article.title}</h1>
          {article.summary ? <p className={styles.summary}>{article.summary}</p> : null}
        </header>

        {deferHeroMedia ? null : heroMedia}

        <section className={styles.facts} aria-label="Publication facts">
          <PublicationMeta
            publishedAt={formatDate(article.publishedAt)}
            updatedAt={article.updatedAt !== article.publishedAt ? formatDate(article.updatedAt) : undefined}
            authorship={PUBLICATION_PROVENANCE[publicationProvenance(article)].label}
            sourceCount={sourceState === "listed" || sourceState === "unsourced" ? article.sources.length : undefined}
          />
          {article.editorialTopic || article.primaryActor || article.arena ? (
            <dl className={styles.factsExtra}>
              {article.editorialTopic ? (
                <div>
                  <dt>Topic</dt>
                  <dd>{words(article.editorialTopic)}</dd>
                </div>
              ) : null}
              {article.primaryActor ? (
                <div>
                  <dt>Primary actor</dt>
                  <dd>{words(article.primaryActor)}</dd>
                </div>
              ) : null}
              {article.arena ? (
                <div>
                  <dt>Arena</dt>
                  <dd>{words(article.arena)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>

        <section className={styles.share} aria-label="Share this record">
          <ShareControls
            url={articleUrl}
            title={article.title}
            text={shareText}
            lead="Share the sourced record, including its date and context."
            copyLabel="Copy the sourced record"
            targets={[
              { label: "Share on X", href: xIntentUrl(shareText, articleUrl) },
              { label: "Facebook", href: facebookShareUrl(articleUrl) },
            ]}
          />
        </section>

        {details ? (
          <section className={styles.narrativeDetails}>
            <p className={styles.kicker}>Narrative Watch</p>
            <h2>{isAnalysis ? "Analysis record" : "Claim record"}</h2>
            {/* Deliberately a paragraph above the list rather than a tenth row
                inside it. Nine metadata rows are skimmed; this one is the whole
                promise the record rests on and has to be read. */}
            {isAnalysis ? (
              <p className={styles.analysisNote}>
                This record answers a circulating narrative rather than reporting one. The assessment
                is our own and cites no documentary source — read it as Lions of Zion&rsquo;s analysis,
                not as documented fact. The claim it answers is stated in full below.
              </p>
            ) : null}
            <p className={styles.verdictLine}>
              <Badge status={details.verificationState}>
                {VERIFICATION_STATES[details.verificationState].label}
              </Badge>
              <span className={styles.verdictMeaning}>
                {VERIFICATION_STATES[details.verificationState].meaning}
              </span>
            </p>
            <dl>
              <div>
                <dt>Evidence basis</dt>
                <dd>{isAnalysis ? ANALYSIS_AUTHOR : "Cited public sources"}</dd>
              </div>
              <div>
                <dt>Exact claim</dt>
                <dd>{details.exactClaim}</dd>
              </div>
              <div>
                <dt>Trend</dt>
                <dd>{TREND_LABELS[details.trendDirection]}</dd>
              </div>
              <div>
                <dt>Observed propagators</dt>
                <dd>{details.propagators.join(", ") || "No attributable propagator is recorded."}</dd>
              </div>
              <div>
                <dt>Arenas</dt>
                <dd>{details.arenas.map(words).join(", ")}</dd>
              </div>
              {details.israeliPosition ? (
                <div>
                  <dt>Israeli position</dt>
                  <dd>{details.israeliPosition}</dd>
                </div>
              ) : null}
              {details.securityContext ? (
                <div>
                  <dt>Security context</dt>
                  <dd>{details.securityContext}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}

        {/* The made picture's place on a claim page: after the verdict and the
            exact claim, not above them. */}
        {deferHeroMedia ? heroMedia : null}

        {showsInvestigationExplorer ? <InvestigationExplorer record={article} /> : null}

        <div className={styles.body}>
          {passages.map((passage) => (
            <section className={styles.passage} key={passage.position}>
              <div className={styles.passageMain}>
                <p>{passage.text}</p>
                {passage.claim ? (
                  <p className={styles.claimRef}>
                    <span>
                      Claim record: {passage.claim.title}
                    </span>
                    {passage.claim.assessment ? (
                      <Badge status={badgeStatus(passage.claim.assessment)}>
                        {passage.claim.assessment.replaceAll("_", " ")}
                      </Badge>
                    ) : null}
                  </p>
                ) : null}
              </div>
              {passage.sources.length ? (
                <div className={styles.passageSources}>
                  <SourceList sources={asSourceList(passage.sources)} />
                </div>
              ) : null}
            </section>
          ))}
        </div>

        {/* An analysis record has nothing to list here, and a bare "no sources"
            line reads as a malfunction. State the position instead: the absence
            is the disclosure, not a gap in the page. If such a record ever does
            carry sources, they are shown normally rather than denied. */}
        {sourceState === "analysis" ? (
          <section className={styles.sources}>
            <h2>Why this record cites no source</h2>
            <p>
              This is Lions of Zion&rsquo;s own assessment, published deliberately without a
              documentary source to cite. Nothing is being withheld: the claim it answers, and what
              remains unknown about it, are set out in the analysis record above.
            </p>
          </section>
        ) : (
          <section className={styles.sources}>
            <h2>Public sources</h2>
            {sourceState === "listed" ? (
              <ol className={styles.sourceStack}>
                {article.sources.map((source, index) => (
                  <li key={source.url ?? source.title + index}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title} <span aria-hidden="true">↗︎</span>
                      </a>
                    ) : (
                      <span>{source.title}</span>
                    )}
                    <span className={styles.sourceMeta}>
                      {source.publisher}
                      {source.publishedAt ? ` · ${formatSourceDate(source.publishedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            ) : sourceState === "pending" ? (
              /* The text of this record cites material the source stack does
                 not yet carry. Say that, rather than printing "0 sources"
                 above a paragraph with a link in it — the reader can see the
                 citation, and a denial next to it reads as a malfunction or a
                 lie. Nothing is refused or hidden: the record stands, its
                 citations stay in the body, and the stack is stated as
                 incomplete until it is repaired. */
              <p>
                Sources for this record are pending verification. Its text cites published material
                that has not yet been attached to this list; the citations remain visible in the
                article above while that is completed.
              </p>
            ) : (
              <p>No public sources are listed for this article.</p>
            )}
          </section>
        )}

        {details ? (
          <section className={styles.unknowns}>
            <h2>Known unknowns</h2>
            {details.knownUnknowns.length ? (
              <KnownUnknownPanel unknowns={details.knownUnknowns} />
            ) : (
              <p>No further unknowns are recorded.</p>
            )}
          </section>
        ) : null}

        {/* VA-50. "Related coverage" was fed by `publication_related`, which
            `linkRelated` writes for the siblings of a batch — the other records
            of the same daily edition. That is a fact about how a record was
            produced, not about what it is about. Every row here instead shares
            an actual field with this record, and says which one; when nothing
            does, the reader is sent to the desk rather than shown filler. */}
        <section className={styles.related}>
          <h2>Continue the record</h2>
          {continuations.length ? (
            <ul className={styles.relatedList}>
              {continuations.map((next) => (
                <li key={next.publicId}>
                  <Card href={`/articles/${next.publicId}`} variant="row">
                    <CardEyebrow>{continuationEyebrow(next.section, next.reason, desk.label)}</CardEyebrow>
                    <CardTitle as="h3">{next.title}</CardTitle>
                    {next.summary ? <CardDescription>{next.summary}</CardDescription> : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
          <p className={styles.relatedSubhead}>
            <Link href={desk.href}>Everything on {desk.label}</Link>
          </p>
        </section>

        {article.corrections.length ? (
          <section className={styles.corrections}>
            <h2>Corrections and updates</h2>
            <CorrectionHistory
              corrections={article.corrections.map((correction) => ({
                date: formatDate(correction.changedAt),
                note: correction.summary,
                version: `v${correction.version}`,
              }))}
            />
          </section>
        ) : null}
      </article>
    </EditorialShell>
  );
}

/**
 * An absolute `http(s)://` address in prose, and nothing looser.
 *
 * A bare domain — "reported by haaretz.com" — is a mention, not a citation,
 * and matching it would make every article with a publisher's name in it
 * "pending". A false positive here suppresses a truthful source count, so the
 * matcher stays strict: scheme, `//`, and at least one non-space character.
 */
export function citesAbsoluteUrl(text: string): boolean {
  return /https?:\/\/\S/i.test(text);
}

/**
 * What the "Public sources" section is honestly able to say.
 *
 * - `analysis` — the record cites nothing *by design*. `evidenceBasis` is
 *   derived and all-or-nothing, so the absence is itself the disclosure. This
 *   branch is read as `=== "analysis"`, never as its negation, and takes
 *   precedence over everything below it.
 * - `listed` — sources are stored; show them.
 * - `pending` — no stored sources, but the record's own text carries an
 *   absolute URL. The count and the denial are both suppressed: a page cannot
 *   print a citation and deny having one.
 * - `unsourced` — nothing stored and nothing cited. The plain statement is
 *   accurate, so it stands.
 */
export type PublicSourceState = "analysis" | "listed" | "pending" | "unsourced";

export function publicSourceState(input: {
  sourceCount: number;
  isAnalysis: boolean;
  body: string;
  passages?: readonly { text: string }[];
}): PublicSourceState {
  if (input.isAnalysis && input.sourceCount === 0) return "analysis";
  if (input.sourceCount > 0) return "listed";
  const cited =
    citesAbsoluteUrl(input.body) ||
    (input.passages ?? []).some((passage) => citesAbsoluteUrl(passage.text));
  return cited ? "pending" : "unsourced";
}

export function collapsePublicPassages<T extends PublicPublicationDetail["passages"][number]>(passages: T[]): T[] {
  const visible: T[] = [];
  for (const passage of passages) {
    const duplicate = visible.some((existing) => {
      if (!existing.claim || !passage.claim || existing.claim.publicId !== passage.claim.publicId) return false;
      const existingPublishers = new Set(existing.sources.map((source) => source.publisher));
      if (passage.sources.length && !passage.sources.some((source) => existingPublishers.has(source.publisher))) return false;
      return wordSimilarity(existing.text, passage.text) >= 0.58;
    });
    if (!duplicate) visible.push(passage);
  }
  return visible;
}

/**
 * The eyebrow on a "Continue the record" row.
 *
 * The reason comes from `continueTheRecord` — what this destination actually
 * shares with the record being read. The desk is prepended only when the
 * destination sits on a *different* one, which is the rule the previous
 * `relatedLabel` existed for and which VA-50 would otherwise have dropped: a
 * claim assessment sitting under a news article has to say it comes from
 * somewhere else before it is read as more reporting. Both halves derive from
 * `routePublication`, so a section that moves desk moves this label with it,
 * and a same-desk row is not made to carry a redundant prefix.
 */
export function continuationEyebrow(
  section: PublicationSection,
  reason: ContinuationReason,
  currentHub: string,
): string {
  const hub = routePublication(section).hub;
  const reason_ = CONTINUATION_LABELS[reason];
  return hub === currentHub ? reason_ : `${hub} · ${reason_}`;
}

function asSourceList(
  sources: { title: string; publisher: string; url: string | null }[],
): Source[] {
  return sources.map((source, index) => ({
    id: source.url ?? `${source.title}:${source.publisher}:${index}`,
    label: source.title,
    kind: source.publisher,
    url: source.url ?? undefined,
  }));
}

function badgeStatus(value: string): BadgeStatus {
  return Object.hasOwn(BADGE_GRAMMAR, value) ? (value as BadgeStatus) : "neutral";
}

function wordSimilarity(first: string, second: string): number {
  const words = (value: string) => new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  const a = words(first);
  const b = words(second);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}

function formatSourceDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}
