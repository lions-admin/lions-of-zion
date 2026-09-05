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
 * The account surface (AUTH-001, extended by AUTH-002).
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
 * The lede is deliberately narrow about what an account does. There is no
 * saving, no preferences and no library behind this sign-in, so the page does
 * not imply one; "knows you between visits" is the whole of it today.
 *
 * The sign-in controls are Google Identity Services and an X OAuth redirect
 * (`components/auth`), not a password form — there is no credential field on
 * this page for a password manager to fill, and none is added.
 *
 * `x_error` arrives here because `/auth/x/callback` sends a failed sign-in
 * back to this page rather than to a bare 400. It is read on the server and
 * passed down as a prop rather than read with `useSearchParams`, which would
 * put the whole control behind a Suspense boundary to keep the route
 * prerenderable. The value is an opaque marker from a closed set; the control
 * maps it to copy and never renders it.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ x_error?: string | string[] }>;
}) {
  const { x_error: marker } = await searchParams;
  const xError = Array.isArray(marker) ? marker[0] : marker;

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
        <PublicAuthControl xError={xError} />
      </section>
    </EditorialShell>
  );
}
