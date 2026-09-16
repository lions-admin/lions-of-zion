import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SignalMark } from "@/components/brand/SignalMark";
import { MotionControl } from "@/components/home/MotionControl";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { JourneyLink } from "@/components/home/HomeJourneyPrimitives";
import { HomepageJourney } from "@/components/home/HomepageJourney";
import { getHomepageEdition } from "@/lib/homepage";
import { formatEditionDate } from "@/lib/format-date";
import { pageMetadata } from "@/lib/page-metadata";
import { SITE_DESCRIPTION } from "@/lib/site-config";
import type { Metadata } from "next";
import styles from "./home.module.css";

/* VA-62. The homepage exported no metadata at all and inherited the root
   layout's. That worked, but it meant the one page most likely to be pasted
   anywhere carried no canonical URL of its own and no `og:url`. It states
   itself now; the description stays the site's, because on the homepage the
   site's description *is* the page's. */
export const metadata: Metadata = pageMetadata({
  title: "Truth Has a Signal",
  description: SITE_DESCRIPTION,
  path: "/",
});

export const revalidate = 60;

/**
 * The cover's own date line, from the edition the bands below already read,
 * in the words the edition masthead (`HomepageJourney`) uses for the same
 * date — one formatter, `formatEditionDate`, so the cover and the masthead
 * cannot name the day differently. This is a server component, so the string
 * is written once into the HTML and never re-formatted in a browser.
 */
function editionDateLabel(editionDate: string): string {
  if (!editionDate || Number.isNaN(Date.parse(`${editionDate}T09:00:00Z`)))
    return "Edition unavailable";
  return formatEditionDate(editionDate);
}

/* The cover's keyed lion, in the two layers the asset job
   (`scripts/brand/key-lion.mjs`) cut. The media pattern is the one the
   previous poster preloads used — 759px/760px is the phone seam, inside the
   48rem phone floor the ruling set — and the `type` attribute lets an
   AVIF-capable engine skip the WebP preload rather than fetch both. */
const LION_MEDIA = {
  desktop: "(min-width: 760px)",
  phone: "(max-width: 759px)",
} as const;

export default async function Page() {
  const edition = await getHomepageEdition();
  // The edition rail's one job is to say what happened today, and it reads it
  // from the same snapshot the bands below read — `getHomepageEdition()`, whose
  // news pair is the edition's own lead. There is deliberately no second
  // selection here: a cover that picks its own lead is a cover that can
  // disagree with the edition underneath it. The rail's headline links to the
  // same `href` the news band's headline links to (`HomeNewsSection`'s
  // `<a href={item.href}>`): one lead, one destination, however many surfaces
  // name it.
  const lead = edition.news.items[0] ?? null;
  return <div className={styles.homeTheme}>
    {/* Preload the core layer for the immediate first paint before stylesheet
        resolution. The haze waits for the stylesheet like everything else. */}
    <link rel="preload" as="image" type="image/avif" href="/brand/cover/lion-core-2560.avif" media={LION_MEDIA.desktop} fetchPriority="high" />
    <link rel="preload" as="image" type="image/avif" href="/brand/cover/lion-core-1080x1920.avif" media={LION_MEDIA.phone} fetchPriority="high" />
    <link rel="preload" as="image" type="image/webp" href="/brand/cover/lion-core-1920.webp" media={LION_MEDIA.desktop} fetchPriority="high" />
    <link rel="preload" as="image" type="image/webp" href="/brand/cover/lion-core-1080x1920.webp" media={LION_MEDIA.phone} fetchPriority="high" />
    {/* The skip link is the header's own first element; `#page-content` is
        `main` below. There is deliberately no second copy here. */}
    <SiteHeader home />
    <main id="page-content" className={styles.page} data-home-scroll>
        <section className={styles.hero} aria-labelledby="home-wordmark">
          {/* The pinned stage. It is `position: sticky` inside `.hero`'s
              100svh + runway track, so the cover holds for the runway's
              scroll and releases when the reading surface arrives — pure
              CSS, no observer, no frame loop. Under reduced motion, the
              MotionControl's pause, or an engine without scroll-driven
              animations the runway is 0 and the stage is a complete static
              design: the lion at rest on the flat midnight ground. */}
          <div className={styles.fieldLayer} aria-hidden="true">
            {/* The flat ground: one colour from the token contract with the
                abyss vignette at its edge. The photograph under the cover is
                gone with the video; what remains is keyed alpha layers over
                this paint. The class name is kept because the smoke test
                counts it as the no-JavaScript ground's element. */}
            <div className={styles.posterField} />
            {/* L1 haze — the faint scatter the lion condenses out of. Soft
                alpha, so it is the cheaper layer and the one that may
                breathe (it does not: see `.lionHaze` — the keyed art is
                static, and a still haze is acceptable). */}
            <picture className={styles.lionHaze}>
              <source type="image/avif" media={LION_MEDIA.desktop} srcSet="/brand/cover/lion-haze-2560.avif 2560w, /brand/cover/lion-haze-1920.avif 1920w" sizes="100vw" />
              <source type="image/webp" media={LION_MEDIA.desktop} srcSet="/brand/cover/lion-haze-2560.webp 2560w, /brand/cover/lion-haze-1920.webp 1920w" sizes="100vw" />
              <source type="image/avif" media={LION_MEDIA.phone} srcSet="/brand/cover/lion-haze-1080x1920.avif 1080w" sizes="100vw" />
              <source type="image/webp" media={LION_MEDIA.phone} srcSet="/brand/cover/lion-haze-1080x1920.webp 1080w" sizes="100vw" />
              <img
                src="/brand/cover/lion-haze-1920.webp"
                alt=""
                width={1920}
                height={1080}
                loading="eager"
                decoding="async"
              />
            </picture>
            {/* L2 core — the face. The layer a reader meets first, and the
                one that arrives: it fades in and settles from a 4% larger
                frame over `--dur-arrive`, once. */}
            <picture className={styles.lionCore}>
              <source type="image/avif" media={LION_MEDIA.desktop} srcSet="/brand/cover/lion-core-2560.avif 2560w, /brand/cover/lion-core-1920.avif 1920w" sizes="100vw" />
              <source type="image/webp" media={LION_MEDIA.desktop} srcSet="/brand/cover/lion-core-2560.webp 2560w, /brand/cover/lion-core-1920.webp 1920w" sizes="100vw" />
              <source type="image/avif" media={LION_MEDIA.phone} srcSet="/brand/cover/lion-core-1080x1920.avif 1080w" sizes="100vw" />
              <source type="image/webp" media={LION_MEDIA.phone} srcSet="/brand/cover/lion-core-1080x1920.webp 1080w" sizes="100vw" />
              <img
                src="/brand/cover/lion-core-1920.webp"
                alt=""
                width={1920}
                height={1080}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </picture>
            {/* Legibility, not decoration. The masthead is a left column and
                the lion holds the right of the frame; the scrim weights the
                left so the type sits on darkness while the animal stays lit.
                On a phone it is anchored in pixels from the bottom, because
                what it covers is the masthead's lines of type, not the
                picture. See `.heroScrim`. */}
            <div className={styles.heroScrim} />
          </div>

          <div className={styles.masthead}>
            {/* The glyph lion that sat here is gone. It was drawn for a hero
                whose ground was a field of type, where it was the only
                figurative thing on the screen; over the keyed particle lion
                it was a second lion laid across the first one's face. The
                wordmark carries the brand on its own now — ink, not gold. */}
            <h1 id="home-wordmark" className={styles.wordmark} tabIndex={-1}>
              <span className={styles.wordmarkLine}>LIONS</span>{" "}
              <span className={styles.wordmarkLine}>
                <span className={styles.wordmarkOf}>OF</span>{" "}ZION
              </span>
            </h1>
            {/* UX-01. The one positioning line, and the title finally on the
                page: `pageMetadata` has called every page "Truth Has a
                Signal" since VA-62 while the cover said something else. The
                two spans keep the break the composer chose — claim, then the
                three verbs — where the measure is too narrow for one line. */}
            <p className={styles.standfirst}>
              <span>Truth has a signal.</span>{" "}
              <span>Find it, check it, share it.</span>
            </p>

            {/* One action, and it is the only boxed control on the cover —
                the outlined primary grammar; Support in the bar is the only
                gold fill on the first screen. Beside it, the motion pause
                control (WCAG 2.2.2): an in-flow quiet text control, the
                third state beside the OS preference, not a floating chip. */}
            <div className={styles.actions}>
              <JourneyLink href="/geopolitical-brief">Read the latest</JourneyLink>
              <MotionControl className={styles.motionControl} />
            </div>
            {/* The edition rail — the bottom band of the cover, and the reason
                a reader no longer has to scroll to learn what happened today.
                The signal mark opens it: the rule's first place on the page,
                the lion's dispersing particles held as a line. Date, the
                lead's status, its headline and the way in — the lion is now a
                threshold into an edition rather than the whole first screen.
                It is the last thing on the cover: the support chips close the
                first band (`HeroSupportStrip`, placed by `HomepageJourney`),
                so the reporting is read before the ask. Every field is
                prerendered and the headline reserves two lines whatever its
                length, so the band owns its height at first paint and shifts
                nothing. */}
            <div className={styles.editionRail}>
              <SignalMark className={styles.railMark} />
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
