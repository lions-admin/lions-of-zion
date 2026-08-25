import styles from './content.module.css';

export type PublicationMetaProps = {
  publishedAt?: string;
  updatedAt?: string;
  reviewedBy?: string;
  sourceCount?: number;
  edition?: string;
};

export function PublicationMeta({
  publishedAt,
  updatedAt,
  reviewedBy,
  sourceCount,
  edition,
}: PublicationMetaProps) {
  const entries: { term: string; detail: string }[] = [];
  if (edition) entries.push({ term: 'Edition', detail: edition });
  if (publishedAt) entries.push({ term: 'Published', detail: publishedAt });
  if (updatedAt) entries.push({ term: 'Updated', detail: updatedAt });
  if (reviewedBy) entries.push({ term: 'Reviewed by', detail: reviewedBy });
  if (sourceCount !== undefined) {
    entries.push({
      term: 'Source stack',
      detail: `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`,
    });
  }

  if (!entries.length) return null;

  return (
    <dl className={styles.publicationMeta}>
      {entries.map((entry) => (
        <div key={entry.term}>
          <dt>{entry.term}</dt>
          <dd>{entry.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
