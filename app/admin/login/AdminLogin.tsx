"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import { googleIdentityClientId, loadGoogleIdentity, signInWithGoogleCredential } from "@/components/auth/google-identity";
import { Button, Field } from "@/components/ui";
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
      setMessage(error instanceof Error && error.message ? error.message : "Google sign-in failed. Try again.");
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
        if (!credential) { setMessage("Google did not return a sign-in credential."); return; }
        void signInWithGoogle(credential);
      } });
      googleButton.current.replaceChildren();
      identity.renderButton(googleButton.current, { theme: "outline", size: "large", text: "signin_with", width: 380, locale: "en" });
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Google could not be loaded."));
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
        setMessage(result.error.message || "Sign-in failed. Check the details and try again.");
        setPending(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Sign-in failed. Try again.");
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        minLength={8}
        required
      />
      {message && <p className={styles.error} role="alert">{message}</p>}
      <Button variant="primary" size="md" disabled={pending} isLoading={pending} type="submit" value="signin">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Button variant="secondary" size="md" disabled={pending} type="submit" value="signup">
        Create the first admin account
      </Button>
      {googleIdentityClientId()
        ? <div ref={googleButton} aria-label="Sign in with Google" />
        : <p className={styles.muted}>Google sign-in will appear once its client ID is configured.</p>}
    </form>
  );
}
