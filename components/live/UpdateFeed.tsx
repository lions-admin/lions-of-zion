import Link from "next/link";
import { PUBLICATION_SECTIONS } from "@/server/contracts/enums";
import type { PublicationSection } from "@/server/contracts/enums";
import type { PublicPublication } from "@/server/contracts/publication";
import { StatusState } from "@/components/ui/StatusState";
import { groupByDay } from "./feed-time";
import { FeedStatus } from "./FeedStatus";
import { SECTION_LABELS } from "./publication-labels";
import { UpdateEntry } from "./UpdateEntry";
import styles from "./live-feed.module.css";

export const UPDATES_PATH = "/updates";

export interface UpdateFeedProps {
  entries: PublicPublication[];
  /** The section filter in force, if any. */
  section?: PublicationSection;
  /** True when this page was reached through a cursor — i.e. it is not the first. */
  paged: boolean;
  /**
   * The cursor for the next (older) page, or `undefined` at the end of the
   * record. Computed by the caller with `encodePublicPublicationCursor` from
   * the last row, and only when the page came back exactly full — a short page
   * is the last page, and offering "older" on it would be a link to nothing.
   */
  nextCursor?: string;
  /** The read failed, as opposed to succeeding and finding nothing. */
  unavailable: boolean;
}

function href(section: PublicationSection | undefined, cursor?: string): string {
  const query = new URLSearchParams();
  if (section) query.set("section", section);
  if (cursor) query.set("cursor", cursor);
  const search = query.toString();
  return search ? `${UPDATES_PATH}?${search}` : UPDATES_PATH;
}

/**
 * The published record, newest first.
 *
 * Three things distinguish this from the Daily Brief desk at
 * `/geopolitical-brief`, which reads the same projection: that page is an
 * edited front — a lead, a featured story, grouped rails, one shot of a
 * hundred rows. This one is the complete chronological record and it *walks*,
 * through the API's real keyset cursor, so the archive behind the front is
 * reachable rather than merely present.
 *
 * Every control on the page is a link. Filtering and paging work with
 * JavaScript off, they are addressable and shareable, and the back button does
 * what a reader expects. There is no client component on this surface: day
 * groups are ordinary sections so a 320 screenshot and a no-JS reader see
 * the rows immediately, rather than waiting on IntersectionObserver.
 *
 * The list does not reorder, pulse, or insert while it is being read. A
 * newer snapshot arrives only when the reader follows a filter, a pager
 * link, or reloads — all user intent.
 */
export function UpdateFeed({
  entries,
  section,
  paged,
  nextCursor,
  unavailable,
}: UpdateFeedProps) {
  const days = groupByDay(entries, (entry) => entry.publishedAt);

  return (
    <div className={styles.feedRoot}>
      <FeedStatus entryCount={entries.length} filtered={section !== undefined} />

      <nav className={styles.filters} aria-label="Filter by section">
        <Link
          href={href(undefined)}
          className={styles.filter}
          aria-current={section ? undefined : "page"}
        >
          Everything
        </Link>
        {PUBLICATION_SECTIONS.map((value) => (
          <Link
            key={value}
            href={href(value)}
            className={styles.filter}
            aria-current={section === value ? "page" : undefined}
          >
            {SECTION_LABELS[value]}
          </Link>
        ))}
      </nav>

      {unavailable ? (
        <StatusState
          status="error"
          eyebrow="FEED STATUS"
          title="The published record could not be read."
          description="This is a fault on our side, not an empty archive. Published entries are unaffected and the feed returns when the read succeeds."
          actionText="Try again"
          actionHref={href(section)}
        />
      ) : days.length === 0 ? (
        <StatusState
          status="empty"
          eyebrow="FEED STATUS"
          title={
            section
              ? `Nothing has been published in ${SECTION_LABELS[section]} yet.`
              : "Nothing has been published yet."
          }
          description="Entries appear here only after they have cleared the evidence and quality checks. This page never shows sample or placeholder material to fill the space."
          actionText={section ? "Show every section" : "How the checks work"}
          actionHref={section ? href(undefined) : "/information-war#system"}
        />
      ) : (
        /* A day is a `<section>` with an id, not a list item, and that is
           load-bearing twice over. `SectionToc` resolves a heading's anchor
           through the nearest id'd ancestor and its scroll region through
           `closest('section, article')` — inside an `<ol>` the region would
           resolve to the whole page and every day would share one anchor, so
           the contents rail would list nothing usable. As a section, the rail
           becomes a real date index over the feed. */
        <div className={styles.feed} aria-describedby="feed-staleness">
          {days.map((day) => (
            <section
              key={day.key}
              id={`day-${day.key}`}
              className={styles.day}
            >
              <h2 className={styles.dayHeading}>
                <time dateTime={day.key}>{day.label}</time>
              </h2>
              <ol className={styles.dayEntries}>
                {day.entries.map((entry) => (
                  <UpdateEntry entry={entry} key={entry.publicId} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {(nextCursor || paged) && !unavailable ? (
        <nav className={styles.pager} aria-label="Feed pages">
          {paged ? (
            <Link href={href(section)} className={styles.pagerLink} rel="first">
              <span aria-hidden="true">&uarr;</span> Newest entries
            </Link>
          ) : null}
          {nextCursor ? (
            <Link href={href(section, nextCursor)} className={styles.pagerLink} rel="next">
              Older entries <span aria-hidden="true">&darr;</span>
            </Link>
          ) : (
            <p className={styles.pagerEnd}>You have reached the start of the record.</p>
          )}
        </nav>
      ) : null}
    </div>
  );
}
