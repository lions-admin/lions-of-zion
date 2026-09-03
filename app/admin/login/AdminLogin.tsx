"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import { googleIdentityClientId, loadGoogleIdentity, signInWithGoogleCredential } from "@/components/auth/google-identity";
import { Button, Field } from "@/components/ui";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import styles from "../admin.module.css";

const auth = createAuthClient();

/**
 * AUTH-001 — operator sign-in.
 *
 * Three paths, in descending order of how often they are used: the password
 * form, the linked Google account, and the one-time bootstrap that creates
 * the administrator account on a deployment that has none. They used to be
 * three sibling buttons of near-equal weight, which put "create an account"
 * one mis-click from "sign in".
 *
 * The bootstrap control sits outside the `<form>` and reaches it through the
 * `form` attribute, so it is still the submit event's `submitter` — the
 * branch below depends on that — while no longer sharing the sign-in block.
 * Sign in remains the first submit button in tree order, so Enter in either
 * field still means sign in and never means create an account.
 */
export function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState<"signin" | "signup" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);
  const formId = useId();

  async function signInWithGoogle(credential: string) {
    setPending("signin");
    setMessage(null);

    try {
      const callbackURL = new URL("/admin", window.location.origin).toString();
      await signInWithGoogleCredential(credential);

      window.location.assign(callbackURL);
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Google sign-in failed. Try again.");
      setPending(null);
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
    /* Read the form before any state change: a re-render that disables the
       controls would take their values out of the submission. */
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const create = submitter?.value === "signup";
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setPending(create ? "signup" : "signin");
    setMessage(null);

    try {
      const result = create
        ? await auth.signUp.email({ email, password, name: "Lions of Zion Admin" })
        : await auth.signIn.email({ email, password });

      if (result.error) {
        setMessage(result.error.message || (create
          ? "The account could not be created. It may already exist, or this address is not the configured administrator address."
          : "Sign-in failed. Check the details and try again."));
        setPending(null);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Sign-in failed. Try again.");
      setPending(null);
    }
  }

  const busy = pending !== null;
  /* A11Y-007. A refused sign-in is a fact about the submission, not about
     either field — the API does not say which of the two was wrong, and
     marking both `aria-invalid` would be a guess. So it stays a form-level
     summary and the form is described by it, which is what makes it reachable
     from inside the fields rather than only announced once on arrival. The
     ids are stable, so a second failure re-points at the same element. */
  const errorId = `${formId}-error`;
  const pendingId = `${formId}-pending`;

  return (
    <div className={styles.authStack}>
      <form
        className={styles.form}
        id={formId}
        onSubmit={submit}
        aria-busy={busy || undefined}
        aria-describedby={[message ? errorId : null, busy ? pendingId : null].filter(Boolean).join(" ") || undefined}
      >
        <Field
          label="Administrator email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          disabled={busy}
          required
        />

        {message ? <p id={errorId} className={styles.error} {...assertiveLive}>{message}</p> : null}
        {/* Mounted at all times and empty when idle: a polite region that is
            added to the page at the same moment as its text is announced
            unreliably. `:empty` keeps it out of the layout. */}
        <p id={pendingId} className={styles.authPending} {...politeLive}>
          {pending === "signin" ? "Signing in. Please wait." : pending === "signup" ? "Creating the administrator account. Please wait." : ""}
        </p>

        <Button
          variant="primary"
          size="md"
          className={styles.authSubmit}
          type="submit"
          value="signin"
          disabled={busy}
          isLoading={pending === "signin"}
        >
          Sign in
        </Button>
      </form>

      <div className={styles.altAuth}>
        <p className={styles.altLabel}>Or use the linked Google account</p>
        {googleIdentityClientId()
          ? <div ref={googleButton} className={styles.googleHost} />
          : <p className={styles.muted}>Google sign-in appears here once its client ID is configured for this deployment.</p>}
      </div>

      <div className={styles.bootstrap}>
        <p className={styles.bootstrapLabel}>First-time setup</p>
        <p className={styles.muted}>
          Creates the administrator account on a deployment that does not have one yet, using the
          address and password entered above. The address must be the one configured for this
          deployment; every other address is refused. Once the account exists, sign in instead.
        </p>
        <Button
          variant="secondary"
          size="md"
          type="submit"
          value="signup"
          form={formId}
          disabled={busy}
          isLoading={pending === "signup"}
        >
          Create the administrator account
        </Button>
      </div>
    </div>
  );
}
