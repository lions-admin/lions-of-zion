import type { CaseEntity } from '@/lib/content/fake-resistance-cases';
import styles from './content.module.css';

export type RosterTableProps = {
  entities: CaseEntity[];
  /** Column heading for the last column. Defaults to "Note". */
  noteLabel?: string;
};

/**
 * The roster of a case: who is in it, and how well each identity is known.
 *
 * The identity status is the point of this table, not decoration on it. The
 * research grades every entity `confirmed`, `probable` or `unresolved`, and
 * this site never upgrades that grade — an anonymous account whose operator
 * was not identified renders as unresolved here no matter how confident the
 * surrounding prose is about what the account does.
 *
 * The table scrolls inside its own container rather than widening the page:
 * the reading measure is fixed at 68ch and a table is not allowed to break it.
 */
const TYPE_LABEL: Record<CaseEntity['type'], string> = {
  person: 'Person',
  organization: 'Organization',
  account: 'Account',
};

const IDENTITY_LABEL: Record<CaseEntity['identityStatus'], string> = {
  confirmed: 'Confirmed',
  probable: 'Probable',
  unresolved: 'Unresolved',
};

const IDENTITY_EXPLANATION: Record<CaseEntity['identityStatus'], string> = {
  confirmed: 'Identity confirmed: established by multiple sources on the record.',
  probable: 'Identity probable: supported but not established — treated as provisional.',
  unresolved: 'Identity unresolved: the operator behind this account was not identified.',
};

export function RosterTable({ entities, noteLabel = 'Note' }: RosterTableProps) {
  if (entities.length === 0) return null;

  // The column only appears where the research actually measured reach, so a
  // roster of people and organisations does not carry an empty account column.
  const hasFollowers = entities.some((entity) => typeof entity.followers === 'number');

  return (
    <div className={styles.rosterScroll}>
      <table className={styles.roster}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Identity</th>
            {hasFollowers ? (
              <th scope="col" className={styles.rosterNumeric}>
                Followers
              </th>
            ) : null}
            <th scope="col">{noteLabel}</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => (
            <tr key={entity.id}>
              <th scope="row">
                <span className={styles.rosterName}>{entity.name}</span>
                {entity.handle ? (
                  <span className={styles.rosterHandle}>
                    {entity.handle.startsWith('@') ? entity.handle : `@${entity.handle}`}
                  </span>
                ) : null}
              </th>
              <td className={styles.rosterType}>{TYPE_LABEL[entity.type] ?? entity.type}</td>
              <td>
                <span
                  className={styles.identityChip}
                  data-identity={entity.identityStatus}
                  title={IDENTITY_EXPLANATION[entity.identityStatus]}
                >
                  {IDENTITY_LABEL[entity.identityStatus] ?? entity.identityStatus}
                </span>
              </td>
              {hasFollowers ? (
                <td className={styles.rosterNumeric}>
                  {typeof entity.followers === 'number'
                    ? entity.followers.toLocaleString('en-US')
                    : ''}
                </td>
              ) : null}
              <td className={styles.rosterNote}>{entity.note ?? entity.publicInterestBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
