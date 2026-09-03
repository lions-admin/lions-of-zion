import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CinematicIntroGate } from "@/components/particle-nav/CinematicIntroGate";
import { ScanBackdrop } from "@/components/sections/ScanBackdrop";
import { HOME_SCAN_PROFILE } from "@/components/sections/scanProfiles";
import { TypographicField } from "@/components/typographic-field/TypographicField";
import { ButtonLink } from "@/components/ui/Button";
import { SECTION_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { stamp } from "@/components/live/feed-time";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
/* Imported from the module rather than through `components/motion/index.ts`.
   `package.json` now DOES declare a CSS-only `sideEffects` list, which
   makes the barrel tree-shakeable, so this is belt-and-braces rather than
   necessary. It is kept because this route's first paint is the one the whole
   site is judged by, and a direct path cannot regress if that declaration is
   ever dropped. */
import { ProgressiveBlur } from "@/components/motion/ProgressiveBlur";
import lionMark from "@/logos/79eef03d-4ddc-47a4-a17b-f4d0e13e7fa6.png";
import styles from "./home.module.css";
import { featuredPublications } from "@/lib/publications";
import type { PublicPublication } from "@/server/contracts/publication";

/**
 * The homepage — the single cinematic threshold (HOME-001).
 *
 * One signature surface, composed in document flow rather than the absolute
 * pins it replaced: masthead centred by flex auto-margins, the file index
 * beneath it, the signal rail at the foot. Every layer of it is server HTML;
 * the typographic field and the particle entrance are progressive enhancement
 * on top, and removing JavaScript removes only them.
 *
 * State ledger, because HOME-001's acceptance is about states:
 *  - live: the glyph field runs behind the flow content.
 *  - poster: `CinematicIntroGate` owns the entrance; this page is inert under
 *    it until handoff and untouched by it after.
 *  - no-WebGPU: the field itself steps WebGL2 → WebGL1 → Canvas2D; the
 *    particle entrance is bypassed by its own tier probe.
 *  - reduced motion: the field paints one settled frame and stops; the
 *    entrance never runs.
 *  - no-JS: `.fallbackField` (the site's scan ground) stands in for the
 *    canvas with the shared CSS scan band drifting over it, and the header,
 *    CTAs, file index, and rail are all plain hrefs.
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

  /* One stable current signal (HOME-003), not a rotation: the desk's lead
     feature, or the newest live publication when nothing is pinned. */
  const signal = headlines.at(0);
  const verdict = signal?.narrativeWatchDetails
    ? VERIFICATION_STATES[signal.narrativeWatchDetails.verificationState]
    : null;

  return (
    <CinematicIntroGate>
      {/* Without JavaScript there is no intro to hand off from, and the
          server-rendered `data-intro-pending` that `.scanDock` waits on never
          clears — the same reason `CinematicIntroGate` hides `[data-intro-only]`
          this way. The band shows over the static scan ground, as on every
          other route. */}
      <noscript>
        <style>{"[data-home-scan] { display: block !important; }"}</style>
      </noscript>
      <main className={styles.page} data-home-scroll>
        <SiteHeader />

        <section className={styles.hero} aria-labelledby="home-wordmark">
          {/* The field is pinned to the first viewport, not stretched over the
              hero: on short screens the flow content below simply continues on
              the ground the field fades into. Everything inside is decorative
              — the fallback scan, the canvas, the telemetry, and the graded
              fall-off at the foot. */}
          <div className={styles.fieldLayer} aria-hidden="true">
            <div className={styles.fallbackField} />
            {/* The shared public-site scan, the same server-rendered rows every
                reading route drifts behind, docked as a band under the canvas.
                It stays hidden until the intro has handed off and steps aside
                once the field's engine paints — the field's canvas is opaque,
                so the two are never on screen together; see `.scanDock`. */}
            <div className={styles.scanDock} data-home-scan>
              <ScanBackdrop
                routeId="home"
                surface="band"
                register={HOME_SCAN_PROFILE.register}
                intensity={HOME_SCAN_PROFILE.intensity}
                density={HOME_SCAN_PROFILE.density}
                speed={HOME_SCAN_PROFILE.speed}
              />
            </div>
            <TypographicField
              canvasClassName={styles.matrixCanvas}
              statusClassName={styles.engineStatus}
              dotClassName={styles.statusDot}
            />
            {/* After the field, before the chrome: it grades the glyphs and
                nothing else. See `.heroFade`. */}
            <ProgressiveBlur position="bottom" height="var(--sp-9)" className={styles.heroFade} />
          </div>

          <div className={styles.masthead}>
            <div className={styles.brandMark} aria-hidden="true">
              <Image
                src={lionMark}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 180px, 250px"
              />
            </div>
            <h1 id="home-wordmark" className={styles.wordmark}>LIONSOFZION</h1>
            <p className={styles.standfirst}>Powered by evidence, not narratives.</p>

            {/* HOME-002 — the primary action names its destination; the
                secondary affordance names the file index it jumps to. The
                hover sweep on the primary is CSS-only and exists only for
                fine pointers without a reduced-motion preference — touch and
                reduced motion get the Button variant's static states. */}
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
              <ButtonLink
                href="#home-files"
                variant="secondary"
                size="lg"
                className={styles.ctaSecondary}
              >
                All files
                <span className={styles.ctaCount} data-numeric>08</span>
              </ButtonLink>
            </div>
          </div>

          {/* The rebuilt hero navigation: the eight files as server-rendered
              hrefs, usable in every state the canvas has and every state it
              lacks. Order, labels, and routes come from SITE_NAVIGATION —
              the same source the header and the particle scene read. */}
          <nav id="home-files" className={styles.fileIndex} aria-label="All files">
            <ol className={styles.fileList}>
              {SITE_NAVIGATION.map((item, index) => (
                <li key={item.id} className={styles.fileItem}>
                  <Link href={item.href} className={styles.fileLink}>
                    <span className={styles.fileNo} data-numeric aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.fileName}>{item.displayName}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          {/* HOME-003 — one stable current signal with source, status, and
              time, then the door to the whole record. Not a crawl: a moving
              headline is unreadable at any speed and is an urgency device
              this site documents other people using. Everything here is
              server HTML, so the update text is in the DOM in every state. */}
          <aside className={styles.signalRail} aria-label="Latest published update">
            <div className={styles.railInner}>
              <p className={styles.railFlag}>
                <span className={styles.railDot} aria-hidden="true" />
                Latest
              </p>
              {signal ? (
                <div className={styles.railSignal}>
                  <p className={styles.railMeta}>
                    <span className={styles.railSource}>{SECTION_LABELS[signal.section]}</span>
                    <span className={styles.railStatus} data-tone={verdict?.tone ?? "neutral"}>
                      {verdict ? verdict.label : "Published"}
                    </span>
                    <time
                      className={styles.railTime}
                      dateTime={signal.publishedAt}
                      title={`${stamp(signal.publishedAt)} (Asia/Jerusalem)`}
                    >
                      {stamp(signal.publishedAt)}
                    </time>
                  </p>
                  <Link href={`/articles/${signal.publicId}`} className={styles.railTitle}>
                    {signal.title}
                  </Link>
                </div>
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
        </section>
      </main>
    </CinematicIntroGate>
  );
}
