import Link from "next/link";
import { AdminStatus } from "./AdminStatus";
import { PublicationManager } from "./PublicationManager";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Infrastructure status" };

export default function AdminPage() {
  return (
    <main className={styles.shell} data-reading-scroll>
      <section className={styles.dashboard}>
        <div className={styles.dashboardHead}>
          <div>
            <p className={styles.eyebrow}>Lions of Zion / Operations</p>
            <h1>מצב המערכות</h1>
            <p className={styles.lede}>תצוגת מצב בסיסית לשירותי ההשקה ב־Vercel.</p>
          </div>
          <Link href="/pipeline" className={`${styles.secondary} ${styles.pipelineLink}`}>
            <span aria-hidden="true">⎋</span>
            <span>הדמיית צינור המערכת החיה (Pipeline Visualizer)</span>
          </Link>
        </div>
        <AdminStatus />
        <PublicationManager />
      </section>
    </main>
  );
}
