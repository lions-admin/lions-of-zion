import Link from "next/link";
import type { PublicPublication } from "@/server/contracts/publication";
import { listPublicPublications } from "@/lib/publications";
import { EditorialShell } from "@/components/site/EditorialShell";
import styles from "./live-brief.module.css";

export async function LiveBriefHub() {
  const [briefs, allPublications, narratives] = await Promise.all([
    listPublicPublications("?section=daily_brief&limit=12"),
    listPublicPublications("?limit=18"),
    listPublicPublications("?section=narrative_watch&limit=8"),
  ]);
  const lead = briefs[0] ?? null;
  const updates = allPublications.filter(
    (entry) => entry.section === "israel_update" || entry.section === "war_update",
  );
  const latestTimestamp = allPublications[0]?.publishedAt ?? null;

  return (
    <EditorialShell
      routeId="geopolitical-brief"
      register="muted"
      className={styles.page}
      skipLinkClassName={styles.skipLink}
      progressTrackClassName={styles.progressTrack}
      progressValueClassName={styles.progressValue}
    >
      <section className={styles.hero} id="page-content" aria-labelledby="brief-heading">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>News / analysis / narrative watch</p>
            <h1 id="brief-heading">
              <span>THE DAILY</span>
              <span>BRIEF</span>
            </h1>
            <p className={styles.intro}>
              Daily news and updates, with a source-linked watch on false narratives
              and fake news being circulated about Israel and the war.
            </p>
            <div className={styles.heroActions}>
              <a href="#latest" className={styles.primaryAction}>
                {lead ? "Read today’s brief" : "View briefing status"}
                <span aria-hidden="true">↓</span>
              </a>
              <a href="#narratives" className={styles.textAction}>
                Narrative watch <span aria-hidden="true">↘</span>
              </a>
            </div>

            <Link href="/information-war" className={styles.informationWarTrigger}>
              <span className={styles.informationWarMark} aria-hidden="true">IW</span>
              <span className={styles.informationWarCopy}>
                <strong>This is an information war.</strong>
                <span>Explore the system <i aria-hidden="true">↗</i></span>
              </span>
            </Link>
          </div>

          <SignalHorizon hasEdition={Boolean(lead)} />
        </div>

        <dl className={styles.heroMeta}>
          <div>
            <dt>Edition status</dt>
            <dd>{lead ? "Published" : "Awaiting first edition"}</dd>
          </div>
          <div>
            <dt>Latest publication</dt>
            <dd>{latestTimestamp ? formatDate(latestTimestamp) : "No public edition yet"}</dd>
          </div>
          <div>
            <dt>Published records</dt>
            <dd>{allPublications.length}</dd>
          </div>
        </dl>
      </section>

      <section className={`${styles.section} ${styles.latest}`} id="latest" aria-labelledby="latest-heading">
        <SectionHeading
          index="01"
          label="Daily edition"
          title="Today’s brief"
          id="latest-heading"
        />
        {lead ? <LeadArticle article={lead} /> : <EmptyEdition />}
      </section>

      <section className={`${styles.section} ${styles.stream}`} id="updates" aria-labelledby="updates-heading">
        <SectionHeading
          index="02"
          label="Current coverage"
          title="Latest news and updates"
          id="updates-heading"
        />
        <ArticleStream entries={updates} empty="No updates have been published yet." />
      </section>

      <section className={`${styles.section} ${styles.narratives}`} id="narratives" aria-labelledby="narrative-heading">
        <div className={styles.narrativeIntro}>
          <SectionHeading
            index="03"
            label="Narrative Watch"
            title="False narratives and fake news"
            id="narrative-heading"
          />
          <p>
            Updates on misleading claims, manipulated context, and false stories being
            circulated — with the evidence, uncertainty, and disputes kept visible.
          </p>
          <Link href="/information-war" className={styles.systemLink}>
            See how the system works <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <ArticleStream
          entries={narratives}
          empty="No false-narrative or fake-news update has been published yet."
        />
      </section>

      {briefs.length > 1 ? (
        <section className={`${styles.section} ${styles.archive}`} aria-labelledby="archive-heading">
          <SectionHeading
            index="04"
            label="Archive"
            title="Previous editions"
            id="archive-heading"
          />
          <ArticleStream entries={briefs.slice(1)} empty="" />
        </section>
      ) : null}

      <footer className={styles.footer}>
        <p>
          Every publication is reviewed before release and retains its source trail,
          update date, and correction record.
        </p>
        <nav aria-label="Briefing policies">
          <Link href="/methodology">Methodology</Link>
          <Link href="/corrections">Corrections</Link>
        </nav>
      </footer>
    </EditorialShell>
  );
}

function SignalHorizon({ hasEdition }: { hasEdition: boolean }) {
  return (
    <div className={styles.signalStage} aria-hidden="true">
      <div className={styles.signalHeader}>
        <span>PUBLIC SOURCE DESK</span>
        <span>{hasEdition ? "EDITION AVAILABLE" : "NO EDITION PUBLISHED"}</span>
      </div>
      <div className={styles.signalField}>
        <span className={styles.signalArc} />
        <span className={styles.signalArcInner} />
        <span className={styles.signalSweep} />
        <span className={styles.signalNodeOne} />
        <span className={styles.signalNodeTwo} />
        <span className={styles.signalNodeThree} />
        <span className={styles.signalHorizon} />
      </div>
      <div className={styles.signalSources}>
        <span>Daily news</span>
        <span>War updates</span>
        <span>Public evidence</span>
        <span>False narratives</span>
      </div>
    </div>
  );
}

function SectionHeading({
  index,
  label,
  title,
  id,
}: {
  index: string;
  label: string;
  title: string;
  id: string;
}) {
  return (
    <header className={styles.sectionHeader}>
      <p><span>{index}</span>{label}</p>
      <h2 id={id}>{title}</h2>
    </header>
  );
}

function LeadArticle({ article }: { article: PublicPublication }) {
  return (
    <article className={styles.leadArticle}>
      <div className={styles.leadMeta}>
        <span>{formatSectionLabel(article.section)}</span>
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
      </div>
      <h3><Link href={`/articles/${article.publicId}`}>{article.title}</Link></h3>
      {article.summary ? <p>{article.summary}</p> : null}
      <Link href={`/articles/${article.publicId}`} className={styles.readMore}>
        Open daily brief <span aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}

function EmptyEdition() {
  return (
    <div className={styles.emptyEdition}>
      <p className={styles.emptyStatus}><span /> Nothing published yet</p>
      <h3>The first reviewed daily edition will appear here.</h3>
      <p>
        Collection and drafting may run automatically. Publication happens only
        after editorial approval.
      </p>
      <ol className={styles.editorialPath} aria-label="Editorial publication path">
        <li><span>01</span>Collect</li>
        <li><span>02</span>Review</li>
        <li><span>03</span>Publish</li>
      </ol>
    </div>
  );
}

function ArticleStream({ entries, empty }: { entries: PublicPublication[]; empty: string }) {
  if (!entries.length) {
    return empty ? (
      <div className={styles.emptyLine}>
        <span aria-hidden="true">—</span>
        <p>{empty}</p>
      </div>
    ) : null;
  }

  return (
    <ol className={styles.articleList}>
      {entries.map((article, index) => (
        <li key={article.publicId}>
          <Link href={`/articles/${article.publicId}`} className={styles.articleLink}>
            <span className={styles.articleIndex}>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p>{formatSectionLabel(article.section)}</p>
              <h3>{article.title}</h3>
              {article.summary ? <small>{article.summary}</small> : null}
            </div>
            <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
            <span className={styles.articleArrow} aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function formatSectionLabel(section: string): string {
  const label = section.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}
