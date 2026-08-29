import type { Metadata } from "next";
import { PublicAuthControl } from "@/components/auth/PublicAuthControl";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "./account.module.css";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in to your Lions of Zion account.",
};

export default function AccountPage() {
  return (
    <main className={styles.shell} data-reading-scroll>
      <SiteHeader />
      <section className={styles.card}>
        <p className={styles.eyebrow}>Lions of Zion</p>
        <h1>אזור משתמשים</h1>
        <p className={styles.lede}>התחבר כדי לשמור את הגישה שלך ולחזור בקלות.</p>
        <PublicAuthControl />
      </section>
    </main>
  );
}
