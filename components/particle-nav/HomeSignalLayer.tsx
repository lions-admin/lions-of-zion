import styles from './styles.module.css';

/**
 * The scene's identity mark, plus the phone's route into the front page.
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
 *
 * The kicker above it used to read "Independent evidence network" — byte for
 * byte the band masthead's kicker, in the same size, one screen apart on
 * desktop. The band owns that framing now; the scene reads wordmark plus its
 * own line.
 *
 * The scroll cue is the phone half of the same layer. The band's anchored
 * strip only overlaps into the scene's bottom margin at ≥720×640, so below
 * either bound the "The front page ↓" signpost sits exactly at 100dvh with
 * nothing peeking. This is that signpost, inside the scene box, in the gap
 * the orbit already reserves above the chat dock — so it costs no orbit
 * radius, which the `bottomReservePx` route would have.
 */
export function HomeSignalLayer() {
  return (
    <div className={styles.desktopOrientation}>
      <header className={styles.desktopBrand}>
        <strong>Lions of Zion</strong>
        <p>Truth has a signal.</p>
      </header>
      <a className={styles.scrollCue} href="#home-masthead">
        The front page
        <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
