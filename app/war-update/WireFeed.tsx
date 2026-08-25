'use client';

/**
 * Owns filter state and the per-entry permalink/share affordances for the
 * wire-dispatch feed. Split from `page.tsx` (an async Server Component)
 * because filtering needs client state; the data itself is still fetched
 * server-side and passed in as a prop.
 */
import { useMemo, useState } from 'react';
import { VerificationBadge, SourceList, type TimelineEntry } from '@/components/content';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

/** The real, distinct category values present in the data — not a filter
 *  list invented ahead of what's actually there. "Front" and "home front"
 *  share one category in the source data ("Front · Home front"); the
 *  filter reflects that rather than pretending they're tracked separately. */
const FILTERS = ['All', 'Diplomacy', 'Hostages', 'Front · Home front', 'Humanitarian'] as const;
type Filter = (typeof FILTERS)[number];

const DATELINES: Record<string, string> = {
  'plan-announced': 'WASHINGTON',
  'ceasefire-signed': 'SHARM EL-SHEIKH',
  'ceasefire-effective': 'GAZA',
  'hostages-released': 'GAZA',
};

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
  }
}

function DispatchActions({ entry }: { entry: TimelineEntry }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/war-update#${entry.id}`;

  const share = async () => {
    const shareText = `${entry.title} — Lions of Zion War Update\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: entry.title, text: entry.title, url });
        return;
      } catch {
        /* user cancelled or share failed — fall through to clipboard */
      }
    }
    copyToClipboard(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.dispatchActions}>
      <a href={`#${entry.id}`} className={styles.permalink} aria-label={`Permalink to ${entry.title}`}>
        # Permalink
      </a>
      <button type="button" className={styles.shareButton} onClick={() => void share()}>
        {copied ? 'Copied' : 'Share'}
      </button>
    </div>
  );
}

export function WireFeed({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<Filter>('All');

  const latestId = useMemo(
    () =>
      entries.reduce(
        (latest, entry) => (!latest || entry.datetime > latest.datetime ? entry : latest),
        null as TimelineEntry | null,
      )?.id,
    [entries],
  );

  const visible = filter === 'All' ? entries : entries.filter((entry) => entry.category === filter);

  return (
    <div>
      <div className={styles.filterRow} role="group" aria-label="Filter by category">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.filterChip}
            data-active={filter === option ? '' : undefined}
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
          >
            {option}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={styles.emptyFilter}>No entries in this category yet.</p>
      ) : (
        <ol className={styles.wire}>
          {visible.map((entry) => {
            const place = DATELINES[entry.id];
            return (
              <li key={entry.id} id={entry.id} className={styles.dispatch}>
                {/* The dispatch and its sources are siblings so the dispatch
                    can become a two-track grid above 1220px and put the
                    citation in the margin — `marginNote`, content.module.css. */}
                <div className={styles.dispatchMain}>
                  <p className={styles.byline}>
                    {place ? <span className={styles.datelinePlace}>{place}</span> : null}
                    {place ? <span aria-hidden="true"> — </span> : null}
                    {/* The dateline's uppercase is a CSS concern (`.byline`),
                        not a data transform — keeping it in one place means the
                        casing can change without touching the markup. */}
                    <time dateTime={entry.datetime}>{entry.dateLabel}</time>
                    {entry.category ? <span className={styles.category}>{entry.category}</span> : null}
                    {entry.id === latestId ? <span className={styles.latest}>Latest</span> : null}
                    {entry.assessment ? <VerificationBadge assessment={entry.assessment} /> : null}
                  </p>
                  <h3 className={styles.headline}>{entry.title}</h3>
                  <div className={styles.wireBody}>{entry.body}</div>
                  <DispatchActions entry={entry} />
                </div>
                {entry.sources?.length ? (
                  <div className={styles.dispatchSources}>
                    <SourceList sources={entry.sources} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
