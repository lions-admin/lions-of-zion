import type { CaseStats, SynchronyPair } from '@/lib/content/fake-resistance-cases';
import styles from './research.module.css';

/**
 * How long an account waits before amplifying another — and whether that wait
 * means anything.
 *
 * This figure exists to replace a specific bad statistic. The programme's
 * first pass reported that "70% of output was same-hour amplification" and
 * treated the number as evidence of coordination. It was computed from a
 * single unpaginated page per account, against no null model at all, and two
 * independent news accounts covering the same event would have produced it
 * just as readily.
 *
 * So every row here carries three things the old number lacked: the null model
 * the lag was tested against, the p-value that came back, and the sample size.
 * A pair that did not clear α = 0.05 is drawn hollow and labelled *not
 * distinguishable from chance* rather than dropped — a figure that shows only
 * the survivors of a significance filter is a figure that cannot be argued
 * with.
 *
 * The caption carries the denominator for the same reason. A case that tested
 * 465 pairs expects around 23 to clear α = 0.05 by chance alone, and one of
 * these cases makes exactly that argument against reading its own temporal
 * edges as coordination. Without the count of tests, the count of survivors
 * is unreadable.
 *
 * The axis is logarithmic because the measured lags run from seconds to days,
 * and a linear axis would collapse every interesting result into the first
 * pixel.
 */
const SECOND = 1;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const TICKS = [
  { at: SECOND, label: '1s' },
  { at: MINUTE, label: '1m' },
  { at: 10 * MINUTE, label: '10m' },
  { at: HOUR, label: '1h' },
  { at: 12 * HOUR, label: '12h' },
  { at: DAY, label: '1d' },
];
const MIN = SECOND;
const MAX = 3 * DAY;

export function LagFigure({ stats }: { stats: CaseStats }) {
  const rows = stats.synchrony.pairs.filter((p) => typeof p.medianSeconds === 'number');
  if (rows.length === 0) return null;

  const position = (seconds: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, seconds || MIN));
    return (Math.log(clamped) - Math.log(MIN)) / (Math.log(MAX) - Math.log(MIN));
  };

  return (
    <figure className={styles.figure}>
      <ol className={styles.lagRows}>
        {rows.map((pair) => (
          <LagRow key={`${pair.a}|${pair.b}`} pair={pair} position={position} />
        ))}
      </ol>

      <div className={styles.lagAxis} aria-hidden="true">
        {TICKS.map((tick) => (
          <span key={tick.label} style={{ left: `${position(tick.at) * 100}%` }}>
            {tick.label}
          </span>
        ))}
      </div>

      <figcaption className={styles.caption}>
        Median delay between one account posting and the other following, with the
        interquartile range as the bar. Tested against{' '}
        {rows[0]?.nullModel
          ? rows[0].nullModel.replace(/,\s*pooled$/, '')
          : 'a permutation null model'}
        . This case tested {stats.synchrony.pairsTested.toLocaleString('en')} account pairs
        and {stats.synchrony.significantPairs} cleared p &lt; 0.05; at that threshold
        roughly {stats.synchrony.expectedByChance} would clear it by chance alone, so a
        significant pair here is a lead to check, not a finding on its own.{' '}
        {stats.synchrony.caveat ? stats.synchrony.caveat : null}
      </figcaption>

      <details className={styles.dataFallback}>
        <summary>The same figure as numbers</summary>
        <table className={styles.dataTable}>
          <caption>Measured lag per account pair</caption>
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col">Median</th>
              <th scope="col">Within 60s</th>
              <th scope="col">p</th>
              <th scope="col">n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pair) => (
              <tr key={`${pair.a}|${pair.b}`}>
                <th scope="row">
                  {pair.a} → {pair.b}
                </th>
                <td>{formatDuration(pair.medianSeconds ?? 0)}</td>
                <td>{formatPercent(pair.frac60)}</td>
                <td>{formatP(pair.pValue)}</td>
                <td>{pair.n.toLocaleString('en')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function LagRow({
  pair,
  position,
}: {
  pair: SynchronyPair;
  position: (seconds: number) => number;
}) {
  const median = pair.medianSeconds ?? 0;
  const significant = (pair.pValue ?? 1) < 0.05;
  const low = Math.max(MIN, median - (pair.iqrSeconds ?? 0) / 2);
  const high = Math.max(low, median + (pair.iqrSeconds ?? 0) / 2);
  const left = position(low);
  const right = position(high);

  return (
    <li className={significant ? styles.lagRow : `${styles.lagRow} ${styles.lagRowWeak}`}>
      <span className={styles.lagPair}>
        {pair.a} <span aria-hidden="true">→</span> {pair.b}
      </span>
      <span className={styles.lagTrack}>
        <span
          className={styles.lagBar}
          style={{ left: `${left * 100}%`, width: `${Math.max(0.6, (right - left) * 100)}%` }}
        />
        <span className={styles.lagDot} style={{ left: `${position(median) * 100}%` }} />
      </span>
      <span className={styles.lagStats}>
        <b>{formatDuration(median)}</b>
        <span>
          {significant ? `p ${formatP(pair.pValue)}` : 'not distinguishable from chance'} · n{' '}
          {pair.n.toLocaleString('en')}
          {pair.precise ? ' · measured pair by pair' : ''}
        </span>
      </span>
    </li>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 90 * MINUTE) return `${Math.round(seconds / MINUTE)}m`;
  if (seconds < 36 * HOUR) return `${(seconds / HOUR).toFixed(1)}h`;
  return `${(seconds / DAY).toFixed(1)}d`;
}

function formatPercent(value?: number) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
}

function formatP(value?: number) {
  if (typeof value !== 'number') return '—';
  if (value < 0.0001) return '< 0.0001';
  return `= ${value.toPrecision(2)}`;
}
