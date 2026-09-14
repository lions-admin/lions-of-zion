import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { PublicationMeta, SourceList } from "@/components/content";
import {
  Card,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { homepageMedia } from "@/lib/content/homepage-media";
import { getOurHeroesEdition } from "@/lib/content/our-heroes";
import type { HeroProfile } from "@/lib/content/our-heroes";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

const TAGLINE =
  "The people behind the story: the fallen, the fighters, the rescuers.";
const PAGE_URL = `${SITE_URL}/our-heroes`;

export async function generateMetadata(): Promise<Metadata> {
  const edition = await getOurHeroesEdition();
  const publishedTime = new Date(edition.publishedAt).toISOString();
  return pageMetadata({
    title: "Our Heroes",
    description: TAGLINE,
    path: "/our-heroes",
    type: "article",
    publishedTime: publishedTime,
  });
}

/**
 * One record: a face where there is one, a name, what they did, and where it
 * is written down.
 *
 * The name is the first thing in the record's text and the largest thing in
 * it — `CardTitle` renders an `h2`, so it is also what the contents rail and
 * the mobile drawer list, which means the page's navigation is a list of
 * people rather than a list of sections. Nothing here is revealed on hover
 * and nothing is behind a control: the sources sit in the record, open,
 * beside the sentences they support.
 *
 * Every record takes the same `row` composition, the featured one included.
 * It used to be `dossier` — a bordered, shadowed surface around one person
 * while the others sat on hairlines — which made the page's hierarchy a
 * matter of packaging on a page whose whole subject is people. The featured
 * record is distinguished by one step of type and nothing else, which is why
 * it is `data-featured` on the one class rather than a second class: there is
 * no second composition here to name.
 *
 * The portrait comes from the same registry and the same key the homepage and
 * `/people-of-israel` already use (`hero:<id>`, the profile's own `mediaRef`
 * winning), so a face cleared for one surface is the face on all of them and
 * nothing here can publish a picture those surfaces would not. Three of the
 * eight profiles have one; the other five are text-led, and the record is a
 * single column when there is no picture rather than a column with a hole in
 * it. Nothing moves: a portrait on this page does not scale under the pointer
 * the way a record's picture does on the hub, because these are not
 * decoration.
 */
function MemorialRecord({
  hero,
  featured = false,
}: {
  hero: HeroProfile;
  featured?: boolean;
}) {
  const portrait = homepageMedia(`hero:${hero.id}`, hero.mediaRef);
  const caption = portrait?.caption ?? null;
  return (
    <Card
      as="article"
      id={hero.id}
      variant="row"
      className={styles.record}
      data-featured={featured ? "" : undefined}
      data-portrait={portrait ? "" : undefined}
    >
      {portrait ? (
        <figure className={styles.portrait}>
          <span className={styles.portraitFrame}>
            <Image
              src={portrait.src}
              alt={caption === portrait.alt ? "" : portrait.alt}
              width={portrait.width}
              height={portrait.height}
              loading={featured ? "eager" : "lazy"}
              sizes="(max-width: 45rem) 240px, 208px"
              /* The registry's focal point, not the centre of the file: a
                 4/5 plate crops a tall frame top and bottom, and the point
                 of the data is that the crop lands on the face. */
              style={{
                objectPosition: `${portrait.focalPoint.x}% ${portrait.focalPoint.y}%`,
              }}
            />
          </span>
          {/* The caption is rendered, not just used as `alt`, and that is not
              decoration: the picture standing in for Aner Shapira is a
              memorial mural, and a reader who can see it should be told so
              in the same words a screen reader is. `alt` empties where the
              caption says the same thing — the `<figure>` ties the two
              together, and otherwise the sentence is announced twice. */}
          <figcaption className={styles.portraitCaption}>
            {portrait.disclosure ? (
              <span className={styles.portraitDisclosure}>
                {portrait.disclosure}
              </span>
            ) : null}
            {caption ? (
              <span className={styles.portraitCaptionText}>{caption}</span>
            ) : null}
            <span className={styles.portraitCredit}>{portrait.credit}</span>
          </figcaption>
        </figure>
      ) : null}
      <CardTitle as="h2" className={styles.name}>
        {hero.name}
      </CardTitle>
      <CardHeader className={styles.header}>
        <CardEyebrow>{hero.role}</CardEyebrow>
        <span className={styles.meta}>{hero.meta}</span>
      </CardHeader>
      <p className={styles.story}>{hero.summary}</p>
      {/* Above 1220px this leaves the record's column and stands in the
          page's right margin, level with the story, so a citation sits
          beside the claim it carries. The escape is `marginNote` — the
          same mechanism the timeline entries use — and it costs the
          reading measure nothing. Below that it stays here, under the
          story. Either way it is in the record and in the markup, so
          reading order, screen readers and the printed page are the
          same in both. */}
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
      title="Our Heroes"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(heroesJsonLd(edition)) }}
      />
      {/* The names, before anything is said about them, and before anything
          is said about the page.
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

      {/* The consent boundary, as a colophon.
          It opened the page until 2026-09-14 — heading "What this page will
          not publish", the first item in the contents rail and the first
          thing on the screen — so a page that exists to honour people spent
          its opening screen explaining what it would not say about them. The
          wording of the note itself is the binding boundary
          (`.ai/DECISIONS.md`, 2026-08-25) and is unchanged, un-gated and not
          paraphrased; only its position and its heading are. Here, at the
          foot with the records' sources above it and the desk that reviewed
          them below, it reads as the standard the work is held to — which is
          what it is. */}
      <SectionBlock heading="How these profiles are built">
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

      <PublicationMeta
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
      />
    </SectionPage>
  );
}
