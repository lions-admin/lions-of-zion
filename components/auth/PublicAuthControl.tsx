"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import styles from "./public-auth-control.module.css";

const auth = createAuthClient();

export function PublicAuthControl() {
  const session = auth.useSession();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userId = session.data?.user?.id;

  useEffect(() => {
    if (!userId) return;
    void fetch("/api/public-auth/sync", { method: "POST" });
  }, [userId]);

  async function signIn() {
    setPending(true);
    setMessage(null);
    const result = await auth.signIn.social({ provider: "google", callbackURL: "/account" });
    if (result.error) {
      setMessage(result.error.message || "ההתחברות נכשלה. נסה שוב.");
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setMessage(null);
    const result = await auth.signOut();
    if (result.error) {
      setMessage(result.error.message || "היציאה נכשלה. נסה שוב.");
      setPending(false);
    }
  }

  if (session.isPending) return <p className={styles.muted}>טוען התחברות…</p>;

  if (session.data?.user) {
    return (
      <div className={styles.control}>
        <p className={styles.identity}>
          מחובר כ־{session.data.user.name || session.data.user.email}
        </p>
        <button className={styles.secondary} type="button" onClick={signOut} disabled={pending}>
          {pending ? "יוצא…" : "יציאה"}
        </button>
        {message && <p className={styles.error} role="alert">{message}</p>}
      </div>
    );
  }

  return (
    <div className={styles.control}>
      <button className={styles.primary} type="button" onClick={signIn} disabled={pending}>
        {pending ? "מעביר ל־Google…" : "כניסה עם Google"}
      </button>
      {message && <p className={styles.error} role="alert">{message}</p>}
    </div>
  );
}
