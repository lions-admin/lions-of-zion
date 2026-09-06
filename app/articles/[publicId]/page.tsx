import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/site-config";
import { editorialMediaForSurface } from "@/lib/content/homepage-media";
import { publicationParentCrumb, publicationSectionLabel, routePublication } from "@/lib/publication-routing";
import { getPublicPublication, isMissingPublication } from "@/lib/publications";
import type { PublicationSection } from "@/server/contracts/enums";
import { isArticleSafeMedia, type EditorialMedia } from "@/server/contracts/editorial-media";
import { ANALYSIS_AUTHOR, isAnalysisBasis } from "@/server/contracts/publication";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
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
import { EditorialShell } from "@/components/site/EditorialShell";
import { Badge, type BadgeStatus, BADGE_GRAMMAR } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/site/Breadcrumb";
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
    return {
      title: article.title,
      description: article.summary ?? article.title,
      alternates: { canonical: SITE_URL + "/articles/" + article.publicId },
      openGraph: {
        type: "article",
        title: article.title,
        description: article.summary ?? article.title,
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        images: articleMedia ? [{ url: articleImage!, width: articleMedia.width, height: articleMedia.height, alt: articleMedia.alt }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.summary ?? article.title,
        images: articleImage ? [articleImage] : undefined,
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
    if (isMissingPublication(cause)) notFound();
    throw cause;
  }

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
  const passages = visiblePassages.length
    ? visiblePassages
    : article.body.split(/\r?\n\r?\n+/).map((text, index) => ({
        position: index + 1,
        text,
        claim: null,
        sources: [],
      }));

  return (
    <EditorialShell
      routeId="articles"
      backdropSeed={article.publicId}
      register="muted"
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

        {articleMedia ? (
          <figure className={styles.heroMedia}>
            <Image
              src={articleMedia.src}
              width={articleMedia.width}
              height={articleMedia.height}
              alt={articleMedia.alt}
              priority
              sizes="(min-width: 1220px) 780px, calc(100vw - 40px)"
              style={{ objectPosition: `${articleMedia.focalPoint.x}% ${articleMedia.focalPoint.y}%` }}
            />
            <figcaption>
              {articleMedia.caption ? <span>{articleMedia.caption}</span> : null}
              <span>{articleMedia.credit}</span>
            </figcaption>
          </figure>
        ) : null}

        <section className={styles.facts} aria-label="Publication facts">
          <PublicationMeta
            publishedAt={formatDate(article.publishedAt)}
            updatedAt={article.updatedAt !== article.publishedAt ? formatDate(article.updatedAt) : undefined}
            edition={article.autoPublishedAt ? "Automatically published daily edition" : undefined}
            sourceCount={isAnalysis && !article.sources.length ? undefined : article.sources.length}
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
        {isAnalysis && !article.sources.length ? (
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
            {article.sources.length ? (
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

        {article.relatedArticles.length || article.narratives.length ? (
          <section className={styles.related}>
            <h2>Related coverage</h2>
            {article.relatedArticles.length ? (
              <ul className={styles.relatedList}>
                {article.relatedArticles.map((related) => (
                  <li key={related.publicId}>
                    <Card href={`/articles/${related.publicId}`} variant="row">
                      <CardEyebrow>{relatedLabel(related.section)}</CardEyebrow>
                      <CardTitle as="h3">{related.title}</CardTitle>
                      {related.summary ? <CardDescription>{related.summary}</CardDescription> : null}
                    </Card>
                  </li>
                ))}
              </ul>
            ) : null}
            {article.narratives.length ? (
              <>
                <h3 className={styles.relatedSubhead}>Related Narrative Watch records</h3>
                <ul className={styles.narrativeList}>
                  {article.narratives.map((narrative) => (
                    <li key={narrative.publicId}>
                      {narrative.title} · {narrative.status.replaceAll("_", " ")}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

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
 * The record's own picture first, the static registry second.
 *
 * A publication published today carries its hero image on the projection, so
 * nothing has to be mapped by hand for it to appear. `homepage-media.json` is
 * kept as the fallback because the records mapped there predate the field and
 * would otherwise lose the pictures they already have. Checked against
 * `isArticleSafeMedia` rather than trusted: the projection filters, but a page
 * that assumes it did is one refactor away from publishing an uncleared image.
 */
function articleHeroMedia(article: PublicPublication): EditorialMedia | null {
  if (article.media && isArticleSafeMedia(article.media)) return article.media;
  return editorialMediaForSurface(`publication:${article.publicId}`, "article");
}

/** `src` is a local path or an absolute Blob URL; only the first needs a host. */
function absoluteMediaUrl(src: string): string {
  return src.startsWith("/") ? SITE_URL + src : src;
}

/**
 * What a related record is, in the reader's terms and the site's own words.
 *
 * A Narrative Watch record names its desk as well as its kind: a claim
 * assessment sitting under a news article has to say it comes from somewhere
 * else before it is read as more reporting. Both halves come from
 * `routePublication`, so a section that moves desk moves this label with it.
 */
function relatedLabel(section: PublicationSection): string {
  const destination = routePublication(section);
  return section === "narrative_watch"
    ? `${destination.hub} · Related claim assessment`
    : publicationSectionLabel(section);
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
