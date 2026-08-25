'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './content.module.css';

export type SensitiveContentProps = {
  warning: string;
  children: ReactNode;
};

/**
 * Content behind an explicit reveal. Deliberately remembers nothing — no
 * storage, no cookie — so every reader makes the choice for themselves,
 * every visit.
 */
export function SensitiveContent({ warning, children }: SensitiveContentProps) {
  const [revealed, setRevealed] = useState(false);
  const regionId = useId();

  return (
    <div className={styles.sensitive}>
      {revealed ? (
        <div className={styles.sensitiveRevealed} id={regionId}>
          {children}
          <button
            type="button"
            className={styles.sensitiveButton}
            aria-expanded="true"
            aria-controls={regionId}
            onClick={() => setRevealed(false)}
          >
            Hide this material
          </button>
        </div>
      ) : (
        <div className={styles.sensitiveGate}>
          <p className={styles.sensitiveWarning}>{warning}</p>
          <button
            type="button"
            className={styles.sensitiveButton}
            aria-expanded="false"
            aria-controls={regionId}
            onClick={() => setRevealed(true)}
          >
            View — contains difficult material
          </button>
        </div>
      )}
    </div>
  );
}
