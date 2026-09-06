import styles from './homepage-journey.module.css';

/**
 * The section's own copy calls this "one possible mechanism—not a measurement of
 * every narrative", so the drawing carries no scale, no units and no data: the
 * two curves are schematic and the axes are deliberately unlabelled.
 */
export function AmplificationFigure() {
  return (
    <figure className={styles.amplification}>
      <svg viewBox="0 0 1000 300" role="img" aria-labelledby="amp-title amp-desc" preserveAspectRatio="xMidYMid meet">
        <title id="amp-title">Repetition outpacing verification</title>
        <desc id="amp-desc">
          A schematic drawing. One line, marked repetition, rises steeply and early. A second
          broken line, marked checking, rises later and more slowly. The shaded interval between
          them is the period in which a claim can feel established while it is still unverified.
          The drawing carries no scale and represents no measurement.
        </desc>
        <g className={styles.ampTicks}>
          <path d="M200 60V262M430 60V262M660 60V262M890 60V262" />
        </g>
        <path className={styles.ampGap} d="M60 248C220 246 300 238 380 208C480 168 540 108 620 80C740 44 850 40 940 36L940 152C840 198 720 228 580 240C460 247 300 249 60 250Z" />
        <path className={styles.ampBase} d="M60 262H940" />
        <path className={styles.ampCheck} d="M60 250C300 249 460 247 580 240C720 228 840 198 940 152" />
        <path className={styles.ampRepeat} d="M60 248C220 246 300 238 380 208C480 168 540 108 620 80C740 44 850 40 940 36" />
        <circle className={styles.ampNode} cx="60" cy="249" r="5" />
        <circle className={styles.ampHead} cx="940" cy="36" r="6" />
        <circle className={styles.ampCheckHead} cx="940" cy="152" r="5" />
      </svg>
      <figcaption>
        Schematic only: repetition can climb while checking is still under way. No scale, no
        measurement, and not a reading of any particular narrative.
      </figcaption>
    </figure>
  );
}
