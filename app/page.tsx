import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { ButtonLink } from "@/components/ui/Button";
import { HeroVideo } from "@/components/sections/HeroVideo";
import { ProgressiveBlur } from "@/components/motion/ProgressiveBlur";
import { HomepageJourney } from "@/components/home/HomepageJourney";
import { getHomepageEdition } from "@/lib/homepage";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export default async function Page() {
  const edition = await getHomepageEdition();
  return <>
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
            {/* After the field, before the chrome: it grades the footer edge of
                the shot into the ground. See `.heroFade`. */}
            <ProgressiveBlur position="bottom" height="var(--sp-9)" className={styles.heroFade} />
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
              <ButtonLink
                href="/geopolitical-brief"
                variant="ghost"
                size="lg"
                className={styles.ctaPrimary}
              >
                <span className={styles.ctaLabel}>Read the latest</span>
                <span className={styles.ctaArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 12h15M13 5l7 7-7 7" />
                  </svg>
                </span>
              </ButtonLink>
            </div>
            {/* Quieter by design: smaller, lower in tone, no arrow of its own,
                so "Read the latest" is the one invitation on the cover and
                this is the optional reading path beneath it. */}
            <div className={styles.secondaryActions}>
              <Link className={styles.storyLink} href="/information-war">
                Why this work matters
              </Link>
            </div>
          </div>

        </section>
        <noscript><nav className={styles.noscriptNav} aria-label="All sections"><ol>
          {SITE_NAVIGATION.map(item=><li key={item.id}><a href={item.href}>{item.displayName}</a></li>)}
        </ol></nav></noscript>
        <HomepageJourney edition={edition}/>
    </main>
    <SiteFooter home />
  </>;
}
