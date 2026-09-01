"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import { googleIdentityClientId, loadGoogleIdentity, signInWithGoogleCredential } from "@/components/auth/google-identity";
import styles from "../admin.module.css";

const auth = createAuthClient();

export function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  async function signInWithGoogle(credential: string) {
    setPending(true);
    setMessage(null);

    try {
      const callbackURL = new URL("/admin", window.location.origin).toString();
      await signInWithGoogleCredential(credential);

      window.location.assign(callbackURL);
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "ההתחברות עם Google נכשלה. נסה שוב.");
      setPending(false);
    }
  }

  useEffect(() => {
    const clientId = googleIdentityClientId();
    const host = googleButton.current;
    if (!clientId || !host) return;
    let cancelled = false;
    void loadGoogleIdentity().then((identity) => {
      if (cancelled || !googleButton.current) return;
      identity.initialize({ client_id: clientId, callback: ({ credential }) => {
        if (!credential) { setMessage("Google לא החזיר אישור התחברות."); return; }
        void signInWithGoogle(credential);
      } });
      googleButton.current.replaceChildren();
      identity.renderButton(googleButton.current, { theme: "outline", size: "large", text: "signin_with", width: 380, locale: "he" });
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "לא ניתן לטעון את Google."));
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const create = submitter?.value === "signup";

    try {
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
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "הכניסה נכשלה. נסה שוב.");
      setPending(false);
    }
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
      {googleIdentityClientId()
        ? <div ref={googleButton} aria-label="כניסה עם Google" />
        : <p className={styles.muted}>התחברות עם Google תופעל לאחר הגדרת מזהה הלקוח המאובטח שלה.</p>}
    </form>
  );
}
