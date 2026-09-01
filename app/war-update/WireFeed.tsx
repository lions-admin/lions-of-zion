'use client';

/**
 * Owns filter state and the per-entry permalink/share affordances for the
 * wire-dispatch feed. Split from `page.tsx` (an async Server Component)
 * because filtering needs client state; the data itself is still fetched
 * server-side and passed in as a prop.
 */
import { useMemo, useState } from 'react';
import { VerificationBadge, SourceList, type TimelineEntry } from '@/components/content';
import { Button } from '@/components/ui/Button';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

/** Filters are derived from the data, not a list invented ahead of what's
 *  actually there — and a category only earns a chip once filtering to it
 *  beats scrolling. On a seven-entry edition three of the four categories
 *  hold a single dispatch, so a chip for them is a slower way of reading one
 *  paragraph; the row disappears entirely when there is nothing to choose
 *  between, and widens on its own as the edition fills. "Front" and "home
 *  front" share one category in the source data ("Front · Home front"); the
 *  filter reflects that rather than pretending they're tracked separately. */
const MIN_ENTRIES_PER_FILTER = 2;
const ALL_FILTER = 'All';

const DATELINES: Record<string, string> = {
  'plan-announced': 'WASHINGTON',
  'ceasefire-signed': 'SHARM EL-SHEIKH',
  'ceasefire-effective': 'GAZA',
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void share()}
        aria-label={copied ? "Link copied to clipboard" : "Share dispatch"}
      >
        {copied ? '✓ Copied' : 'Share'}
      </Button>
    </div>
  );
}

export function WireFeed({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<string>(ALL_FILTER);

  const filters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.category) continue;
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    const earned = [...counts.entries()]
      .filter(([, count]) => count >= MIN_ENTRIES_PER_FILTER)
      .map(([category]) => category);
    return earned.length ? [ALL_FILTER, ...earned] : [];
  }, [entries]);

  const latestId = useMemo(
    () =>
      entries.reduce(
        (latest, entry) => (!latest || entry.datetime > latest.datetime ? entry : latest),
        null as TimelineEntry | null,
      )?.id,
    [entries],
  );

  const visible =
    filter === ALL_FILTER ? entries : entries.filter((entry) => entry.category === filter);

  return (
    <div>
      {filters.length ? (
        <div className={styles.filterRow} role="group" aria-label="Filter by category">
          {filters.map((option) => (
            <Button
              key={option}
              variant="filter"
              size="sm"
              isActive={filter === option}
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}

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
