import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { ButtonLink } from "@/components/ui/Button";
import { SECTION_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { stamp } from "@/components/live/feed-time";
import { HeroVideo } from "@/components/sections/HeroVideo";
import { ProgressiveBlur } from "@/components/motion/ProgressiveBlur";
import { SignalRotator } from "@/components/home/SignalRotator";
import { EditorialIntro } from "@/components/home/EditorialIntro";
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

/** Readable server home, with a skippable text introduction after hydration. */
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
      <main className={styles.page} data-home-scroll>
        <SiteHeader />

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
              <span className={styles.evidenceLine}>Powered by evidence,</span>{" "}
              <span className={styles.narrativesLine}>not narratives.</span>
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
            <Link className={styles.storyLink} href="/information-war">
              Why this work matters <span aria-hidden="true">↗</span>
            </Link>
            <EditorialIntro />
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
