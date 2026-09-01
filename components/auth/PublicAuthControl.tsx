"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { googleIdentityClientId, loadGoogleIdentity, signInWithGoogleCredential, type GoogleSignedInUser } from "./google-identity";
import styles from "./public-auth-control.module.css";

export function PublicAuthControl() {
  const router = useRouter();
  const [user, setUser] = useState<GoogleSignedInUser | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/public-auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: GoogleSignedInUser | null }> : { user: null })
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const signIn = useCallback(async (credential: string) => {
    setPending(true);
    setMessage(null);
    try {
      await signInWithGoogleCredential(credential);
      router.push("/account");
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "ההתחברות נכשלה. נסה שוב.");
      setPending(false);
    }
  }, [router]);

  useEffect(() => {
    const clientId = googleIdentityClientId();
    const host = googleButton.current;
    if (!clientId || !host || user) return;
    let cancelled = false;
    void loadGoogleIdentity().then((identity) => {
      if (cancelled || !googleButton.current) return;
      identity.initialize({ client_id: clientId, callback: ({ credential }) => {
        if (!credential) { setMessage("Google לא החזיר אישור התחברות."); return; }
        void signIn(credential);
      } });
      googleButton.current.replaceChildren();
      identity.renderButton(googleButton.current, { theme: "outline", size: "large", text: "signin_with", width: 280, locale: "he" });
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "לא ניתן לטעון את Google."));
    return () => { cancelled = true; };
  }, [signIn, user]);

  async function signOut() {
    setPending(true);
    setMessage(null);
    const result = await fetch("/api/public-auth/sign-out", { method: "POST" });
    if (!result.ok) {
      setMessage("היציאה נכשלה. נסה שוב.");
      setPending(false);
      return;
    }
    setUser(null);
    setPending(false);
  }

  if (user === undefined) return <p className={styles.muted}>טוען התחברות…</p>;

  if (user) {
    return (
      <div className={styles.control}>
        <p className={styles.identity}>
          מחובר כ־{user.name || user.email}
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
      {googleIdentityClientId()
        ? <div ref={googleButton} aria-label="כניסה עם Google" />
        : <p className={styles.muted}>התחברות עם Google תופעל לאחר הגדרת מזהה הלקוח המאובטח שלה.</p>}
      {message && <p className={styles.error} role="alert">{message}</p>}
    </div>
  );
}
