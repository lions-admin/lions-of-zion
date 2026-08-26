import { AdminStatus } from "./AdminStatus";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Infrastructure status" };

export default function AdminPage() {
  return (
    <main className={styles.shell} data-reading-scroll>
      <section className={styles.dashboard}>
        <p className={styles.eyebrow}>Lions of Zion / Operations</p>
        <h1>מצב המערכות</h1>
        <p className={styles.lede}>תצוגת מצב בסיסית לשירותי ההשקה ב־Vercel.</p>
        <AdminStatus />
      </section>
    </main>
  );
}
