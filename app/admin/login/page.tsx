import { AdminLogin } from "./AdminLogin";
import styles from "../admin.module.css";

export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={styles.shell} data-reading-scroll>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Lions of Zion</p>
        <h1>Admin sign in</h1>
        <p className={styles.lede}>Access is limited to the single admin address configured on this system.</p>
        {error === "account_not_linked" ? <p className={styles.error}>This Google account is not yet linked to the admin account. Sign in with email and password once to connect it.</p> : null}
        <AdminLogin />
      </section>
    </main>
  );
}
