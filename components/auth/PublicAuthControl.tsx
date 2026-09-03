"use client";

/**
 * Public sign-in, in four states (AUTH-001).
 *
 * The identity boundary is Google Identity Services: Google renders its own
 * button, hands back a credential, and `signInWithGoogleCredential` redeems it
 * through this site's proxy. That flow is Google's and is preserved exactly —
 * the script, the consent, the button — because it is the part of a login
 * surface that must be delivered and patched by the identity provider rather
 * than re-implemented here. There is no password field on this page, and none
 * is added: there is nothing for a password manager to fill and nothing to
 * autocomplete.
 *
 * What this file owes the reader is the four states, each of them said out
 * loud rather than left to be inferred from an empty box:
 *
 *  - **checking** — the session request is in flight (polite).
 *  - **signed out** — Google's button, or a plain statement when the client ID
 *    is not configured. A sign-in in progress is announced (polite), and a
 *    refusal is announced as a blocking error (assertive), per STATE-002.
 *  - **signing in** — the credential is being redeemed. Google's button is
 *    hidden while it is, so the same credential cannot be submitted twice.
 *  - **signed in** — who you are, the way onward, and the way out.
 *
 * One fix worth naming: a successful sign-in used to end in
 * `router.push("/account")`, and the only page mounting this control *is*
 * /account. Pushing a route onto itself does not remount the client component,
 * so the session state was never re-read and the control sat in its pending
 * state for good — on the one page it ships on. The signed-in user comes back
 * from the redemption call, so it is applied directly, and `router.refresh()`
 * re-reads anything the server rendered for a signed-out visitor.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
/* Deep imports, not the `@/components/ui` barrel: the barrel re-exports
   Dialog, Tabs and Tooltip, and this control needs two files from it. */
import { Button, ButtonLink } from "@/components/ui/Button";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import {
  googleIdentityClientId,
  loadGoogleIdentity,
  signInWithGoogleCredential,
  type GoogleSignedInUser,
} from "./google-identity";
import styles from "./public-auth-control.module.css";

export function PublicAuthControl() {
  const router = useRouter();
  /** `undefined` while the session is being read — a third state, not a null. */
  const [user, setUser] = useState<GoogleSignedInUser | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/public-auth/session", { cache: "no-store" })
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ user: GoogleSignedInUser | null }>) : { user: null },
      )
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const signIn = useCallback(
    async (credential: string) => {
      setPending(true);
      setMessage(null);
      setNotice(null);
      try {
        const signedIn = await signInWithGoogleCredential(credential);
        setUser(signedIn);
        setPending(false);
        setNotice("Signed in.");
        /* The session cookie is set by the redemption call; this re-reads
           anything the server rendered for a signed-out visitor. */
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error && error.message ? error.message : "Sign-in failed. Try again.",
        );
        setPending(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const clientId = googleIdentityClientId();
    const host = googleButton.current;
    if (!clientId || !host || user) return;
    let cancelled = false;
    void loadGoogleIdentity()
      .then((identity) => {
        if (cancelled || !googleButton.current) return;
        identity.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (!credential) {
              setMessage("Google did not return a sign-in credential.");
              return;
            }
            void signIn(credential);
          },
        });
        googleButton.current.replaceChildren();
        identity.renderButton(googleButton.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          width: 280,
          locale: "en",
        });
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Google could not be loaded."),
      );
    return () => {
      cancelled = true;
    };
  }, [signIn, user]);

  async function signOut() {
    setPending(true);
    setMessage(null);
    setNotice(null);
    const result = await fetch("/api/public-auth/sign-out", { method: "POST" }).catch(() => null);
    if (!result?.ok) {
      setMessage("Sign-out failed. Try again.");
      setPending(false);
      return;
    }
    setUser(null);
    setPending(false);
    setNotice("Signed out.");
    router.refresh();
  }

  if (user === undefined) {
    return (
      <div className={styles.control}>
        <p className={styles.muted} {...politeLive}>
          Checking your sign-in…
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className={styles.control}>
        <div className={styles.identity}>
          <p className={styles.identityLabel}>Signed in</p>
          <p className={styles.identityName}>{user.name || user.email}</p>
          {user.name && user.email !== user.name ? (
            <p className={styles.identityEmail}>{user.email}</p>
          ) : null}
        </div>

        {/* One primary per state, and it is not the destructive one: the act
            this page exists to enable is going back to the desk signed in.
            Signing out is offered beside it, in the secondary voice. */}
        <div className={styles.actions}>
          <ButtonLink href="/" variant="primary" size="md">
            Back to the desk
          </ButtonLink>
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={signOut}
            disabled={pending}
            isLoading={pending}
          >
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        {notice ? (
          <p className={styles.muted} {...politeLive}>
            {notice}
          </p>
        ) : null}
        {message ? (
          <p className={styles.error} {...assertiveLive}>
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.control}>
      {googleIdentityClientId() ? (
        <>
          <p className={styles.prompt}>Sign in with the Google account you want the desk to know you by.</p>
          {/* The host stays mounted across the pending state — Google rendered
              its button into it — but is hidden while a credential is being
              redeemed, so the same one cannot be submitted twice. */}
          <div className={styles.googleHost} hidden={pending}>
            <div ref={googleButton} aria-label="Sign in with Google" />
          </div>
          {pending ? (
            <p className={styles.muted} {...politeLive}>
              Signing you in…
            </p>
          ) : null}
        </>
      ) : (
        /* Not an error: the page is working, this deployment simply has no
           Google client ID configured. Said plainly rather than shown as an
           empty box where a button should be. */
        <p className={styles.muted}>
          Sign-in is unavailable on this deployment: no Google client ID is configured.
        </p>
      )}

      {notice ? (
        <p className={styles.muted} {...politeLive}>
          {notice}
        </p>
      ) : null}
      {message ? (
        <p className={styles.error} {...assertiveLive}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
