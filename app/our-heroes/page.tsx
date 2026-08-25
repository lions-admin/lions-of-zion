import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { ContentCard, SourceList } from "@/components/content";
import { getOurHeroesEdition } from "@/lib/content/our-heroes";
import styles from "./page.module.css";

const TAGLINE =
  "The people behind the story: the fallen, the fighters, the rescuers.";

export const metadata: Metadata = {
  title: "Our Heroes",
  description: TAGLINE,
  openGraph: { title: "Our Heroes — LIONS OF ZION", description: TAGLINE },
};

export default async function Page() {
  const edition = await getOurHeroesEdition();

  return (
    <SectionPage id="our-heroes" surface="quiet" title="Our Heroes" tagline={TAGLINE}>
      <SectionBlock heading="One story">
        <ContentCard
          eyebrow={edition.featured.role}
          title={edition.featured.name}
          meta={edition.featured.meta}
          footer={<SourceList sources={edition.featured.sources} />}
        >
          {edition.featured.summary}
        </ContentCard>
      </SectionBlock>

      <SectionBlock heading="More stories">
        <div className={styles.heroGrid}>
          {edition.profiles.map((hero) => (
            <ContentCard
              key={hero.id}
              eyebrow={hero.role}
              title={hero.name}
              meta={hero.meta}
              footer={<SourceList sources={hero.sources} />}
            >
              {hero.summary}
            </ContentCard>
          ))}
        </div>
      </SectionBlock>

      <SectionBlock heading="How these stories are built">
        <p>
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
    </SectionPage>
  );
}
