"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import { googleIdentityClientId, loadGoogleIdentity, signInWithGoogleCredential, type GoogleSignedInUser } from "./google-identity";
import styles from "./public-auth-control.module.css";

export function PublicAuthControl() {
  const router = useRouter();
  const [user, setUser] = useState<GoogleSignedInUser | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);
    try {
      await signInWithGoogleCredential(credential);
      setNotice("Signed in.");
      router.push("/account");
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Sign-in failed. Try again.");
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
        if (!credential) { setMessage("Google did not return a sign-in credential."); return; }
        void signIn(credential);
      } });
      googleButton.current.replaceChildren();
      identity.renderButton(googleButton.current, { theme: "outline", size: "large", text: "signin_with", width: 280, locale: "en" });
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Google could not be loaded."));
    return () => { cancelled = true; };
  }, [signIn, user]);

  async function signOut() {
    setPending(true);
    setMessage(null);
    setNotice(null);
    const result = await fetch("/api/public-auth/sign-out", { method: "POST" });
    if (!result.ok) {
      setMessage("Sign-out failed. Try again.");
      setPending(false);
      return;
    }
    setUser(null);
    setPending(false);
    setNotice("Signed out.");
  }

  if (user === undefined) {
    return (
      <p className={styles.muted} {...politeLive}>
        Checking sign-in…
      </p>
    );
  }

  if (user) {
    return (
      <div className={styles.control}>
        <p className={styles.identity}>
          Signed in as {user.name || user.email}
        </p>
        <Button variant="secondary" size="md" type="button" onClick={signOut} disabled={pending} isLoading={pending}>
          {pending ? "Signing out…" : "Sign out"}
        </Button>
        {message ? <p className={styles.error} {...assertiveLive}>{message}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.control}>
      {googleIdentityClientId()
        ? <div ref={googleButton} aria-label="Sign in with Google" />
        : <p className={styles.muted}>Google sign-in will appear once its client ID is configured.</p>}
      {notice ? <p className={styles.muted} {...politeLive}>{notice}</p> : null}
      {message ? <p className={styles.error} {...assertiveLive}>{message}</p> : null}
    </div>
  );
}
