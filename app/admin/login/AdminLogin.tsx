"use client";

import { useState, type FormEvent } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import styles from "../admin.module.css";

const auth = createAuthClient();

export function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setPending(true);
    setMessage(null);

    try {
      const result = await auth.signIn.social({ provider: "google", callbackURL: "/admin" });

      if (result.error) {
        setMessage(result.error.message || "ההתחברות עם Google נכשלה. נסה שוב.");
        setPending(false);
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "ההתחברות עם Google נכשלה. נסה שוב.");
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const create = submitter?.value === "signup";

    const result = create
      ? await auth.signUp.email({ email, password, name: "Lions of Zion Admin" })
      : await auth.signIn.email({ email, password });

    if (result.error) {
      setMessage(result.error.message || "הכניסה נכשלה. בדוק את הפרטים ונסה שוב.");
      setPending(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        כתובת אימייל
        <input name="email" type="email" autoComplete="email" required dir="ltr" />
      </label>
      <label>
        סיסמה
        <input name="password" type="password" autoComplete="current-password" minLength={8} required dir="ltr" />
      </label>
      {message && <p className={styles.error} role="alert">{message}</p>}
      <button className={styles.primary} disabled={pending} type="submit" value="signin">
        {pending ? "מתחבר…" : "כניסה"}
      </button>
      <button className={styles.secondary} disabled={pending} type="submit" value="signup">
        יצירת חשבון מנהל ראשוני
      </button>
      <button className={styles.secondary} disabled={pending} type="button" onClick={signInWithGoogle}>
        {pending ? "מעביר ל-Google…" : "כניסה עם Google"}
      </button>
    </form>
  );
}
