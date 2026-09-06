import type { CaseStats } from '@/lib/content/fake-resistance-cases';
import styles from './research.module.css';

/**
 * What was checked, beside what was found.
 *
 * A case page opens with a finding, and a reader's next question is always the
 * same one: how much was looked at before that was said. This strip answers it
 * in the first screen — sample size and window, how many of the accounts were
 * controls, how many sources across how many independent groups, how the
 * findings fared against outside checking, and how much of the sample carries
 * a Community Note.
 *
 * Two of these numbers are here specifically because the research's earlier
 * pass got them wrong. The control count is one: the plan makes matched
 * controls mandatory because an anomaly measured without them is not
 * interpretable, and the first version of these cases had none. The sample
 * size is the other: the headline statistics of the 26-Aug pass were computed
 * from a single unpaginated page of 20 posts per account.
 *
 * The Community Notes line says *contested*, never *false*. A note is a
 * platform signal that other readers disputed the item; the research treats it
 * as evidence of contest, and so does this.
 */
export function EvidenceStrip({ stats }: { stats: CaseStats }) {
  const { corroboration, communityNotes, window } = stats;
  const corroborated = corroboration.corroborated ?? 0;
  const contradicted = corroboration.contradicted ?? 0;
  const notAddressed = corroboration['not-addressed-externally'] ?? 0;

  return (
    <dl className={styles.strip}>
      <div className={styles.stripItem}>
        <dt>Posts sampled</dt>
        <dd>
          <b>{stats.sampled.toLocaleString('en')}</b>
          {window ? (
            <span>
              posted between {formatDay(window.start)} and {formatDay(window.end)}
            </span>
          ) : null}
        </dd>
      </div>

      <div className={styles.stripItem}>
        <dt>Accounts</dt>
        <dd>
          <b>{stats.subjectAccounts}</b>
          <span>
            {stats.controlAccounts > 0
              ? `plus ${stats.controlAccounts} control ${
                  stats.controlAccounts === 1 ? 'account' : 'accounts'
                }, harvested identically`
              : 'no control accounts in this packet'}
          </span>
        </dd>
      </div>

      <div className={styles.stripItem}>
        <dt>Sources</dt>
        <dd>
          <b>{stats.sources}</b>
          <span>
            across {stats.independenceGroups} independent{' '}
            {stats.independenceGroups === 1 ? 'group' : 'groups'}
          </span>
        </dd>
      </div>

      <div className={styles.stripItem}>
        <dt>Checked outside this file</dt>
        <dd>
          <b>
            {corroborated}
            <span className={styles.stripOf}>
              /{corroborated + contradicted + notAddressed}
            </span>
          </b>
          <span>
            findings corroborated
            {contradicted > 0 ? `, ${contradicted} contradicted` : ''}
            {notAddressed > 0 ? `, ${notAddressed} not addressed` : ''}
          </span>
        </dd>
      </div>

      <div className={styles.stripItem}>
        <dt>Community Notes</dt>
        <dd>
          <b>{communityNotes.withNote.toLocaleString('en')}</b>
          <span>
            sampled posts carry a note
            {communityNotes.helpful > 0
              ? `, ${communityNotes.helpful} rated helpful`
              : ''}{' '}
            — a note marks contested content, not false content
          </span>
        </dd>
      </div>
    </dl>
  );
}

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}
