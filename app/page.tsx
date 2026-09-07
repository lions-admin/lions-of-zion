import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { JourneyLink } from "@/components/home/HomeJourneyPrimitives";
import { HeroVideo } from "@/components/sections/HeroVideo";
import { HomepageJourney } from "@/components/home/HomepageJourney";
import { HeroSupportStrip } from "@/components/home/HeroSupportStrip";
import { getHomepageEdition } from "@/lib/homepage";
import styles from "./home.module.css";

export const revalidate = 60;
export default async function Page() {
  const edition = await getHomepageEdition();
  return <div className={styles.homeTheme}>
    {/* Preload hero poster for immediate LCP paint before stylesheet resolution */}
    <link
      rel="preload"
      as="image"
      href="/video/lion-hero-poster-portrait.jpg"
      media="(max-width: 759px), (aspect-ratio < 6/5)"
      fetchPriority="high"
    />
    <link
      rel="preload"
      as="image"
      href="/video/lion-hero-poster-desktop.jpg"
      media="(min-width: 760px) and (min-aspect-ratio: 6/5)"
      fetchPriority="high"
    />
    <a className={styles.skipLink} href="#home-wordmark">Skip to content</a>
    <SiteHeader home />
    <main id="page-content" className={styles.page} data-home-scroll>
        <section className={styles.hero} aria-labelledby="home-wordmark">
          <div className={styles.fieldLayer} aria-hidden="true">
            {/* The still frame is the ground beneath everything else here: what
                shows before the first video byte lands, what stays when motion
                is reduced, and all there is when no JavaScript ever hands
                `HeroVideo` a source. It is the video's own first frame, so the
                arrival is a start of movement rather than a change of picture. */}
            <div className={styles.posterField} />
            <HeroVideo className={styles.heroVideo} />
            {/* Legibility, not decoration. The masthead is a left column and
                the lion holds the right of the frame; the scrim weights the
                left so the type sits on darkness while the animal stays lit.
                See `.heroScrim`. */}
            <div className={styles.heroScrim} />
          </div>

          <div className={styles.masthead}>
            {/* The glyph lion that sat here is gone. It was drawn for a hero
                whose ground was a field of type, where it was the only
                figurative thing on the screen; over a photograph of a lion it
                was a second lion laid across the first one's face. The wordmark
                carries the brand on its own now. */}
            <h1 id="home-wordmark" className={styles.wordmark} tabIndex={-1}>
              <span className={styles.wordmarkLine}>LIONS</span>{" "}
              <span className={styles.wordmarkLine}>
                <span className={styles.wordmarkOf}>OF</span>{" "}ZION
              </span>
            </h1>
            <p className={styles.standfirst}>
              <span>Powered by evidence,</span>{" "}
              <span>not narratives.</span>
            </p>

            {/* News is primary; the system story is an optional reading path. */}
            <div className={styles.actions}>
              <JourneyLink href="/geopolitical-brief">Read the latest</JourneyLink>
            </div>
            {/* Quieter by design: smaller, lower in tone, no arrow of its own,
                so "Read the latest" is the one arrow on the cover and this is
                the optional reading path beneath it. */}
            <div className={styles.secondaryActions}>
              <Link className={styles.storyLink} href="/information-war">
                Why this work matters
              </Link>
            </div>
            {/* The ask, on the cover, by owner ruling (2026-09-07): the two
                donation channels as compact chips under the reading paths.
                They arrive after the cover has been read and then hold still
                — `HeroSupportStrip` carries the reasoning. They take no arrow;
                the external glyph is the chrome's own mark for leaving. */}
            <HeroSupportStrip />
          </div>

        </section>
        <div className={styles.readingSurface}>
        <noscript><nav className={styles.noscriptNav} aria-label="All sections"><ol>
          {SITE_NAVIGATION.map(item=><li key={item.id}><a href={item.href}>{item.displayName}</a></li>)}
        </ol></nav></noscript>
        <HomepageJourney edition={edition}/>
        </div>
    </main>
    <div className={styles.readingSurface}><SiteFooter home /></div>
  </div>;
}
