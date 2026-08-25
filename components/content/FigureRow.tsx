import styles from './content.module.css';

export type Figure = {
  value: string;
  label: string;
};

export type FigureRowProps = {
  figures: Figure[];
};

export function FigureRow({ figures }: FigureRowProps) {
  if (!figures.length) return null;

  return (
    <dl className={styles.figures}>
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt>{figure.value}</dt>
          <dd>{figure.label}</dd>
        </div>
      ))}
    </dl>
  );
}
