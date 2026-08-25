import styles from './content.module.css';

export type Source = {
  id: string;
  label: string;
  kind?: string;
  url?: string;
  accessedAt?: string;
  archiveUrl?: string;
};

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
            {source.accessedAt || source.archiveUrl ? (
              <span className={styles.sourceFootnotes}>
                {source.accessedAt ? <time>Accessed {source.accessedAt}</time> : null}
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
