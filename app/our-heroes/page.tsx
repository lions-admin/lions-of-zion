import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { PublicationMeta, SourceList } from "@/components/content";
import {
  Card,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
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

/**
 * One record: a name, what they did, and where it is written down.
 *
 * The name is the first thing in the record and the largest thing in it —
 * `CardTitle` renders an `h2`, so it is also what the contents rail and the
 * mobile drawer list, which means the page's navigation is a list of people
 * rather than a list of sections. Nothing here is revealed on hover and
 * nothing is behind a control: the sources sit in the record, open, beside
 * the sentences they support.
 */
function MemorialRecord({
  hero,
  featured = false,
}: {
  hero: HeroProfile;
  featured?: boolean;
}) {
  return (
    <Card
      as="article"
      id={hero.id}
      variant={featured ? "dossier" : "row"}
      className={featured ? styles.featured : styles.record}
    >
      <CardTitle
        as="h2"
        className={featured ? `${styles.name} ${styles.featuredName}` : styles.name}
      >
        {hero.name}
      </CardTitle>
      <CardHeader className={styles.header}>
        <CardEyebrow>{hero.role}</CardEyebrow>
        <span className={styles.meta}>{hero.meta}</span>
      </CardHeader>
      <p className={styles.story}>{hero.summary}</p>
      {/* Above 64rem this moves out of the record's flow and stands beside
          the story rather than under it, so a citation is adjacent to the
          claim it carries. Below that it stays where it is — a stacked
          column is the correct reading order and the only one on a phone. */}
      <div className={styles.sources}>
        <span className={styles.sourcesKicker}>Sources</span>
        <SourceList sources={hero.sources} />
      </div>
    </Card>
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
  const roll = [edition.featured, ...edition.profiles];

  return (
    <SectionPage
      id="our-heroes"
      register="muted"
      surface="quiet"
      title="Our Heroes"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(heroesJsonLd(edition)) }}
      />
      {/* Consent is the first claim this page makes. Wording is the binding
          boundary (`.ai/DECISIONS.md`, 2026-08-25) and is not gated or
          paraphrased. The standfirst treatment stays local. */}
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

      {/* The names, before anything is said about them.
          A roll, not a summary and not a count: no tally of the fallen, no
          figure to compare, nothing that turns people into a metric. It is
          also the page's no-JavaScript navigation — the contents rail lists
          exactly these names above 1220px and the drawer does below it, so
          this list hides only where the rail has taken the job. */}
      <nav className={styles.roll} aria-label="Names in this edition">
        <span className={styles.rollKicker}>In this edition</span>
        <ul className={styles.rollList}>
          {roll.map((hero) => (
            <li key={hero.id}>
              <Link href={`#${hero.id}`}>
                <span className={styles.rollName}>{hero.name}</span>
                <span className={styles.rollRole}>{hero.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.records}>
        <MemorialRecord hero={edition.featured} featured />
        {edition.profiles.map((hero) => (
          <MemorialRecord key={hero.id} hero={hero} />
        ))}
      </div>

      <PublicationMeta
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
      />
    </SectionPage>
  );
}
