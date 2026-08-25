import type { ReactNode } from 'react';
import styles from './content.module.css';

export type ClaimRecordPairProps = {
  claim: ReactNode;
  record: ReactNode;
  claimLabel?: string;
  recordLabel?: string;
};

export function ClaimRecordPair({
  claim,
  record,
  claimLabel = 'The claim',
  recordLabel = 'The record',
}: ClaimRecordPairProps) {
  return (
    <div className={styles.claimRecord}>
      <section className={styles.claimPanel}>
        <h3>{claimLabel}</h3>
        <div className={styles.claimRecordBody}>{claim}</div>
      </section>
      <section className={styles.recordPanel}>
        <h3>{recordLabel}</h3>
        <div className={styles.claimRecordBody}>{record}</div>
      </section>
    </div>
  );
}
