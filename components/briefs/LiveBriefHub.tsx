import Link from "next/link";
import { listPublicPublications } from "@/lib/publications";
import {
  CorrectionHistory,
  FigureRow,
  KnownUnknownPanel,
  PublicationMeta,
  SourceList,
  Timeline,
  VerificationBadge,
} from "@/components/content";
import { geopoliticalReferenceBrief as refBrief } from "./geopolitical-reference";
import {
  briefDevelopmentEntries,
  STATUS_TO_ASSESSMENT,
  toIsoDateOnly,
  toSource,
} from "./adapters";
import { ReadingProgress } from "@/components/sections/ReadingProgress";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "./live-brief.module.css";

const STALE_AFTER_DAYS = 14;

function isBriefStale(publishedAt: string): boolean {
  const publishedMs = new Date(toIsoDateOnly(publishedAt)).getTime();
  if (Number.isNaN(publishedMs)) return false;
  const ageDays = (Date.now() - publishedMs) / (24 * 60 * 60 * 1000);
  return ageDays > STALE_AFTER_DAYS;
}

export async function LiveBriefHub() {
  const [briefs, allPublications, narratives] = await Promise.all([
    listPublicPublications("?section=daily_brief&limit=12").catch(() => []),
    listPublicPublications("?limit=18").catch(() => []),
    listPublicPublications("?section=narrative_watch&limit=8").catch(() => []),
  ]);

  const lead = briefs[0] ?? null;
  const updates = allPublications.filter(
    (entry) => entry.section === "israel_update" || entry.section === "war_update",
  );
  const developmentEntries = briefDevelopmentEntries();
  const corrections = refBrief.corrections;
  const stale = isBriefStale(lead?.publishedAt ?? refBrief.publishedAt);

  return (
    <main className={styles.page} data-reading-scroll>
      <span id="brief-top" aria-hidden="true" />
      <a href="#brief-content" className={styles.skipLink}>
        Skip to brief
      </a>
      <div className={styles.quietBackdrop} aria-hidden="true" />

      <SiteHeader activeSection="geopolitical-brief" />
      <ReadingProgress
        trackClassName={styles.progressTrack}
        valueClassName={styles.progressValue}
      />

      <div className={styles.layout}>
        <article className={styles.article} id="brief-content">
          <header className={styles.briefHeader}>
            <div className={styles.briefEyebrow}>
              <span>{lead ? "LIVE EDITION" : refBrief.edition}</span>
              <VerificationBadge
                assessment={lead ? "verified" : STATUS_TO_ASSESSMENT[refBrief.status]}
              />
            </div>
            <p className={styles.topic}>{refBrief.title}</p>
            <div className={styles.statHero}>
              <p className={styles.heroFigure}>80 km</p>
              <div className={styles.heroCopy}>
                <h1>{lead ? lead.title : refBrief.headline}</h1>
                <p className={styles.dek}>{lead?.summary ?? refBrief.dek}</p>
              </div>
            </div>

            <p className={styles.statQualifier}>
              Publicly reported funded by 24 Jun 2026, against an announced programme scope of approximately 500 km.
            </p>

            <div className={styles.metaSpacer}>
              <PublicationMeta
                publishedAt={lead ? lead.publishedAt : refBrief.publishedAt}
                coverageWindow={refBrief.coverageWindow}
                sourceCount={refBrief.sourceCount}
              />
            </div>
            {stale ? (
              <p className={styles.staleNotice} role="note">
                This edition is more than {STALE_AFTER_DAYS} days old — check for a newer one before treating it as current.
              </p>
            ) : null}
          </header>

          <nav className={styles.contents} aria-label="Brief sections">
            <ol>
              <li><a href="#snapshot">Snapshot</a></li>
              <li><a href="#changes">Changes</a></li>
              <li><a href="#developments">Developments</a></li>
              <li><a href="#assessment">Assessment</a></li>
              <li><a href="#narrative-watch">Narratives</a></li>
              <li><a href="#unknowns">Unknowns</a></li>
              <li><a href="#sources">Sources</a></li>
              {updates.length > 0 ? (
                <li><a href="#live-updates">Dispatches</a></li>
              ) : null}
              {briefs.length > 1 ? (
                <li><a href="#archive">Archive</a></li>
              ) : null}
            </ol>
          </nav>

          <section className={styles.evidenceContract} aria-label="Evidence contract">
            <span className={styles.evidenceKicker}>Evidence contract</span>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>
                  <VerificationBadge
                    assessment={lead ? "verified" : STATUS_TO_ASSESSMENT[refBrief.status]}
                  />
                </dd>
              </div>
              <div>
                <dt>Primary records</dt>
                <dd>{refBrief.sourceCount}</dd>
              </div>
              <div>
                <dt>Programme scope</dt>
                <dd>≈500 km</dd>
              </div>
              <div>
                <dt>Funded by review</dt>
                <dd>80 km</dd>
              </div>
              <div>
                <dt>Programme estimate</dt>
                <dd>NIS 5.5B</dd>
              </div>
              <div>
                <dt>Corrections</dt>
                <dd>
                  {corrections.length > 0 ? `${corrections.length} recorded` : "None recorded"}
                </dd>
              </div>
            </dl>
          </section>

          {/* 01 · EXECUTIVE SNAPSHOT */}
          <section id="snapshot" className={styles.section}>
            <div className={styles.sectionLabel}>
              <h2>Executive snapshot</h2>
            </div>
            <div className={styles.summary}>
              {refBrief.summary.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className={styles.figuresSpacer}>
              <FigureRow figures={[...refBrief.figures]} />
            </div>
          </section>

          {/* 02 · WHAT CHANGED */}
          <section id="changes" className={styles.section}>
            <div className={styles.sectionLabel}>
              <h2>What changed</h2>
            </div>
            <ol className={styles.changeList}>
              {refBrief.changes.map((change, index) => (
                <li key={change}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{change}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* 03 · VERIFIED DEVELOPMENTS */}
          <section id="developments" className={styles.section}>
            <div className={styles.sectionLabel}>
              <h2>Verified developments</h2>
            </div>
            {developmentEntries.length > 0 ? (
              <Timeline variant="feed" entries={developmentEntries} />
            ) : (
              <p className={styles.sectionEmpty}>No developments recorded for this edition.</p>
            )}
          </section>

          {/* 04 · ASSESSMENT */}
          <section id="assessment" className={`${styles.section} ${styles.assessment}`}>
            <div className={styles.sectionLabel}>
              <h2>Assessment</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.assessmentNotice}>
                Inference from the official record—not a reported event.
              </p>
              <p>{refBrief.assessment}</p>
            </div>
          </section>

          {/* 05 · NARRATIVE WATCH & DISINFORMATION INTERCEPTS */}
          <section id="narrative-watch" className={styles.section}>
            <div className={styles.sectionLabel}>
              <h2>Narrative watch</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.sectionIntro}>
                Forensic audit of contested claims circulating in regional and international media,
                benchmarked directly against official parliamentary and defense records.
              </p>

              <div className={styles.narrativeGrid}>
                <div className={styles.narrativeEntry}>
                  <div className={styles.narrativeHeader}>
                    <span className={styles.narrativeKicker}>CLAIM UNDER AUDIT</span>
                    <VerificationBadge assessment="false" confidence="high" />
                  </div>
                  <h3 className={styles.narrativeClaim}>
                    &ldquo;Single Unified 500km Border Wall Completed Overnight&rdquo;
                  </h3>
                  <p className={styles.narrativeFact}>
                    <strong>Ground truth on record:</strong> Official Knesset committee proceedings confirm
                    that while a roughly 500km scope is planned, only 80km had been funded and commenced as
                    of late June 2026. Delivery remains phased.
                  </p>
                  <div className={styles.narrativeSource}>
                    <span>Source: Knesset Foreign Affairs &amp; Defense Committee</span>
                  </div>
                </div>

                <div className={styles.narrativeEntry}>
                  <div className={styles.narrativeHeader}>
                    <span className={styles.narrativeKicker}>MANIPULATED CONTEXT</span>
                    <VerificationBadge assessment="out_of_context" confidence="high" />
                  </div>
                  <h3 className={styles.narrativeClaim}>
                    &ldquo;Controlled Demolitions Misrepresented as Offensive Strikes&rdquo;
                  </h3>
                  <p className={styles.narrativeFact}>
                    <strong>Ground truth on record:</strong> Ministry of Defense engineering records
                    establish that detonations along the eastern corridor were controlled clearances of
                    legacy anti-tank minefields necessary for ground preparation.
                  </p>
                  <div className={styles.narrativeSource}>
                    <span>Source: Israel Ministry of Defense Communiqué</span>
                  </div>
                </div>
              </div>

              {narratives.length > 0 ? (
                <div className={styles.publishedNarrativesList}>
                  <h3 className={styles.subhead}>Additional Tracked Narratives</h3>
                  <ol className={styles.articleStream}>
                    {narratives.map((item) => (
                      <li key={item.publicId}>
                        <Link href={`/articles/${item.publicId}`} className={styles.articleStreamLink}>
                          <div className={styles.articleStreamBody}>
                            <h4>{item.title}</h4>
                            {item.summary ? <p>{item.summary}</p> : null}
                          </div>
                          <span className={styles.arrow} aria-hidden="true">↗</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className={styles.iwCallout}>
                <div className={styles.iwCalloutBody}>
                  <strong>Cognitive Warfare Architecture</strong>
                  <p>
                    Explore the 5-stage amplification pipeline showing how fabricated claims travel from
                    isolated sources to international headlines.
                  </p>
                </div>
                <Link href="/information-war" className={styles.iwLink}>
                  Information War Network <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>

          {/* 06 · KNOWN UNKNOWNS */}
          <section id="unknowns" className={styles.section}>
            <div className={styles.sectionLabel}>
              <h2>Known unknowns</h2>
            </div>
            <KnownUnknownPanel
              unknowns={[...refBrief.unknowns]}
              wouldChange={[...refBrief.changeConditions]}
            />
          </section>

          {/* 07 · SOURCE STACK */}
          <section id="sources" className={styles.section}>
            <div className={styles.sectionLabel}>
              <h2>Source stack</h2>
            </div>
            {refBrief.sources.length > 0 ? (
              <SourceList sources={refBrief.sources.map(toSource)} />
            ) : (
              <p className={styles.sectionEmpty}>No sources recorded for this edition.</p>
            )}
          </section>

          {/* LIVE DISPATCHES (IF PRESENT) */}
          {updates.length > 0 ? (
            <section id="live-updates" className={styles.section}>
              <div className={styles.sectionLabel}>
                <h2>Incoming live dispatches</h2>
              </div>
              <ol className={styles.articleStream}>
                {updates.map((update) => (
                  <li key={update.publicId}>
                    <Link href={`/articles/${update.publicId}`} className={styles.articleStreamLink}>
                      <div className={styles.articleStreamBody}>
                        <span className={styles.streamDate}>{formatDate(update.publishedAt)}</span>
                        <h4>{update.title}</h4>
                        {update.summary ? <p>{update.summary}</p> : null}
                      </div>
                      <span className={styles.arrow} aria-hidden="true">↗</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* ARCHIVE (IF PRESENT) */}
          {briefs.length > 1 ? (
            <section id="archive" className={styles.section}>
              <div className={styles.sectionLabel}>
                <h2>Archived editions</h2>
              </div>
              <ol className={styles.articleStream}>
                {briefs.slice(1).map((briefItem) => (
                  <li key={briefItem.publicId}>
                    <Link href={`/articles/${briefItem.publicId}`} className={styles.articleStreamLink}>
                      <div className={styles.articleStreamBody}>
                        <span className={styles.streamDate}>{formatDate(briefItem.publishedAt)}</span>
                        <h4>{briefItem.title}</h4>
                        {briefItem.summary ? <p>{briefItem.summary}</p> : null}
                      </div>
                      <span className={styles.arrow} aria-hidden="true">↗</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* CORRECTIONS */}
          <footer className={styles.corrections}>
            <CorrectionHistory corrections={[...corrections]} />
          </footer>

          {/* CLOSING / COLOPHON */}
          <div className={styles.closing}>
            <span className={styles.closingMark}>
              {lead ? "End of live dispatch" : "End of brief — Reference 001"}
            </span>
            <nav className={styles.closingNav} aria-label="Leave the brief">
              <Link href="/">
                <span aria-hidden="true">←</span> Return to the scan
              </Link>
              <Link href="/war-update">
                Next desk · War Update <span aria-hidden="true">→</span>
              </Link>
              <a href="#brief-top">
                Back to top <span aria-hidden="true">↑</span>
              </a>
            </nav>
            <nav className={styles.docLinks} aria-label="Policy pages">
              <Link href="/methodology">Methodology</Link>
              <span aria-hidden="true">·</span>
              <Link href="/corrections">Corrections</Link>
            </nav>
          </div>
        </article>
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "Asia/Jerusalem",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
