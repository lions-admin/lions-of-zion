import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CinematicIntroGate } from "@/components/particle-nav/CinematicIntroGate";
import { TypographicField } from "@/components/typographic-field/TypographicField";
/* Imported from the modules rather than through `components/motion/index.ts`.
   `package.json` now DOES declare a CSS-only `sideEffects` list, which
   makes the barrel tree-shakeable, so this is belt-and-braces rather than
   necessary. It is kept because this route's first paint is the one the whole
   site is judged by, and a direct path cannot regress if that declaration is
   ever dropped. */
import { ProgressiveBlur } from "@/components/motion/ProgressiveBlur";
import lionMark from "@/logos/79eef03d-4ddc-47a4-a17b-f4d0e13e7fa6.png";
import styles from "./home.module.css";
import { featuredPublications } from "@/lib/publications";

/**
 * The brand block is deliberately NOT wrapped in `Reveal`.
 *
 * `CinematicIntroGate` renders this page into a `display: contents` div
 * underneath a `position: fixed; z-index: 1000` entrance layer, and hands off
 * by fading that layer out over 700ms. So the masthead already has an
 * arrival — the cinematic dissolving off it — and a staggered entrance inside
 * that cross-fade is the double-animation to avoid, not an addition to it.
 *
 * Two further reasons it would not have worked as written: `.brandCenter` is
 * centred with `translate(-50%, -50%)`, which `Reveal`'s settled state
 * (`transform: none`) would erase; and `RevealTag` carries no `h1` and no `a`,
 * so the wordmark and the control would each need a wrapper element inserted
 * into a hand-tuned flex column with negative margins and a full-width mobile
 * button. Neither is worth spending on the one screen that must not break.
 *
 * The flash strip at the foot is not revealed either, for a different and
 * harder reason — see the note at its call site below.
 */
export default async function Page() {
  const headlines = await featuredPublications();
  return (
    <CinematicIntroGate>
      <main className={styles.page} data-home-scroll>
        <SiteHeader />

        <section className={styles.hero} aria-labelledby="home-wordmark">
          <div className={styles.fallbackField} aria-hidden="true" />
          <TypographicField
            canvasClassName={styles.matrixCanvas}
            statusClassName={styles.engineStatus}
            dotClassName={styles.statusDot}
          />
          {/* After the field, before the chrome: it grades the glyphs and
              nothing else. See `.heroFade`. */}
          <ProgressiveBlur position="bottom" height="var(--sp-9)" className={styles.heroFade} />

          <div className={styles.brandCenter}>
            <div className={styles.brandMark} aria-hidden="true">
              <Image
                src={lionMark}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 190px, 260px"
              />
            </div>
            <h1 id="home-wordmark" className={styles.wordmark}>LIONSOFZION</h1>
            <p className={styles.supportingLine}>Powered by evidence, not narratives.</p>
            <span className={styles.signalMarker} aria-hidden="true" />
            <Link href="/information-war" className={styles.heroCta}>
              Discover our system
            </Link>
          </div>
          {/* Deliberately NOT wrapped in `Reveal`, and this is a trap worth
              knowing about. `Reveal`'s shared observer runs with
              `rootMargin: "0px 0px -10% 0px"`, so the bottom tenth of the
              viewport is outside its root: an element pinned to the viewport's
              foot never intersects, stays `armed`, and sits at opacity 0
              forever. The 4s failsafe does not save it either — that only
              covers `pending`. Measured at 1440x810: the strip occupies
              765-810 and the effective root ends at 729.

              It is also the wrong idea. A scroll-entrance is for content a
              reader arrives at; this strip is furniture at the hero's foot,
              like the engine status beside it, and neither is revealed. */}
          {headlines.length ? (
            <aside className={styles.headlineRail} aria-label="Leading reports">
              <p className={styles.railLabel}>Intelligence desk</p>
              <ol className={styles.railList}>
                {headlines.slice(0, 3).map((headline, index) => (
                  <li className={styles.railItem} key={headline.publicId}>
                    <Link href={`/articles/${headline.publicId}`} className={styles.railLink}>
                      <span className={styles.railIndex} data-numeric>
                        0{index + 1}
                      </span>
                      <strong className={styles.railTitle}>{headline.title}</strong>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}
        </section>
      </main>
    </CinematicIntroGate>
  );
}
