import { AdminLogin } from "./AdminLogin";
import styles from "../admin.module.css";

export const metadata = { title: "Operator sign-in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    /* The document is already `lang="en"` at the root. Stating it here as
       well is the guarantee for a surface that must stay English chrome
       whatever a future locale wrapper does to the pages around it. The
       shell centres the card — see `.loginShell` in admin.module.css. */
    <main className={`${styles.shell} ${styles.loginShell}`} lang="en" data-reading-scroll>
      <section className={styles.card} aria-labelledby="signin-heading">
        <p className={styles.eyebrow}>Lions of Zion / Operations</p>
        <h1 id="signin-heading">Operator sign-in</h1>
        <p className={styles.lede}>
          The operations console controls collection, the daily briefing pipeline, and what is
          published. Access is limited to the single administrator address configured for this
          deployment.
        </p>
        {error === "account_not_linked" ? (
          <p className={styles.warnNote}>
            This Google account is not linked to the administrator account yet. Sign in once with
            the email address and password below; the Google account links itself to it.
          </p>
        ) : null}
        <AdminLogin />
      </section>
    </main>
  );
}
