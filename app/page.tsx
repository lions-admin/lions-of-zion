import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Monomakh, Pompiere, Sansita } from "next/font/google";
import { BRAND_LOGO_DATA_URL } from "./brand-logo";
import styles from "./signal-field.module.css";
import { SIGNAL_VOCABULARY, type SignalToken } from "./signal-vocabulary";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { CinematicIntroGate } from "@/components/particle-nav/CinematicIntroGate";

const LANE_COUNT = 28;
const HERO_MESSAGES = [
  {
    title: ["Fighting information manipulation", "with software engineering."],
    copy: "We live in an age when lies travel faster and farther than ever. We built a system to detect, expose, report, and publish disinformation. Join us.",
  },
  {
    title: ["Truth needs", "infrastructure."],
    copy: "Disinformation is engineered. So is our response: a system built to identify false narratives, document the evidence, report abuse, and publish what the public needs to know. Join us.",
  },
  {
    title: ["They engineer perception.", "We engineer the defense."],
    copy: "When lies are designed to spread, truth needs more than a reply. Our system detects, exposes, reports, and publishes the evidence behind coordinated disinformation. Join us.",
  },
] as const;

export const dynamic = "force-dynamic";

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-libre-baskerville",
});
const sansita = Sansita({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const monomakh = Monomakh({ subsets: ["latin"], weight: "400", display: "swap" });
const pompiere = Pompiere({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pompiere",
  display: "swap",
});

const LANES = Array.from({ length: LANE_COUNT }, (_, laneIndex) =>
  SIGNAL_VOCABULARY.filter((_, tokenIndex) => tokenIndex % LANE_COUNT === laneIndex),
);

type LaneStyle = CSSProperties & {
  "--duration": string;
  "--delay": string;
  "--typing-duration": string;
  "--typing-delay": string;
};

type TokenStyle = CSSProperties & {
  "--pulse-delay": string;
  "--pulse-duration": string;
};

function TerminalLine({
  tokens,
  laneIndex,
  duplicate = false,
}: {
  tokens: readonly SignalToken[];
  laneIndex: number;
  duplicate?: boolean;
}) {
  const streamNumber = String(laneIndex + 1).padStart(2, "0");

  return (
    <div className={`${styles.group} ${styles.typedGroup}`} aria-hidden={duplicate || undefined}>
      <span className={styles.terminalPrompt}>{`> SCAN // STREAM-${streamNumber} // INPUT`}</span>
      {tokens.map((token, tokenIndex) => {
        const tokenStyle: TokenStyle = {
          "--pulse-delay": `${-((tokenIndex * 0.73 + laneIndex * 0.29) % 7.2)}s`,
          "--pulse-duration": `${4.8 + ((tokenIndex * 5 + laneIndex) % 27) / 10}s`,
        };

        return (
          <span
            className={`${styles.token} ${token.kind === "source" ? styles.source : ""}`}
            key={`${duplicate ? "copy" : "original"}-${token.value}`}
            style={tokenStyle}
          >
            <em>{token.kind === "source" ? "SOURCE" : "MATCH"}</em>
            {token.value}
          </span>
        );
      })}
      <i className={styles.terminalCaret} aria-hidden="true" />
    </div>
  );
}

function Navigation() {
  const leftLinks = SITE_NAVIGATION.slice(0, 4);
  const rightLinks = SITE_NAVIGATION.slice(4);

  return (
    <nav className={`${styles.floatingNav} ${sansita.className}`} aria-label="Primary navigation">
      <div className={`${styles.navLinks} ${styles.navLeft}`}>
        {leftLinks.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </div>
      <Link href="/" className={styles.brandMark} aria-label="Lions of Zion home">
        <Image
          src={BRAND_LOGO_DATA_URL}
          alt="Lions of Zion"
          width={382}
          height={136}
          priority
          unoptimized
          className={styles.brandLogo}
        />
      </Link>
      <div className={`${styles.navLinks} ${styles.navRight}`}>
        {rightLinks.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </div>
    </nav>
  );
}

export default function Page() {
  const hero = HERO_MESSAGES[Math.floor(Math.random() * HERO_MESSAGES.length)];

  return (
    <CinematicIntroGate>
      <main className={`${styles.field} ${libreBaskerville.variable} ${pompiere.variable}`}>
      <Navigation />
      <section className={styles.hero} aria-labelledby="hero-title">
        <h1 id="hero-title" className={`${styles.heroTitle} ${monomakh.className}`}>
          {hero.title.map((line) => <span key={line}>{line}</span>)}
        </h1>
        <p className={styles.heroCopy}>
          {hero.copy}
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.dailyReportAction} href="/geopolitical-brief">
            <strong className={styles.dailyReportTitle}>The Daily Report</strong>
            <span className={styles.dailyReportPrompt}>View today’s analysis</span>
          </Link>
        </div>
      </section>
      <section className={styles.editorialDesk} aria-labelledby="featured-intelligence">
        <header className={styles.deskHeader}>
          <h2 id="featured-intelligence">Featured Intelligence</h2>
          <span>Investigations / Archives / First-hand accounts</span>
        </header>
        <div className={styles.featureGrid}>
          <Link className={`${styles.featureCard} ${styles.featureLead} ${styles.featureBrief}`} href="/geopolitical-brief">
            <span className={styles.featureIndex}>01 / PRIMARY FILE</span>
            <div className={styles.featureBody}>
              <span className={styles.featureEyebrow}>GEOPOLITICAL BRIEF</span>
              <h2>Iran’s Web of Influence: Money, Media, and Militias</h2>
              <p>How power, propaganda, and proxy networks reshape the information battlefield.</p>
              <span className={styles.featureCta}>READ THE BRIEF <b>→</b></span>
            </div>
          </Link>
          <div className={styles.featureSide}>
            <Link className={styles.featureCard} href="/october-7">
              <span className={`${styles.featureMedia} ${styles.featureOctober}`} aria-hidden="true" />
              <span className={styles.featureBody}>
                <span className={styles.featureEyebrow}>OCTOBER 7</span>
                <h2>The day after: what changed—and what must not be forgotten.</h2>
                <span className={styles.featureCta}>EXPLORE THE STORY <b>→</b></span>
              </span>
            </Link>
            <Link className={styles.featureCard} href="/our-heroes">
              <span className={`${styles.featureMedia} ${styles.featureHeroes}`} aria-hidden="true" />
              <span className={styles.featureBody}>
                <span className={styles.featureEyebrow}>OUR HEROES</span>
                <h2>The people who stood firm when the world looked away.</h2>
                <span className={styles.featureCta}>MEET OUR HEROES <b>→</b></span>
              </span>
            </Link>
          </div>
        </div>
      </section>
      <aside className={styles.updateBar} aria-label="Editorial updates">
        <div className={styles.updateLabel}>
          <span>LATEST</span>
          <strong>UPDATES</strong>
        </div>
        <div className={styles.updateViewport}>
          <div className={styles.updateTrack}>
            <div className={styles.updateSequence}>
              <Link href="/geopolitical-brief"><small>BRIEF</small><span>Iran’s influence network: follow the signal</span></Link>
              <Link href="/october-7"><small>ARCHIVE</small><span>October 7: evidence, context, memory</span></Link>
              <Link href="/our-heroes"><small>PROFILES</small><span>The people behind the stories</span></Link>
            </div>
            <div className={styles.updateSequence} aria-hidden="true">
              <Link href="/geopolitical-brief" tabIndex={-1}><small>BRIEF</small><span>Iran’s influence network: follow the signal</span></Link>
              <Link href="/october-7" tabIndex={-1}><small>ARCHIVE</small><span>October 7: evidence, context, memory</span></Link>
              <Link href="/our-heroes" tabIndex={-1}><small>PROFILES</small><span>The people behind the stories</span></Link>
            </div>
          </div>
        </div>
        <Link className={styles.updateAll} href="/geopolitical-brief">VIEW ALL <span>→</span></Link>
      </aside>
      <div className={styles.lanes} aria-label="Continuously moving monitored signal vocabulary">
        {LANES.map((tokens, laneIndex) => {
          const laneStyle: LaneStyle = {
            "--duration": `${38 + ((laneIndex * 9) % 33)}s`,
            "--delay": `${-1 * ((laneIndex * 13) % 41)}s`,
            "--typing-duration": `${8.5 + ((laneIndex * 7) % 53) / 10}s`,
            "--typing-delay": `${-1 * ((laneIndex * 19) % 83) / 10}s`,
          };

          return (
            <div className={styles.lane} key={laneIndex} style={laneStyle}>
              <div className={styles.track}>
                <TerminalLine tokens={tokens} laneIndex={laneIndex} />
                <TerminalLine tokens={tokens} laneIndex={laneIndex} duplicate />
              </div>
            </div>
          );
        })}
      </div>
      </main>
    </CinematicIntroGate>
  );
}
