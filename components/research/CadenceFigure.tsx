import type { CadenceDay, CaseStats } from '@/lib/content/fake-resistance-cases';
import styles from './research.module.css';

/**
 * When the accounts actually posted — subjects against their controls.
 *
 * The bars are deterministic SVG computed on the server from
 * `content_items.csv`; there is no chart library here and no client
 * JavaScript. Below the figure the same numbers render as a table, which is
 * the accessible form and also the mobile form.
 *
 * ## Why controls are drawn at all
 *
 * A subject's posting volume on its own says nothing. Every one of these
 * accounts posts in bursts around news events, and so does every ordinary news
 * account — which is exactly why the research's earlier "70% same-hour"
 * statistic was worthless. Drawing the matched control group in the same
 * frame is what makes a burst legible as either unusual or ordinary, and it is
 * the reason the plan makes controls mandatory.
 *
 * Controls are drawn hollow and subjects solid, following the section's rule
 * that weight of ink tracks strength of claim. They are two different
 * populations, not two categories of the same one, so they are stacked in
 * separate registers rather than summed into one bar.
 *
 * ## Why the default window is narrow
 *
 * Several packets carry historical items going back years — an account
 * creation date, a pre-window exhibit — so the full series is mostly empty
 * with a dense recent block. Drawing all of it would render the block one
 * pixel wide. The figure shows the densest recent stretch by default and says
 * in words what it left out.
 */
const DEFAULT_DAYS = 60;

export function CadenceFigure({
  stats,
  caption,
}: {
  stats: CaseStats;
  caption?: string;
}) {
  const all = stats.cadence.days;
  if (all.length === 0) return null;

  const days = all.slice(-DEFAULT_DAYS);
  const omitted = all.length - days.length;
  const peak = Math.max(1, ...days.map((d) => Math.max(d.subjects, d.controls)));
  const anyControls = days.some((d) => d.controls > 0);

  const width = 720;
  const height = 150;
  const axis = height / 2;
  const slot = width / days.length;
  const barWidth = Math.max(1, Math.min(10, slot - 1));

  const scale = (value: number) => (value / peak) * (axis - 12);

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.cadence}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Posts per day over ${days.length} days. Subject accounts peak at ${peak} posts in a day.${
          anyControls ? ' Control accounts are drawn below the axis.' : ''
        }`}
        preserveAspectRatio="none"
      >
        {days.map((day, i) => {
          const x = i * slot + (slot - barWidth) / 2;
          const up = scale(day.subjects);
          const down = scale(day.controls);
          return (
            <g key={day.date}>
              {day.subjects > 0 ? (
                <rect
                  className={styles.barSubject}
                  x={x}
                  y={axis - up}
                  width={barWidth}
                  height={up}
                />
              ) : null}
              {day.controls > 0 ? (
                <rect
                  className={styles.barControl}
                  x={x}
                  y={axis}
                  width={barWidth}
                  height={down}
                />
              ) : null}
            </g>
          );
        })}
        <line className={styles.cadenceAxis} x1={0} y1={axis} x2={width} y2={axis} />
      </svg>

      <div className={styles.cadenceScale} aria-hidden="true">
        <span>{formatDay(days[0].date)}</span>
        <span>peak {peak.toLocaleString('en')} posts/day</span>
        <span>{formatDay(days[days.length - 1].date)}</span>
      </div>

      <ul className={styles.legend}>
        <li>
          <span className={`${styles.swatch} ${styles.swatchSubject}`} aria-hidden="true" />
          Subject accounts, above the line
        </li>
        {anyControls ? (
          <li>
            <span className={`${styles.swatch} ${styles.swatchControl}`} aria-hidden="true" />
            Control accounts, below it — harvested the same way, over the same window
          </li>
        ) : null}
      </ul>

      <figcaption className={styles.caption}>
        {caption ??
          'Posts per day in the harvested sample. The control accounts are a matched comparison group: a burst only means something if it does not appear in them too.'}{' '}
        {omitted > 0 ? (
          <>
            The series shown is the last {days.length} days; {omitted.toLocaleString('en')}{' '}
            earlier days in the packet carry scattered historical items and are left out of
            the drawing, not out of the data.
          </>
        ) : null}{' '}
        {stats.cadence.undated > 0 ? (
          <>
            {stats.cadence.undated.toLocaleString('en')} sampled{' '}
            {stats.cadence.undated === 1 ? 'item carries' : 'items carry'} no usable timestamp
            and {stats.cadence.undated === 1 ? 'is' : 'are'} counted nowhere on this figure.
          </>
        ) : null}
      </figcaption>

      <details className={styles.dataFallback}>
        <summary>The same figure as numbers</summary>
        <table className={styles.dataTable}>
          <caption>Posts per day, subjects and controls</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Subjects</th>
              <th scope="col">Controls</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day: CadenceDay) => (
              <tr key={day.date}>
                <th scope="row">{formatDay(day.date)}</th>
                <td>{day.subjects.toLocaleString('en')}</td>
                <td>{day.controls.toLocaleString('en')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
