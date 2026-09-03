import { displayTitle, displayWitness } from '@/lib/content/archive';
import type { ArchiveIndexEntry } from '@/lib/content/archive';
import styles from './archive.module.css';

export type ArchiveFullIndexProps = {
  entries: ArchiveIndexEntry[];
  /** The index route's own path. */
  basePath: string;
  /** Documentation's records sit under their category segment. */
  categorised?: boolean;
  uncategorised?: string;
  heading: string;
};

/** Hides the regions `ArchiveIndex` marks as inert without a client. */
const NO_JS_STYLE = '[data-needs-js]{display:none!important}';

/**
 * Every record in the archive, as plain links, for a reader with no
 * JavaScript.
 *
 * `ArchiveIndex` pages the archive so a phone lays out 24 rows instead of 335
 * (PERF-004), and paging needs a client: both index routes are prerendered, so
 * `?page=3` serves the same HTML as `?page=1`. Without this, scripting off
 * would mean an archive whose first 24 records are reachable and whose other
 * 311 are not — which is a worse failure than the one paging fixed.
 *
 * So the complete index ships too, inside `<noscript>`: no covers, no filter,
 * no numbering, just every record reachable by name. It costs nothing to a
 * reader with scripting on — the element's contents are never parsed as
 * markup, no request is made from it, and it is not in the accessibility tree —
 * and it is about 6 KB over the wire compressed.
 *
 * The `<style>` above the list is the other half of that bargain. Without it a
 * reader with scripting off still met `ArchiveIndex`'s chrome: a search box
 * that filters nothing, seven category buttons that select nothing, and a
 * pager whose `?page=2` is served by the same prerendered file as page 1 — so
 * pressing it appeared to do nothing at all. Those are dead controls and a
 * link that lies about where it goes, which is what PERF-004's "without
 * harming URL navigation" rules out. The rule lives inside `<noscript>`
 * because that is the only place in HTML where "scripting is disabled" is a
 * fact the document can act on; a reader with scripting on never parses it.
 * The first page of rows is deliberately *not* hidden — those 24 links work
 * perfectly well without a client — so the archive stays complete either way.
 */
export function ArchiveFullIndex({
  entries,
  basePath,
  categorised = false,
  uncategorised = 'uncategorized',
  heading,
}: ArchiveFullIndexProps) {
  return (
    <noscript>
      <style dangerouslySetInnerHTML={{ __html: NO_JS_STYLE }} />
      <div className={styles.fullIndex}>
        <h2 className={styles.fullIndexHeading}>{heading}</h2>
        <p className={styles.fullIndexNote}>
          Filtering and paging need JavaScript. Every one of the{' '}
          {entries.length} records is listed here instead.
        </p>
        <ol className={styles.fullIndexList}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={
                  categorised
                    ? `${basePath}/${entry.category ?? uncategorised}/${entry.id}`
                    : `${basePath}/${entry.id}`
                }
              >
                {displayTitle(entry.title ?? entry.id)}
              </a>
              {entry.witness ? ` — ${displayWitness(entry.witness)}` : null}
            </li>
          ))}
        </ol>
      </div>
    </noscript>
  );
}
