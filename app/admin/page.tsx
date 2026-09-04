import Link from "next/link";
import { OperationsConsole } from "./OperationsConsole";
import { SignOutButton } from "./SignOutButton";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations console" };

export default function AdminPage() {
  return (
    /* The console reads in Hebrew, and says so on the element: it is the
       owner's own operating surface, not product chrome. The public site
       stays English — `tests/english-chrome.test.ts` still forbids Hebrew
       everywhere under `app/` and `components/` except `app/admin/**`, and
       still pins the root element at `lang="en"`.

       `dir="rtl"` belongs with `lang="he"` and not one commit later: a Hebrew
       page left in a left-to-right run puts every label on the wrong side of
       the thing it labels, which reads as a layout bug rather than as a
       missing attribute. `/admin/login` is deliberately left in English — a
       sign-in surface is read by whoever is locked out, and by a password
       manager, neither of which is having a good day already. */
    <main className={styles.shell} lang="he" dir="rtl" data-reading-scroll>
      <section className={styles.dashboard}>
        <div className={styles.dashboardHead}>
          <div>
            <p className={styles.eyebrow}>Lions of Zion / תפעול</p>
            <h1>קונסולת התפעול</h1>
            <p className={styles.lede}>
              להריץ את התהליך, לעקוב אחרי המקורות, לטפל בתור העריכה ולקרוא את הרישום של כל מה שקרה.
            </p>
          </div>
          {/* ADMIN-002. The console's two header controls, in one group laid
              out as a plain `row` with no `order` and no reversal, so the
              reading sequence — right to left under `dir="rtl"` — is the
              sequence Tab visits. Direction is a paint concern; DOM order,
              which is what Tab follows, is untouched by it. Session control
              belongs here, beside the identity it ends — `SignOutButton` was
              written for exactly this slot and then mounted nowhere, so the
              rebuilt console shipped with no way to sign out of it at all. */}
          <div className={styles.headActions}>
            <Link href="/pipeline" className={`${styles.secondary} ${styles.pipelineLink}`}>
              <span aria-hidden="true">⎋</span>
              <span>מפת ארכיטקטורת המערכת (Pipeline Visualizer)</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
        <OperationsConsole />
      </section>
    </main>
  );
}
