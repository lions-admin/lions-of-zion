import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/site-config";
import { getPublicPublication, isMissingPublication } from "@/lib/publications";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import { EditorialShell } from "@/components/site/EditorialShell";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import styles from "./article.module.css";

type Props = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  try {
    const article = await getPublicPublication(publicId);
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
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.summary ?? article.title,
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

  return (
    <EditorialShell
      routeId="geopolitical-brief"
      backdropSeed={article.publicId}
      register="muted"
      className={styles.page}
      skipLinkClassName={styles.skipLink}
      progressTrackClassName={styles.progressTrack}
      progressValueClassName={styles.progressValue}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className={styles.article} id="page-content">
        <div className={styles.topNav}>
          <ButtonLink href="/geopolitical-brief" variant="ghost" size="sm">
            ← Daily Brief and Updates
          </ButtonLink>
        </div>
        <div className={styles.kickerRow}>
          <Badge variant="gold" dot>
            {article.section.replace(/_/g, " ")}
          </Badge>
        </div>
        <h1>{article.title}</h1>
        {article.summary ? <p className={styles.summary}>{article.summary}</p> : null}
        <p className={styles.meta}>
          Published {formatDate(article.publishedAt)}
          {article.autoPublishedAt ? " · Automatically published daily edition" : ""}
          {article.updatedAt !== article.publishedAt ? " · Updated " + formatDate(article.updatedAt) : ""}
        </p>
        <div className={styles.body}>
          {(visiblePassages.length ? visiblePassages : article.body.split(/\r?\n\r?\n+/).map((text, index) => ({ position: index + 1, text, claim: null, sources: [] }))).map((passage) => (
            <section className={styles.passage} key={passage.position}>
              <p>{passage.text}</p>
              {passage.claim ? <p className={styles.claimRef}>Claim record: {passage.claim.title}{passage.claim.assessment ? ` · ${passage.claim.assessment}` : ""}</p> : null}
              {passage.sources.length ? <ul className={styles.inlineSources}>{passage.sources.map((source, index) => <li key={source.url ?? source.title + index}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.publisher}</a> : source.publisher}</li>)}</ul> : null}
            </section>
          ))}
        </div>
        {article.narrativeWatchDetails ? <section className={styles.narrativeDetails}>
          <p className={styles.kicker}>Narrative Watch</p><h2>Claim record</h2>
          <dl>
            <div><dt>Exact claim</dt><dd>{article.narrativeWatchDetails.exactClaim}</dd></div>
            <div><dt>Trend</dt><dd>{article.narrativeWatchDetails.trendDirection}</dd></div>
            <div><dt>Verification status</dt><dd>{article.narrativeWatchDetails.verificationState}</dd></div>
            <div><dt>Observed propagators</dt><dd>{article.narrativeWatchDetails.propagators.join(", ") || "No attributable propagator is recorded."}</dd></div>
            <div><dt>Arenas</dt><dd>{article.narrativeWatchDetails.arenas.join(", ")}</dd></div>
            {article.narrativeWatchDetails.israeliPosition ? <div><dt>Israeli position</dt><dd>{article.narrativeWatchDetails.israeliPosition}</dd></div> : null}
            {article.narrativeWatchDetails.securityContext ? <div><dt>Security context</dt><dd>{article.narrativeWatchDetails.securityContext}</dd></div> : null}
            <div><dt>Known unknowns</dt><dd>{article.narrativeWatchDetails.knownUnknowns.join(" ") || "No further unknowns are recorded."}</dd></div>
          </dl>
        </section> : null}
        <section className={styles.sources}>
          <h2>Public sources</h2>
          {article.sources.length ? (
            <ul>
              {article.sources.map((source, index) => (
                <li key={source.url ?? source.title + index}>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
                  <span> — {source.publisher}{source.publishedAt ? ` · ${formatSourceDate(source.publishedAt)}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p>No public sources are listed for this article.</p>}
        </section>
        {article.narratives.length ? (
          <section className={styles.narratives}>
            <h2>Related Narrative Watch records</h2>
            <ul>{article.narratives.map((narrative) => <li key={narrative.publicId}>{narrative.title} · {narrative.status}</li>)}</ul>
          </section>
        ) : null}
        {article.relatedArticles.length ? <section className={styles.related}><h2>Related coverage</h2><ul>{article.relatedArticles.map((related) => <li key={related.publicId}><Link href={`/articles/${related.publicId}`}>{related.title}</Link></li>)}</ul></section> : null}
        {article.corrections.length ? <section className={styles.corrections}><h2>Corrections and updates</h2><ol>{article.corrections.map((correction) => <li key={correction.version}><time dateTime={correction.changedAt}>{formatDate(correction.changedAt)}</time><span>{correction.summary}</span></li>)}</ol></section> : null}
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
