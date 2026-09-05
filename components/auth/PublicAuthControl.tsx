"use client";

/**
 * Public sign-in, for two providers that are deliberately not merged
 * (AUTH-001, extended by AUTH-002).
 *
 * Google Identity Services renders its own button, hands back a credential,
 * and `signInWithGoogleCredential` redeems it through this site's proxy. That
 * flow is Google's and is preserved exactly — the script, the consent, the
 * button — because it is the part of a login surface that must be delivered
 * and patched by the identity provider rather than re-implemented here. X is
 * a plain OAuth redirect owned by `app/auth/x/`. There is no password field on
 * this page and none is added.
 *
 * **The two accounts are shown side by side and never combined.** If both
 * cookies are present, that is two sign-ins, each with its own sign-out.
 * Deciding that a Google identity and an X identity are the same person is a
 * claim about who someone is; it is not something to infer from two cookies
 * arriving in one request, and nothing here infers it.
 *
 * The session itself is read once by `PublicSessionProvider` and shared with
 * the header, so this control no longer fetches it. What it keeps from the
 * older version is the discipline about states: a check that has not landed,
 * or landed badly, is **not** a signed-out reader, and the failure branch says
 * so rather than quietly offering a sign-in button.
 *
 * X is production-only, by decision. Its callback is registered to
 * `https://lionsofzion.io/auth/x/callback` and its cookies are `__Host-`
 * prefixed with `secure: true`, which a browser will not write over plain
 * http — so a sign-in begun locally would land back on production carrying no
 * state cookie and fail on arrival. Locally this says where the working one
 * is instead of starting a flow that cannot finish.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
/* Deep imports, not the `@/components/ui` barrel: the barrel re-exports
   Dialog, Tabs and Tooltip, and this control needs three files from it. */
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import {
  publicDisplayName,
  type ProviderAvailability,
} from "@/server/contracts/public-session";
import { usePublicSession } from "./PublicSessionProvider";
import { XMark } from "./XMark";
import {
  googleIdentityClientId,
  loadGoogleIdentity,
  signInWithGoogleCredential,
} from "./google-identity";
import styles from "./public-auth-control.module.css";

/** The account surface on the deployment where X can actually complete. */
const PRODUCTION_ACCOUNT_URL = "https://lionsofzion.io/account";

/**
 * What the X callback is allowed to say in a URL.
 *
 * A closed set of opaque markers, mapped to copy here. The callback never puts
 * a provider reason, an HTTP status, a token or the OAuth state into the
 * redirect — an authentication failure explained in a shareable URL is an
 * authentication failure explained to whoever the URL is shared with.
 */
const X_ERROR_COPY: Record<string, string> = {
  cancelled: "The X sign-in was cancelled before it finished. Nothing was changed.",
  unavailable: "X sign-in is not available on this deployment.",
  failed: "The X sign-in could not be completed. Nothing was changed.",
};

function xErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  /* An unrecognised marker is still a failure worth reporting; it just does
     not get to choose its own words. */
  return X_ERROR_COPY[code] ?? X_ERROR_COPY.failed;
}

export function PublicAuthControl({ xError }: { xError?: string }) {
  const router = useRouter();
  const session = usePublicSession();
  const { availability, google, x, known, status } = session;

  const [pendingProvider, setPendingProvider] = useState<"google" | "x" | null>(null);
  const [message, setMessage] = useState<string | null>(() => xErrorMessage(xError));
  const [notice, setNotice] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  const signInWithGoogle = useCallback(
    async (credential: string) => {
      setPendingProvider("google");
      setMessage(null);
      setNotice(null);
      try {
        session.setGoogle(await signInWithGoogleCredential(credential));
        setPendingProvider(null);
        setNotice("Signed in with Google.");
        /* The session cookie is set by the redemption call; this re-reads
           anything the server rendered for a signed-out visitor. */
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error && error.message ? error.message : "Sign-in failed. Try again.",
        );
        setPendingProvider(null);
      }
    },
    [router, session],
  );

  /* Two things have to agree before Google's button can appear, and they are
     read from different places: the server reports `availability.google` from
     its own configuration, while the client id is a `NEXT_PUBLIC_*` value
     inlined at build time. A deployment can have one without the other, and
     the honest rendering of that disagreement is the same sentence an
     unconfigured provider gets — not an empty box where a button should be. */
  const googleAvailability: ProviderAvailability =
    availability.google === "ready" && googleIdentityClientId() ? "ready" : "unconfigured";

  /* The button is mounted only where it can be used: the session is known,
     Google is usable, and nobody is signed into it yet. */
  const wantsGoogleButton = known && !google && googleAvailability === "ready";

  useEffect(() => {
    const clientId = googleIdentityClientId();
    if (!clientId || !googleButton.current || !wantsGoogleButton) return;
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
            void signInWithGoogle(credential);
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
  }, [signInWithGoogle, wantsGoogleButton]);

  const signOut = useCallback(
    async (provider: "google" | "x") => {
      setPendingProvider(provider);
      setMessage(null);
      setNotice(null);
      const endpoint =
        provider === "google" ? "/api/public-auth/sign-out" : "/auth/x/signout";
      const result = await fetch(endpoint, { method: "POST" }).catch(() => null);
      if (!result?.ok) {
        setMessage(
          `Signing out of ${provider === "google" ? "Google" : "X"} failed. Try again.`,
        );
        setPendingProvider(null);
        return;
      }
      /* Only this provider is cleared. Signing out of one account is not a
         statement about the other. */
      if (provider === "google") session.setGoogle(null);
      else session.setX(null);
      setPendingProvider(null);
      setNotice(`Signed out of ${provider === "google" ? "Google" : "X"}.`);
      router.refresh();
    },
    [router, session],
  );

  if (status === "checking") {
    return (
      <div className={styles.control}>
        <p className={styles.muted} {...politeLive}>
          Checking your sign-in…
        </p>
      </div>
    );
  }

  /* A failed check is reported as a failed check. It is never rendered as a
     signed-out reader with an invitation to sign in — that is the one wrong
     answer this branch exists to prevent. */
  if (status === "unavailable" || status === "error") {
    return (
      <StatusState
        status="error"
        headingLevel={2}
        title={
          status === "unavailable"
            ? "Sign-in status is temporarily unavailable."
            : "Sign-in status could not be checked."
        }
        description={session.message ?? "The session check did not complete."}
        actionText="Try again"
        onAction={session.refresh}
      />
    );
  }

  const signedIn = Boolean(google || x);

  return (
    <div className={styles.control}>
      <div className={styles.providers}>
        <ProviderBlock
          name="Google"
          identity={google ? publicDisplayName(google) : null}
          detail={google && google.email !== google.name ? google.email : null}
          availability={googleAvailability}
          unconfiguredCopy="Google sign-in is unavailable on this deployment: no client ID is configured."
          pending={pendingProvider === "google"}
          onSignOut={() => void signOut("google")}
        >
          {/* Google rendered its button into this host, so the host stays
              mounted across the pending state and is hidden rather than
              unmounted — the same credential cannot be submitted twice. */}
          <div className={styles.googleHost} hidden={pendingProvider === "google"}>
            <div ref={googleButton} aria-label="Sign in with Google" />
          </div>
          {pendingProvider === "google" ? (
            <p className={styles.muted} {...politeLive}>
              Signing you in…
            </p>
          ) : null}
        </ProviderBlock>

        <ProviderBlock
          name="X"
          identity={x ? publicDisplayName(x) : null}
          detail={x ? `@${x.username}` : null}
          availability={availability.x}
          unconfiguredCopy="X sign-in is unavailable on this deployment: no X application is configured."
          pending={pendingProvider === "x"}
          onSignOut={() => void signOut("x")}
        >
          {availability.x === "production-only" ? (
            <>
              <p className={styles.prompt}>
                X sign-in runs on the live site only. Its callback address and its
                cookies are registered to <code className={styles.code}>lionsofzion.io</code>,
                so a sign-in begun here could not be completed.
              </p>
              <div className={styles.actions}>
                <ButtonLink href={PRODUCTION_ACCOUNT_URL} variant="secondary" size="md">
                  Open the account page on the live site
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <p className={styles.prompt}>
                Continue with the X account you want the desk to know you by.
              </p>
              {/* A form, not a link. Starting this flow has a side effect —
                  `/auth/x` mints OAuth state and sets a cookie — so it is an
                  action, and a `next/link` to it would be *prefetched*: a
                  route handler that hands out state cookies must not be
                  fetched because a button scrolled into view. A GET form
                  submit is a full document navigation, which is also what an
                  external redirect needs.

                  X ships no button widget the way Google does — only brand
                  rules — so the button is ours and the mark is theirs. White
                  ground with a black mark is the inverse of the familiar one,
                  and it is the reading their guidance asks for on a dark page:
                  it also lets this sit beside Google's rendered button at the
                  same weight instead of a rank below it. */}
              <form action="/auth/x" method="get" className={styles.actions}>
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  className={styles.xButton}
                  leftIcon={<XMark />}
                >
                  Sign in with X
                </Button>
              </form>
            </>
          )}
        </ProviderBlock>
      </div>

      {signedIn ? (
        <div className={styles.actions}>
          {/* One primary, and it is not a destructive one: the act this page
              exists to enable is going back to the desk signed in. */}
          <ButtonLink href="/" variant="primary" size="md">
            Back to the desk
          </ButtonLink>
        </div>
      ) : null}

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

/**
 * One provider, in whichever of its four states it is in: signed in,
 * signed out and usable, not configured here, or configured but not usable on
 * this deployment.
 *
 * `unconfigured` is not an error and is not styled as one. The page is
 * working; this deployment simply has no credentials for that provider, and
 * the honest rendering is a sentence rather than an empty box where a button
 * should be.
 */
function ProviderBlock({
  name,
  identity,
  detail,
  availability,
  unconfiguredCopy,
  pending,
  onSignOut,
  children,
}: {
  name: string;
  identity: string | null;
  detail: string | null;
  availability: ProviderAvailability;
  unconfiguredCopy: string;
  pending: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.provider} aria-label={`${name} account`}>
      <h2 className={styles.providerName}>{name}</h2>

      {identity ? (
        <>
          <div className={styles.identity}>
            <p className={styles.identityLabel}>Signed in</p>
            <p className={styles.identityName}>{identity}</p>
            {detail && detail !== identity ? (
              <p className={styles.identityEmail}>{detail}</p>
            ) : null}
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={onSignOut}
              disabled={pending}
              isLoading={pending}
            >
              {/* The label does not change while busy: `isLoading` already
                  swaps in a spinner and an off-screen "Loading", and
                  re-labelling would resize the button mid-action. */}
              Sign out of {name}
            </Button>
          </div>
        </>
      ) : availability === "unconfigured" ? (
        <p className={styles.muted}>{unconfiguredCopy}</p>
      ) : (
        children
      )}
    </section>
  );
}
