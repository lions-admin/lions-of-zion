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

/**
 * The cover's own date line, from the edition the bands below already read.
 * A fixed IANA zone and an explicit locale so the string is the same on every
 * render of the same edition — this is a server component, so it is written
 * once into the HTML and never re-formatted in a browser.
 */
function editionDateLabel(editionDate: string): string {
  if (!editionDate) return "Edition unavailable";
  const day = new Date(`${editionDate}T12:00:00Z`);
  if (Number.isNaN(day.valueOf())) return "Edition unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(day);
}

export default async function Page() {
  const edition = await getHomepageEdition();
  // The edition rail's one job is to say what happened today, and it reads it
  // from the same snapshot the bands below read — `getHomepageEdition()`, whose
  // news pair is the edition's own lead. There is deliberately no second
  // selection here: a cover that picks its own lead is a cover that can
  // disagree with the edition underneath it.
  const lead = edition.news.items[0] ?? null;
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

            {/* The two reading paths, on one row wherever the measure allows
                it and stacked where it does not. They were two stacked blocks
                costing 110px of a phone cover; the edition rail below needs
                that space more than the gap between them did (VA-10). News is
                primary; the system story is the optional path — quieter by
                design: smaller, lower in tone, no arrow of its own, so "Read
                the latest" keeps the one arrow. */}
            <div className={styles.coverPaths}>
              <div className={styles.actions}>
                <JourneyLink href="/geopolitical-brief">Read the latest</JourneyLink>
              </div>
              <div className={styles.secondaryActions}>
                {/* VA-51. This link said "Why this work matters" while the
                    chrome called the same destination "How it works" and its
                    tab called it something else again. One name now. */}
                <Link className={styles.storyLink} href="/information-war">
                  How it works
                </Link>
              </div>
            </div>
            {/* The edition rail: the bottom band of the cover, and the reason
                a reader no longer has to scroll to learn what happened today.
                Date, the lead's status, its headline and the way in — the
                lion is now a threshold into an edition rather than the whole
                first screen. It sits above the support chips on purpose: the
                reporting is read before the ask (VA-10; the chips themselves
                stay where the owner put them). Every field is prerendered and
                the headline reserves two lines whatever its length, so the
                band owns its height at first paint and shifts nothing. */}
            <div className={styles.editionRail}>
              <p className={styles.editionRailMeta}>
                <span>{editionDateLabel(edition.editionDate)}</span>
                {lead && (
                  <span className={styles.editionRailStatus}>{lead.category}</span>
                )}
                {edition.state === "previous-edition" && (
                  <span className={styles.editionRailFlag}>Previous edition</span>
                )}
              </p>
              {lead ? (
                <Link className={styles.editionRailLead} href={lead.href}>
                  <span className={styles.editionRailHeadline}>{lead.title}</span>
                  <span className={styles.editionRailCta}>
                    Read the story
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12h15M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ) : (
                <Link className={styles.editionRailLead} href="/geopolitical-brief">
                  <span className={styles.editionRailHeadline}>
                    Today&rsquo;s lead is not available right now.
                  </span>
                  <span className={styles.editionRailCta}>
                    Read the latest reporting
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12h15M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              )}
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
