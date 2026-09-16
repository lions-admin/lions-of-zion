import styles from './content.module.css';

export type PublicationMetaProps = {
  publishedAt?: string;
  updatedAt?: string;
  coverageWindow?: string;
  reviewedBy?: string;
  sourceCount?: number;
  edition?: string;
  /** How the record reached the reader — see `publicationProvenance`. */
  authorship?: string;
};

export function PublicationMeta({
  publishedAt,
  updatedAt,
  coverageWindow,
  reviewedBy,
  sourceCount,
  edition,
  authorship,
}: PublicationMetaProps) {
  /* THE REGISTER, PER ROW (2026-09-16).
     The term is always a word a person wrote, so it is always the kicker
     role. The *value* is not always the same kind of thing, and until now
     every one of them was set in the text face: a date, an edition id and a
     source count are machine values and belong in the data face, while
     "Written by" and "Reviewed by" are sentences about people and do not.
     One flag per row rather than a rule per term, so a row added later has to
     answer the question. */
  const entries: { term: string; detail: string; machine: boolean }[] = [];
  if (edition) entries.push({ term: 'Edition', detail: edition, machine: true });
  /* Ahead of the dates, because who wrote a record governs how a reader should
     read its dates — VA-47. */
  if (authorship) entries.push({ term: 'Written by', detail: authorship, machine: false });
  if (publishedAt) entries.push({ term: 'Published', detail: publishedAt, machine: true });
  if (updatedAt) entries.push({ term: 'Updated', detail: updatedAt, machine: true });
  if (coverageWindow) entries.push({ term: 'Coverage window', detail: coverageWindow, machine: true });
  if (reviewedBy) entries.push({ term: 'Reviewed by', detail: reviewedBy, machine: false });
  if (sourceCount !== undefined) {
    entries.push({
      term: 'Sources',
      detail: `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`,
      machine: true,
    });
  }

  if (!entries.length) return null;

  return (
    <dl className={styles.publicationMeta}>
      {entries.map((entry) => (
        <div key={entry.term}>
          <dt>{entry.term}</dt>
          <dd data-register={entry.machine ? 'data' : 'text'}>{entry.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
