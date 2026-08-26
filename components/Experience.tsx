import { ParticleNav } from "@/components/particle-nav";
import { defaultNodes } from "@/components/particle-nav/config";
import { HomeFrontPage } from "@/components/home/HomeFrontPage";
import {
  getLatestMilestone,
  getRecentMilestones,
  getTrustStrip,
} from "@/lib/content/home";
import styles from "@/components/home/home.module.css";

/**
 * The home route: one particle scene, then the front page.
 *
 * One canvas owns both acts of the scene. The same WebGPU/TSL lion assembles
 * for the story, relocates, and remains as the centre of the network
 * navigation. Real links stay server-rendered for accessibility and the
 * no-JavaScript path.
 *
 * Below it, the document continues. The scene keeps the exact box it always
 * had — `position: fixed; inset: 0` — and the band scrolls over it, because
 * the particle composition is solved against that box and shrinking it would
 * shrink the whole scene rather than reflow it (`home.module.css`).
 *
 * Both live inside one `<main>`: `ParticleChatLauncher` marks `main` inert
 * while the chat is open, and splitting them would leave the orbit's links
 * focusable behind the modal.
 *
 * **This component is synchronous.** It had to be while a root-level
 * `app/loading.tsx` existed: an `await` here put the route behind its Suspense
 * boundary, and with no JavaScript that fallback was never replaced, so the
 * whole page rendered as the loading shell. That file is deleted now, so the
 * constraint no longer binds — this stays synchronous because nothing needs it
 * to change. Re-check the no-JavaScript render before introducing an `await`.
 */
export default function Experience() {
  return (
    <main className={styles.home}>
      <div className={styles.scene}>
        <ParticleNav nodes={defaultNodes} intro />
      </div>
      <div className={styles.heroSpacer} aria-hidden="true" />
      <HomeFrontPage
        latest={getLatestMilestone()}
        recent={getRecentMilestones(6)}
        trustStrip={getTrustStrip()}
      />
    </main>
  );
}
