import styles from './content.module.css';

export type KnownUnknownPanelProps = {
  unknowns: string[];
  wouldChange?: string[];
};

export function KnownUnknownPanel({ unknowns, wouldChange }: KnownUnknownPanelProps) {
  const hasSecondColumn = Boolean(wouldChange?.length);

  return (
    <div className={styles.unknownGrid} data-single={hasSecondColumn ? undefined : 'true'}>
      <div>
        <h3>Not established</h3>
        <ul>
          {unknowns.map((unknown) => (
            <li key={unknown}>{unknown}</li>
          ))}
        </ul>
      </div>
      {hasSecondColumn ? (
        <div>
          <h3>What would change the assessment</h3>
          <ul>
            {wouldChange!.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
