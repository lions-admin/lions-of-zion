import { AdminLogin } from "./AdminLogin";
import styles from "../admin.module.css";

export const metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return (
    <main className={styles.shell} data-reading-scroll>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Lions of Zion</p>
        <h1>כניסת מנהל</h1>
        <p className={styles.lede}>הגישה מוגבלת לכתובת המנהל היחידה שהוגדרה במערכת.</p>
        <AdminLogin />
      </section>
    </main>
  );
}
