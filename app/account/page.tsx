import type { Metadata } from "next";
import { EditorialShell } from "@/components/site/EditorialShell";
import { PublicAuthControl } from "@/components/auth/PublicAuthControl";
import styles from "./account.module.css";

const LEDE =
  "Signing in is how the desk knows you between visits. It is optional: everything published here is readable without an account.";

export const metadata: Metadata = {
  title: "Account",
  description: LEDE,
};

/**
 * The account surface (AUTH-001).
 *
 * It used to render its own shell — `SiteHeader` dropped into a bespoke
 * `<main>`, no skip link, no footer, no banner/contentinfo landmarks — and a
 * glass card with a 16px backdrop blur, which is not a thing this design
 * system has. It now wears `EditorialShell` like every other institution page,
 * so the chrome, the landmarks, the family density and the way out are the
 * same ones the rest of the site uses, and the page itself is one plain panel
 * on the black ground.
 *
 * `showProgress={false}`: reading progress measures how far down a document a
 * reader is, and this is not a document. There is nothing to be a third of the
 * way through.
 *
 * The sign-in control is Google Identity Services (`components/auth`), not a
 * password form — there is no credential field on this page for a password
 * manager to fill, and none is added. What the states have to do instead is
 * say plainly which of the four they are in, which is `PublicAuthControl`'s
 * job.
 */
export default function AccountPage() {
  return (
    <EditorialShell
      routeId="account"
      showProgress={false}
      className={styles.page}
    >
      <section className={styles.panel} id="page-content" aria-labelledby="account-title">
        <p className={styles.eyebrow}>Lions of Zion</p>
        <h1 id="account-title" className={styles.title}>
          Account
        </h1>
        <p className={styles.lede}>{LEDE}</p>
        <PublicAuthControl />
      </section>
    </EditorialShell>
  );
}
