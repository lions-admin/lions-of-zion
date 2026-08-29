import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/site-config";
import { getPublicPublication } from "@/lib/publications";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import { EditorialShell } from "@/components/site/EditorialShell";
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
    };
  } catch {
    return { title: "Article not found" };
  }
}

export default async function ArticlePage({ params }: Props) {
  const { publicId } = await params;
  let article: PublicPublicationDetail;
  try {
    article = await getPublicPublication(publicId);
  } catch {
    notFound();
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
        <Link className={styles.back} href="/geopolitical-brief">← Daily Brief and Updates</Link>
        <p className={styles.kicker}>{article.section.replace(/_/g, " ")}</p>
        <h1>{article.title}</h1>
        {article.summary ? <p className={styles.summary}>{article.summary}</p> : null}
        <p className={styles.meta}>
          Published {formatDate(article.publishedAt)}
          {article.autoPublishedAt ? " · Automatically published daily edition" : ""}
          {article.updatedAt !== article.publishedAt ? " · Updated " + formatDate(article.updatedAt) : ""}
        </p>
        <div className={styles.body}>
          {article.body.split(/\r?\n\r?\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <section className={styles.sources}>
          <h2>Public sources</h2>
          {article.sources.length ? (
            <ul>
              {article.sources.map((source, index) => (
                <li key={source.url ?? source.title + index}>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
                  <span> — {source.publisher}</span>
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
      </article>
    </EditorialShell>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}
