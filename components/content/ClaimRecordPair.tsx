import type { ReactNode } from 'react';
import { Prose } from '@/components/ui/Prose';
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
        <Prose size="small" className={styles.claimRecordBody}>
          {claim}
        </Prose>
      </section>
      <section className={styles.recordPanel}>
        <h3>{recordLabel}</h3>
        <Prose size="small" className={styles.claimRecordBody}>
          {record}
        </Prose>
      </section>
    </div>
  );
}
