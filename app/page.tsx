import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { JourneyLink } from "@/components/home/HomeJourneyPrimitives";
import { MotionControl } from "@/components/home/MotionControl";
import { SignalMark } from "@/components/brand/SignalMark";
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

/* The cover's lion (2026-09-16). One reference render, keyed by
   `scripts/brand/key-lion.mjs` into two straight-alpha layers — the core (the
   face and the body of the mane) and the haze (the particles dispersing
   around it) — so the scroll can move them at different depths; the crown is
   removed by the same job (decision 2 of the round). Both cuts of each layer
   live in `public/brand/cover/` with a `manifest.json` that records the
   geometry and the sizes; the 800 cut serves the phone, chosen by a media
   condition rather than by device-pixel arithmetic so a 3× phone is never
   handed the 462 kB pair. The phone seam is the cover's own 48rem, the one
   `home.module.css` composes on. */
const PHONE_CUT = "(max-width: 47.99rem)";
const COVER_LAYER_PX = 1254;

function CoverLayer({
  name,
  className,
  priority = false,
}: {
  name: "core" | "haze";
  className: string;
  priority?: boolean;
}) {
  const cut = (size: 800 | 1254, ext: "avif" | "webp") =>
    `/brand/cover/lion-${name}-${size}.${ext}`;
  return (
    <picture className={className}>
      <source media={PHONE_CUT} type="image/avif" srcSet={cut(800, "avif")} />
      <source media={PHONE_CUT} type="image/webp" srcSet={cut(800, "webp")} />
      <source type="image/avif" srcSet={cut(1254, "avif")} />
      {/* `alt=""` and the layer's `aria-hidden` together: the lion is the
          brand's picture, not information — the wordmark beside it is what a
          screen reader gets. `width`/`height` reserve the square so the
          arrival is a fade, never a reflow. */}
      <img
        className={styles.lionLayer}
        src={cut(1254, "webp")}
        width={COVER_LAYER_PX}
        height={COVER_LAYER_PX}
        alt=""
        decoding="async"
        loading="eager"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
      />
    </picture>
  );
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
    {/* Only the core layer is preloaded, and only the cut this viewport will
        draw: the haze arrives a beat later by design, and the wordmark and
        the lead's headline are text in this same HTML, so the largest paint
        never waits on an image. `type` lets a browser without AVIF skip the
        hint rather than fetch a file it cannot decode. */}
    <link
      rel="preload"
      as="image"
      type="image/avif"
      href="/brand/cover/lion-core-800.avif"
      media={PHONE_CUT}
      fetchPriority="high"
    />
    <link
      rel="preload"
      as="image"
      type="image/avif"
      href="/brand/cover/lion-core-1254.avif"
      media="(min-width: 48rem)"
      fetchPriority="high"
    />
    <SiteHeader home />
    <main id="page-content" className={styles.page} data-home-scroll>
        <section className={styles.hero} aria-labelledby="home-wordmark">
          {/* The field: a screen that stays put while the masthead scrolls
              off it, and the one place on the site the lion appears. In paint
              order — the flat ground with its vignette (what a reader with
              scripting off, stillness on, or an engine without scroll
              timelines sees, and the ground the smoke test looks for), the
              haze, the core, the scrim that keeps the type readable. Nothing
              in here can be reached: the layer is `pointer-events: none`,
              `aria-hidden`, and painted below the masthead by the cascade
              (`home.module.css` `.fieldLayer`). */}
          <div className={styles.fieldLayer} aria-hidden="true">
            <div className={styles.posterField} />
            <CoverLayer name="haze" className={styles.lionHaze} />
            <CoverLayer name="core" className={styles.lionCore} priority />
            <div className={styles.heroScrim} />
          </div>

          <div className={styles.masthead}>
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

            {/* The edition rail: what happened today, and the reason a reader
                never has to scroll to learn it. The signal rule opens it — the
                mark's first place on the site, where it is born from the lion:
                the stub is there at rest and the line draws to the full measure
                as the lion's layers leave on the scroll (`.coverSignal`); where
                nothing scrolls the line is simply present. Under it the mono
                date, the lead's status, the "Previous edition" flag when true,
                and the lead's headline as one block link to the record itself.
                Every field is prerendered and the headline reserves its lines,
                so the band owns its height at first paint and shifts nothing. */}
            <div className={styles.editionRail}>
              <SignalMark className={styles.coverSignal} />
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
                </Link>
              ) : (
                <p className={styles.editionRailHeadline}>
                  Today&rsquo;s lead is not available right now.
                </p>
              )}
            </div>

            {/* One action, and it points at the lead itself. It read "Read
                the latest" and pointed at the hub, so the cover named the same
                record three ways in one screen — the headline, the rail's
                "Read the story", and a hub link dressed as a record action.
                The verb is the lead's own (`cta`, derived from its section per
                the verb table in `UX-CONTRACT.md`), the way every card on the
                page says it; without a lead the action is the hub's, said as
                what it is. `JourneyLink`'s primary role is an outline, so the
                masthead's Support control stays the only gold fill on the
                first screen. Beside it, the reader's own pause (WCAG 2.2.2):
                a text control, not a second box. */}
            <div className={styles.actions}>
              {lead ? (
                <JourneyLink href={lead.href}>{lead.cta ?? "Read the story"}</JourneyLink>
              ) : (
                <JourneyLink href="/geopolitical-brief">Read the latest reporting</JourneyLink>
              )}
              <MotionControl />
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
