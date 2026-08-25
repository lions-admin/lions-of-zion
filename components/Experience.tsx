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
 * **This component is deliberately synchronous.** An `await` here puts the
 * route behind `app/loading.tsx`'s Suspense boundary, and without JavaScript
 * that fallback is never replaced — the whole page becomes the loading shell.
 * `lib/content/home.ts` resolves its editions at module scope for this reason.
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
