import Link from 'next/link';
import { getTechnique, techniqueHref } from '@/lib/content/fake-resistance-playbook';
import styles from './content.module.css';

export type TechniqueChipProps = {
  /** A member of the playbook's controlled vocabulary. */
  id: string;
};

/**
 * A link from an exhibit to the playbook chapter that explains the technique
 * it documents.
 *
 * The chip is the section's two-directional argument in one element: the case
 * file shows the move running, the chapter explains why it works. An unknown
 * id renders nothing rather than a dead link — the vocabulary is pinned by
 * `tests/fake-resistance-research.test.ts`, so a miss here means the test
 * caught it first.
 */
export function TechniqueChip({ id }: TechniqueChipProps) {
  const technique = getTechnique(id);
  if (!technique) return null;

  return (
    <Link className={styles.techniqueChip} href={techniqueHref(id)} title={technique.summary}>
      {technique.title}
    </Link>
  );
}

export function TechniqueChips({ ids }: { ids: string[] }) {
  const known = ids.filter((id) => getTechnique(id));
  if (known.length === 0) return null;

  return (
    <div className={styles.techniqueChips}>
      <span className={styles.techniqueChipsLabel}>Techniques</span>
      <div className={styles.techniqueChipsRow}>
        {known.map((id) => (
          <TechniqueChip key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
