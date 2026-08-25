import styles from './styles.module.css';

/**
 * The scene's identity mark.
 *
 * This layer used to carry three more things: a latest-brief card, an intent
 * legend, and a full static editorial index for phones. All three moved into
 * the front-page band below the scene (`components/home/HomeFrontPage.tsx`),
 * because the home route now continues below the fold:
 *
 *   - the brief card would otherwise put the same brief on screen twice;
 *   - the legend sat exactly where the band's anchored strip now sits, and
 *     at 0.53rem it was one of the review's findings on its own;
 *   - the static index existed only for the no-JS/no-GPU tier, and the band
 *     is server-rendered for every tier — one index instead of a fallback
 *     copy that could drift from it.
 *
 * What is left is the wordmark over the scene, in the scene's own voice.
 * Cinzel belongs here and nowhere else.
 */
export function HomeSignalLayer() {
  return (
    <div className={styles.desktopOrientation}>
      <header className={styles.desktopBrand}>
        <span className={styles.brandKicker}>Independent evidence network</span>
        <strong>Lions of Zion</strong>
        <p>Truth has a signal.</p>
      </header>
    </div>
  );
}
