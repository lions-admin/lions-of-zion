import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { PublicationMeta, SourceList } from "@/components/content";
import { getOurHeroesEdition } from "@/lib/content/our-heroes";
import type { HeroProfile } from "@/lib/content/our-heroes";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "The people behind the story: the fallen, the fighters, the rescuers.";
const PAGE_URL = `${SITE_URL}/our-heroes`;

export async function generateMetadata(): Promise<Metadata> {
  const edition = await getOurHeroesEdition();
  const publishedTime = new Date(edition.publishedAt).toISOString();
  return {
    title: "Our Heroes",
    description: TAGLINE,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: "Our Heroes — LIONS OF ZION",
      description: TAGLINE,
      type: "article",
      publishedTime,
    },
  };
}

function Citation({ hero, featured }: { hero: HeroProfile; featured?: boolean }) {
  return (
    <article
      className={`${styles.citation} ${featured ? styles.citationFeatured : ""}`}
      aria-label={`Citation: ${hero.name}`}
    >
      <p className={styles.citationKicker}>In recognition — October 7, 2023</p>
      <h3 className={styles.citationName}>{hero.name}</h3>
      <div className={styles.citationRule} aria-hidden="true" />
      <div className={styles.citationClassify}>
        <span className={styles.citationRole}>{hero.role}</span>
        <span className={styles.citationMeta}>{hero.meta}</span>
      </div>
      <p className={styles.citationBody}>{hero.summary}</p>
      <div className={styles.citationSources}>
        <span className={styles.citationSourcesKicker}>Sources</span>
        <SourceList sources={hero.sources} />
      </div>
    </article>
  );
}

function heroesJsonLd(edition: Awaited<ReturnType<typeof getOurHeroesEdition>>) {
  const heroes = [edition.featured, ...edition.profiles];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Our Heroes",
        url: PAGE_URL,
        datePublished: new Date(edition.publishedAt).toISOString(),
        author: { "@type": "Organization", name: "Lions of Zion" },
        publisher: { "@type": "Organization", name: "Lions of Zion" },
        about: heroes.map((hero) => ({ "@type": "Person", name: hero.name })),
      },
      ...heroes.map((hero) => ({
        "@type": "Person",
        name: hero.name,
        description: hero.summary,
      })),
    ],
  };
}

export default async function Page() {
  const edition = await getOurHeroesEdition();

  return (
    <SectionPage id="our-heroes" surface="quiet" title="Our Heroes" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(heroesJsonLd(edition)) }}
      />
      {/* The consent boundary comes first, and marked. It is a binding
          commitment (`.ai/DECISIONS.md`, 2026-08-25), and read after three
          corner-bracketed citations it arrives too late: the frame, the "In
          recognition" formula and the commendation register have by then
          told a reader these are memorials built with the families, which is
          exactly what they are not. War Update is the in-repo precedent for
          both the treatment and the placement. The wording is unchanged and
          ungated; only the heading is new, so it names the limit rather than
          reading as a production note. The `.standfirst` rules are local —
          War Update's module is not `composes:`-ed and the shell is not
          touched (2026-08-25 composition decision). */}
      <SectionBlock heading="What this page will not publish">
        <p className={styles.standfirst}>
          <span className={styles.standfirstLabel}>Consent boundary —</span>{" "}
          Every profile here is built only from what is already extensively
          reported by named, mainstream press — never from a private
          submission, and never with a detail beyond what is cited. This
          site does not yet have a family-consent process for new hero
          stories; until it does, this page stays limited to stories the
          subject or their family has already chosen to make public, on the
          record, more than once. If that changes, this page changes with
          it.
        </p>
      </SectionBlock>

      <SectionBlock heading="Citations">
        <Citation hero={edition.featured} featured />
        <div className={styles.citationGrid}>
          {edition.profiles.map((hero) => (
            <Citation key={hero.id} hero={hero} />
          ))}
        </div>
      </SectionBlock>

      {/* A colophon, not a masthead: `publishedAt` and `reviewedBy` were
          declared and reaching no reader, while the other three editorial
          destinations rendered the same two through `PublicationMeta`. At the
          foot, where a reader who has read the page is the one asking who
          checked it. */}
      <PublicationMeta
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
      />
    </SectionPage>
  );
}
