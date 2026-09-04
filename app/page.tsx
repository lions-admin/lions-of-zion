import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { CinematicIntroGate } from "@/components/particle-nav/CinematicIntroGate";
import { ScanBackdrop } from "@/components/sections/ScanBackdrop";
import { HOME_SCAN_PROFILE } from "@/components/sections/scanProfiles";
import { HeroVideo } from "@/components/sections/HeroVideo";
import { ButtonLink } from "@/components/ui/Button";
import { SECTION_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { stamp } from "@/components/live/feed-time";
/* Imported from the module rather than through `components/motion/index.ts`.
   `package.json` now DOES declare a CSS-only `sideEffects` list, which
   makes the barrel tree-shakeable, so this is belt-and-braces rather than
   necessary. It is kept because this route's first paint is the one the whole
   site is judged by, and a direct path cannot regress if that declaration is
   ever dropped. */
import { ProgressiveBlur } from "@/components/motion/ProgressiveBlur";
import { SignalRotator } from "@/components/home/SignalRotator";
import styles from "./home.module.css";
import { featuredPublications } from "@/lib/publications";
import type { PublicPublication } from "@/server/contracts/publication";

/**
 * How many of the record's features the rail will turn through.
 *
 * A ceiling, not an expectation: `publications.featured()` returns the three
 * pinned homepage slots, or the three newest live rows when none is pinned,
 * so today the rail turns through three. The cap is here so that widening the
 * homepage feature table does not silently hand the hero's floor a rotation
 * nobody sized it for.
 */
const RAIL_SIGNALS = 5;

/**
 * The homepage — the single cinematic threshold (HOME-001).
 *
 * One signature surface, composed in document flow rather than the absolute
 * pins it replaced: the masthead as a column beside the animal from 48rem up
 * and centred over him below it, the signal rail at the foot. Every layer of
 * it is server HTML; the hero video, the particle entrance and the rail's
 * turn through the record are progressive enhancement on top, and removing
 * JavaScript removes only them — the rail still paints a real headline.
 *
 * The ground was a WebGPU field of glyphs over a docked scan band until
 * 2026-09-04. It is a photographic shot now — see `HeroVideo` for why it ships
 * as two cuts of one take and two shoots rather than one cropped twice — and
 * the scan band went with the field it was docked under, because a drift of
 * type rows over a lion is two moving layers competing for the same screen.
 *
 * State ledger, because HOME-001's acceptance is about states:
 *  - live: the entrance plays once, then dissolves into a seamless loop.
 *  - poster: `CinematicIntroGate` owns the arrival; this page is inert under
 *    it until handoff and untouched by it after.
 *  - reduced motion: no source is ever handed to either video element, so the
 *    still is not merely what is shown — it is all that is fetched, and the
 *    signal rail holds its first headline rather than turning.
 *  - no-JS: `.posterField` paints the video's own first frame from the
 *    stylesheet, and the `<noscript>` list below is the route index, because
 *    `SiteHeader` hides every destination name under 64rem behind a drawer
 *    that needs script to open.
 *
 * The brand block is deliberately NOT wrapped in `Reveal`. The gate hands off
 * by fading its own fixed layer out over 700ms, so the masthead already has
 * an arrival; a staggered entrance inside that cross-fade is the
 * double-animation to avoid. The rail is furniture at the hero's foot and is
 * not revealed either — and `Reveal`'s observer root excludes the bottom
 * tenth of the viewport, so an element pinned there would never arm.
 */
export default async function Page() {
  /* An unreadable projection and an empty record are different facts, and the
     rail says which. Letting this throw would 500 the front page over a
     five-minute cache hiccup. */
  let headlines: PublicPublication[] = [];
  let recordUnavailable = false;
  try {
    headlines = await featuredPublications();
  } catch (cause) {
    recordUnavailable = true;
    console.error(
      "[home] public projection unavailable",
      cause instanceof Error ? cause.message : cause,
    );
  }

  /* The desk's pinned features, newest live publications when nothing is
     pinned. The first is the one the server paints; the rest are what the
     rail turns to. Every one of them is already in hand — this is the same
     read the page has always made, and the rotation added no query to it. */
  const signals = headlines.slice(0, RAIL_SIGNALS);
  const signal = signals.at(0);

  return (
    <CinematicIntroGate
      /* The entrance is composed over the same scan the settled home shows.
         Passed from this server component because `ScanBackdrop` reads the
         corpus from disk and the gate is a client boundary. The seed matches
         the home's, so the two instances sample the same fragments in the
         same places and the cross-fade at handoff is a change of phase, not
         of content. */
      background={
        <ScanBackdrop
          routeId="home"
          surface="viewport"
          register={HOME_SCAN_PROFILE.register}
          intensity={HOME_SCAN_PROFILE.intensity}
          density={HOME_SCAN_PROFILE.density}
          speed={HOME_SCAN_PROFILE.speed}
        />
      }
    >
      <main className={styles.page} data-home-scroll>
        <SiteHeader />

        <section className={styles.hero} aria-labelledby="home-wordmark">
          {/* The field is pinned to the first viewport, not stretched over the
              hero: on short screens the flow content below simply continues on
              the ground the field fades into. Everything inside is decorative
              — the fallback scan, the canvas, the telemetry, and the graded
              fall-off at the foot. */}
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
            <h1 id="home-wordmark" className={styles.wordmark}>LIONSOFZION</h1>
            <p className={styles.standfirst}>Powered by evidence, not narratives.</p>

            {/* HOME-002 — the one primary action, and now the only control in
                the masthead at all: the file index it once had a secondary
                affordance for is gone from this page, and the header's "All
                files" trigger is the way to the full list. The hover sweep on
                the
                primary is CSS-only and exists only for fine pointers without
                a reduced-motion preference — touch and reduced motion get
                the Button variant's static states. */}
            <div className={styles.actions}>
              <ButtonLink
                href="/geopolitical-brief"
                variant="primary"
                size="lg"
                className={styles.ctaPrimary}
              >
                Read the Daily Brief
                <span className={styles.ctaArrow} aria-hidden="true">→</span>
              </ButtonLink>
            </div>
          </div>

          {/* Zone C — the signal rail, alone at the floor now.

              The file index that used to sit here listed SITE_NAVIGATION in
              full, which `SiteHeader` already renders on every route of the
              site including this one: the same eight links, twice, in one
              viewport. The header's copy is the one that survives, because it
              is the one a reader can reach from anywhere. What that buys here
              is the lower half of the frame — the index was occupying the
              ground the lion walks on. */}
          <div className={styles.filesDeck}>
            {/* Navigation for a reader with no JavaScript.
             *
             * `SiteHeader` drops every destination name from the bar below 64rem
             * (`site-header.module.css`) and hands the whole set to a drawer that
             * needs script to open. The file index removed from this hero was, in
             * that state, the only server-rendered route list a small screen had —
             * so deleting it as a duplicate left the no-JS phone with no way out
             * of this page at all. `tests/intro-accessibility.test.ts` is what
             * caught it.
             *
             * `<noscript>` is the whole answer: it renders nothing for readers the
             * header already serves, so the duplication the index was deleted for
             * does not come back, and the one state that lost its navigation gets
             * it. Plain anchors rather than `next/link` — there is no client here
             * to hydrate them. */}
            <noscript>
              <nav className={styles.noscriptNav} aria-label="All sections">
                <ol>
                  {SITE_NAVIGATION.map((item) => (
                    <li key={item.id}>
                      <a href={item.href}>{item.displayName}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            </noscript>

            {/* HOME-003 — the current signal with source, status and time,
                then the door to the whole record.

                It turns now, at the owner's instruction, through the features
                the record already hands this page. This comment used to
                refuse a rotation on two grounds and only one of them was
                about rotation: a *moving* headline is unreadable at any
                speed, and a ticker that never stops is an urgency device this
                site documents other people using. Both are answered by making
                the turn discrete rather than continuous. The headline arrives,
                then stands still for `--dur-ambient` — seven seconds, longer
                than it takes to read a headline — then leaves. Nothing moves
                while anything is being read, and a band that changes eight
                times a minute at most manufactures no urgency. It also holds
                on hover and on focus, so a reader going for the link keeps
                the link they were going for.

                What did not change: item zero is rendered here, on the
                server. `SignalRotator` takes over after hydration, and with
                no script, or under reduced motion, that first headline is
                simply the headline. The update text is still in the DOM in
                every state. */}
            <aside
              className={styles.signalRail}
              aria-label="Latest published update"
              /* The hover/focus hold covers the whole band, not just the
                 rotating item — `SignalRotator` finds it by this. */
              data-signal-rail
            >
              <div className={styles.railInner}>
                <p className={styles.railFlag}>
                  <span className={styles.railDot} aria-hidden="true" />
                  Latest
                </p>
                {signal ? (
                  signals.length > 1 ? (
                    <SignalRotator
                      className={styles.railStage}
                      items={signals.map((item) => railSignal(item))}
                    />
                  ) : (
                    /* One signal is not a rotation. No stage, no timer, no
                       client boundary — the markup the rail has always had. */
                    railSignal(signal)
                  )
                ) : (
                  <p className={styles.railEmpty}>
                    {recordUnavailable
                      ? "The live record is temporarily unreadable."
                      : "Nothing has been published yet."}
                  </p>
                )}
                <Link href="/updates" className={styles.railAll}>
                  All updates
                  <span aria-hidden="true"> →</span>
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </CinematicIntroGate>
  );
}

/**
 * One signal, exactly as the rail has always rendered it.
 *
 * A plain function rather than a component, and it stays on the server: the
 * section label, the verdict tone, the Jerusalem stamp and the article link
 * are composed here whether the rail is turning or standing still, so the two
 * states cannot drift into rendering the same publication differently. What
 * `SignalRotator` receives is a list of these — already rendered, opaque to
 * it — which is what keeps a publication's shape out of a client component
 * and this route's stylesheet out of `components/`.
 */
function railSignal(item: PublicPublication) {
  const verdict = item.narrativeWatchDetails
    ? VERIFICATION_STATES[item.narrativeWatchDetails.verificationState]
    : null;

  return (
    <div key={item.publicId} className={styles.railSignal}>
      <p className={styles.railMeta}>
        <span className={styles.railSource}>{SECTION_LABELS[item.section]}</span>
        <span className={styles.railStatus} data-tone={verdict?.tone ?? "neutral"}>
          {verdict ? verdict.label : "Published"}
        </span>
        <time
          className={styles.railTime}
          dateTime={item.publishedAt}
          title={`${stamp(item.publishedAt)} (Asia/Jerusalem)`}
        >
          {stamp(item.publishedAt)}
        </time>
      </p>
      <Link href={`/articles/${item.publicId}`} className={styles.railTitle}>
        {item.title}
      </Link>
    </div>
  );
}
