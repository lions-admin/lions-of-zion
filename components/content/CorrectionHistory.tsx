import styles from './content.module.css';

export type Correction = {
  date: string;
  note: string;
  version?: string;
};

export type CorrectionHistoryProps = {
  corrections: Correction[];
};

export function CorrectionHistory({ corrections }: CorrectionHistoryProps) {
  return (
    <div className={styles.corrections}>
      <span className={styles.correctionsKicker}>Correction history</span>
      {corrections.length ? (
        <ol>
          {corrections.map((correction) => (
            <li key={`${correction.date}-${correction.version ?? ''}`}>
              <span className={styles.correctionStamp}>
                <time>{correction.date}</time>
                {correction.version ? <small>{correction.version}</small> : null}
              </span>
              <p>{correction.note}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.correctionsEmpty}>None recorded</p>
      )}
    </div>
  );
}
