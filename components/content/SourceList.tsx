import styles from './content.module.css';

export type Source = {
  id: string;
  label: string;
  kind?: string;
  url?: string;
  accessedAt?: string;
  /** ISO stamp of when the data behind this source was pulled. */
  retrievedAt?: string;
  archiveUrl?: string;
};

/**
 * "Retrieved Aug 26, 2026" from the ISO stamp the research recorded.
 *
 * Rendered only for a source with no URL — an attribution kept as text
 * because its address was an API endpoint no reader could ever open, or a
 * finding about an aggregate sample no single link could honestly stand for.
 * With nothing to click, *when* the data was pulled is the provenance a
 * reader still gets (TODOS-review R-09, owner ruling 2026-08-27).
 */
function retrievedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export type SourceListProps = {
  sources: Source[];
};

export function SourceList({ sources }: SourceListProps) {
  if (!sources.length) return null;

  return (
    <ol className={styles.sourceList}>
      {sources.map((source, index) => (
        <li key={source.id}>
          <span className={styles.sourceNumber} aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className={styles.sourceBody}>
            {source.kind ? <span className={styles.sourceKind}>{source.kind}</span> : null}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className={styles.sourceLabel}>{source.label}</span>
            )}
            {source.accessedAt || source.archiveUrl || (!source.url && source.retrievedAt) ? (
              <span className={styles.sourceFootnotes}>
                {source.accessedAt ? <time>Accessed {source.accessedAt}</time> : null}
                {!source.url && source.retrievedAt ? (
                  <time dateTime={source.retrievedAt}>
                    Retrieved {retrievedLabel(source.retrievedAt)}
                  </time>
                ) : null}
                {source.archiveUrl ? (
                  <a
                    className={styles.archiveLink}
                    href={source.archiveUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Archived copy <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
