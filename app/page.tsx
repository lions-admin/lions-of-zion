import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CinematicIntroGate } from "@/components/particle-nav/CinematicIntroGate";
import { TypographicField } from "@/components/typographic-field/TypographicField";
/* Imported from the modules rather than through `components/motion/index.ts`.
   `package.json` declares no `sideEffects` field, so a bundler must treat every
   module the barrel re-exports as side-effectful — and a CSS import is exactly
   that. Going through the barrel would land all seven `*.module.css` files in
   this route's stylesheet, five of which nothing here renders, on the one route
   whose first paint the whole site is judged by. */
import { ProgressiveBlur } from "@/components/motion/ProgressiveBlur";
import { Reveal } from "@/components/motion/Reveal";
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
 * The rail below is the opposite case — a secondary panel that reads better
 * arriving *after* the masthead has settled. See `.railHold` in the stylesheet
 * for how its stagger is held until the entrance layer actually lets go.
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
          {headlines.length ? (
            <Reveal
              as="aside"
              direction="none"
              className={`${styles.headlineRail} ${styles.railHold}`}
              aria-label="Leading reports"
            >
              <p className={styles.railLabel}>Intelligence desk</p>
              <ol className={styles.railList}>
                {headlines.slice(0, 3).map((headline, index) => (
                  <Reveal
                    as="li"
                    direction="up"
                    index={index + 1}
                    key={headline.publicId}
                    className={`${styles.railItem} ${styles.railHold}`}
                  >
                    <Link href={`/articles/${headline.publicId}`} className={styles.railLink}>
                      <span className={styles.railIndex} data-numeric>
                        0{index + 1}
                      </span>
                      <strong className={styles.railTitle}>{headline.title}</strong>
                    </Link>
                  </Reveal>
                ))}
              </ol>
            </Reveal>
          ) : null}
        </section>
      </main>
    </CinematicIntroGate>
  );
}
