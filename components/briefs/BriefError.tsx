import Link from 'next/link';
import styles from './geopolitical-brief.module.css';

/**
 * The brief today renders one hardcoded local module synchronously — there
 * is no real async fetch to `published-items` yet, so there is no live
 * failure path this component answers. It exists so that whenever the brief
 * is wired to a real fetch, the error state doesn't have to be designed
 * from scratch under pressure. Do not render this from a fabricated or
 * simulated failure just to exercise it — wire it to a real fetch's actual
 * catch block when that fetch exists, not before.
 */
export function BriefError() {
  return (
    <div className={styles.briefError} role="alert">
      <p className={styles.briefErrorTitle}>The brief couldn’t be loaded.</p>
      <p>
        Try reloading the page. If this keeps happening,{' '}
        <Link href="/">return to the scan</Link> and try again from there.
      </p>
    </div>
  );
}
