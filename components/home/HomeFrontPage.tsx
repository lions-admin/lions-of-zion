/**
 * The home page's front page — the editorial band below the particle scene.
 *
 * This is the half of the home route that reverses the old "no content below
 * the fold" invariant (`.ai/DECISIONS.md`). Three things it exists to fix,
 * all of them findings from the design review:
 *
 *   - the home page surfaced no documented content at all;
 *   - the eight section descriptions existed only on hover, so no touch
 *     visitor ever saw them;
 *   - the home page still spoke the pre-V2 type language.
 *
 * So it is built from `components/content/` and the V2 tokens, not from the
 * particle scene's own dialect. It is a plain Server Component and a sibling
 * of the scene — it sits outside `NavClient`'s client boundary, so it needs
 * none of the pass-through-as-children handling `HomeSignalLayer` does.
 *
 * `data-home-scroll` is load-bearing beyond this file: `app/globals.css` keys
 * the home route's document scroll on it, and its being an attribute rather
 * than an id is what keeps the intro's scroll lock able to outrank it.
 */
import Link from 'next/link';
import { defaultNodes } from '@/components/particle-nav/config';
import { geopoliticalReferenceBrief as brief } from '@/components/briefs/geopolitical-reference';
import {
  ContentCard,
  SourceList,
  Timeline,
  VerificationBadge,
} from '@/components/content';
import { STATUS_TO_ASSESSMENT } from '@/components/briefs/adapters';
import { ScanBackdrop } from '@/components/sections/ScanBackdrop';
import type { NavNode } from '@/components/particle-nav/types';
import type { HomeMilestone } from '@/lib/content/home';
import styles from './home.module.css';

const pad = (value: number) => String(value).padStart(2, '0');

/** The reader-facing name for each node's declared intent. */
const GROUPS: { label: string; intent: NonNullable<NavNode['intent']> }[] = [
  { label: 'Now', intent: 'now' },
  { label: 'Understand and verify', intent: 'understand' },
  { label: 'Trust and participate', intent: 'participate' },
];

export interface HomeFrontPageProps {
  latest: HomeMilestone | null;
  recent: HomeMilestone[];
  /** War Update's authored trust sentence — what this desk does and doesn't do. */
  trustStrip: string;
}

export function HomeFrontPage({ latest, recent, trustStrip }: HomeFrontPageProps) {
  /* The lead is the newest milestone; the record list is everything after it,
     so the same entry never appears twice on one screen. */
  const rest = latest ? recent.filter((entry) => entry.id !== latest.id) : recent;

  return (
    <section data-home-scroll className={styles.frontPage}>
      {/* The scan does not stop at the fold. Above this band it is the live
          WebGPU layer; here it is the same corpus, server-rendered and drifting
          by CSS, exactly as on every reading page — so the ground under the
          content is the site's ground, not a flat panel laid over it. The dock
          is what keeps it inside the band instead of over the scene. */}
      <div className={styles.backdropDock} aria-hidden="true">
        <ScanBackdrop routeId="home-front-page" surface="band" />
      </div>

      {/* The anchored strip. It sits in the band the orbit already leaves
          empty below its bottom node — measured at 38–71px across viewports,
          which is why it is one line and why the overlap is gated on height
          as well as width (`home.module.css`). */}
      <div className={styles.strip}>
        {latest ? (
          <Link href={latest.section.href} className={styles.stripLead}>
            <span className={styles.stripKicker}>Latest documented milestone</span>
            <time dateTime={latest.datetime} className={styles.stripDate}>
              {latest.dateLabel}
            </time>
            <span className={styles.stripTitle}>{latest.title}</span>
          </Link>
        ) : null}
        <a href="#home-masthead" className={styles.stripJump}>
          The front page
          <span aria-hidden="true">↓</span>
        </a>
      </div>

      <div className={styles.shell}>
        <header id="home-masthead" className={styles.masthead}>
          <p className={styles.mastheadKicker}>Independent evidence network</p>
          <h1 className={styles.mastheadTitle}>Lions of Zion</h1>
          <p className={styles.mastheadLede}>{trustStrip}</p>
          <div className={styles.mastheadRule} />
        </header>

        {latest ? (
          <article className={styles.lead}>
            <p className={styles.leadKicker}>
              <Link href={latest.section.href}>{latest.section.label}</Link>
              <span aria-hidden="true"> · </span>
              <time dateTime={latest.datetime}>{latest.dateLabel}</time>
            </p>
            <h2 className={styles.leadTitle}>
              <Link href={latest.section.href}>{latest.title}</Link>
            </h2>
            <div className={styles.leadBody}>{latest.body}</div>
            {latest.sources?.length ? (
              <div className={styles.leadSources}>
                <SourceList sources={latest.sources} />
              </div>
            ) : null}
          </article>
        ) : null}

        <div className={styles.cards}>
          <ContentCard
            eyebrow={brief.edition}
            title={brief.title}
            href="/geopolitical-brief"
            meta={<VerificationBadge assessment={STATUS_TO_ASSESSMENT[brief.status]} />}
          >
            <p>{brief.headline}</p>
          </ContentCard>

          {/* The corrections log is empty, and says so. `.ai/DECISIONS.md`:
              an honest empty state, never a placeholder count. */}
          <ContentCard
            eyebrow="Corrections"
            title="None recorded"
            href="/corrections"
            accent="ember"
          >
            <p>
              Every correction this desk issues is published, dated and kept. The log is
              empty because nothing has needed one yet.
            </p>
          </ContentCard>
        </div>

        {rest.length ? (
          <section className={styles.record} aria-labelledby="home-record-heading">
            <h2 id="home-record-heading" className={styles.sectionHeading}>
              Recently documented
            </h2>
            <Timeline entries={rest} variant="feed" />
          </section>
        ) : null}

        <nav className={styles.index} aria-labelledby="home-index-heading">
          <h2 id="home-index-heading" className={styles.sectionHeading}>
            The eight files
          </h2>
          {/* Grouped by the intent each node already declares, which is the
              same taxonomy the orbit arranges itself by. It used to be a
              colour-coded legend in the scene's corner at 0.53rem, explaining
              nothing; as headings over the files themselves it finally says
              what it means. */}
          {GROUPS.map((group) => (
            <section key={group.intent} className={styles.indexGroup}>
              <h3 className={styles.indexGroupHeading}>{group.label}</h3>
              <ul className={styles.indexList}>
                {defaultNodes
                  .map((node, index) => ({ node, index }))
                  .filter(({ node }) => node.intent === group.intent)
                  .map(({ node, index }) => (
                    <li key={node.id}>
                      <Link href={node.href} className={styles.entry}>
                        {/* The number is the node's real position in
                            `defaultNodes`, not its position in this group —
                            it is the same "File NN / 08" identity the section
                            pages print. */}
                        <span className={styles.entryIndex}>
                          File {pad(index + 1)} / {pad(defaultNodes.length)}
                        </span>
                        {/* `displayName`, never `label` — the orbit stores
                            labels uppercase as identity, and CSS `capitalize`
                            turns "ISRAEL'S STORY" into "Israel'S Story". */}
                        <span className={styles.entryLabel}>{node.displayName}</span>
                        <span className={styles.entryDescription}>{node.description}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </nav>

        <p className={styles.docLinks}>
          <Link href="/methodology">Methodology</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/corrections">Corrections</Link>
        </p>
      </div>
    </section>
  );
}
