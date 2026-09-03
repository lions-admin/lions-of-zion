import Link from "next/link";
import { AdminStatus } from "./AdminStatus";
import { PublicationManager } from "./PublicationManager";
import { SignOutButton } from "./SignOutButton";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Infrastructure status" };

export default function AdminPage() {
  return (
    /* The console is operator chrome and stays English whatever a future
       locale wrapper does to the pages around it — the same guarantee
       `/admin/login` already states for the sign-in surface. */
    <main className={styles.shell} lang="en" data-reading-scroll>
      <section className={styles.dashboard}>
        <div className={styles.dashboardHead}>
          <div>
            <p className={styles.eyebrow}>Lions of Zion / Operations</p>
            <h1>System status</h1>
            <p className={styles.lede}>A basic status view of the launch services on Vercel.</p>
          </div>
          {/* ADMIN-002. The console's two header controls, in one group laid
              out as a plain `row` with no `order` and no reversal, so the
              left-to-right sequence a reader sees is the sequence Tab visits.
              Session control belongs here, beside the identity it ends —
              `SignOutButton` was written for exactly this slot and then
              mounted nowhere, so the rebuilt console shipped with no way to
              sign out of it at all. */}
          <div className={styles.headActions}>
            <Link href="/pipeline" className={`${styles.secondary} ${styles.pipelineLink}`}>
              <span aria-hidden="true">⎋</span>
              <span>System architecture map (Pipeline Visualizer)</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
        <AdminStatus />
        <PublicationManager />
      </section>
    </main>
  );
}
