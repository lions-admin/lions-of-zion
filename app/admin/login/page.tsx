import { AdminLogin } from "./AdminLogin";
import styles from "../admin.module.css";

export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={styles.shell} data-reading-scroll>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Lions of Zion</p>
        <h1>כניסת מנהל</h1>
        <p className={styles.lede}>הגישה מוגבלת לכתובת המנהל היחידה שהוגדרה במערכת.</p>
        {error === "account_not_linked" ? <p className={styles.error}>חשבון Google עדיין לא מחובר לחשבון המנהל. יש להיכנס תחילה עם האימייל והסיסמה ולחבר אותו פעם אחת.</p> : null}
        <AdminLogin />
      </section>
    </main>
  );
}
