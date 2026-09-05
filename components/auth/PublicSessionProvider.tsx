"use client";

/**
 * One reading of the reader's session, shared by the header and the account
 * page (AUTH-002).
 *
 * Before this, `PublicAuthControl` fetched `/api/public-auth/session` for
 * itself and nothing else knew the answer. Adding a sign-in link to the header
 * with the same pattern would have meant two requests per page load racing
 * each other, and — worse — two components that could disagree about whether
 * anyone is signed in. The state lives here once instead, and both surfaces
 * read it.
 *
 * The rule this provider exists to enforce, more than deduplication:
 *
 *   **A failed check is not a signed-out reader.**
 *
 * `status` and the identities are separate for exactly that reason. When the
 * check has not landed, or landed badly, `google` and `x` are null *and*
 * `known` is false, and every consumer is expected to branch on `known` before
 * it decides to show a sign-in invitation. Rendering "Sign in" at someone who
 * is in fact signed in — because a request timed out — is the failure mode
 * this file is shaped around.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  GooglePublicIdentity,
  ProviderAvailability,
  PublicSessionResponse,
  XPublicIdentity,
} from "@/server/contracts/public-session";

/** How long to wait before calling the session service unresponsive. */
const SESSION_TIMEOUT_MS = 10_000;

export type PublicSessionStatus = "checking" | "ready" | "unavailable" | "error";

export interface PublicSessionValue {
  status: PublicSessionStatus;
  /** True only when the server actually answered. Guard sign-in prompts on it. */
  known: boolean;
  google: GooglePublicIdentity | null;
  x: XPublicIdentity | null;
  availability: { google: ProviderAvailability; x: ProviderAvailability };
  /** Why the check failed, in words a reader can act on. Null when it didn't. */
  message: string | null;
  /** Re-read from the server. Used by the retry affordance and after sign-out. */
  refresh: () => void;
  /** Apply an identity this tab just established, without a second round trip. */
  setGoogle: (identity: GooglePublicIdentity | null) => void;
  setX: (identity: XPublicIdentity | null) => void;
}

const FALLBACK_AVAILABILITY = {
  google: "unconfigured" as ProviderAvailability,
  x: "unconfigured" as ProviderAvailability,
};

const PublicSessionContext = createContext<PublicSessionValue | null>(null);

export function PublicSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PublicSessionStatus>("checking");
  const [google, setGoogle] = useState<GooglePublicIdentity | null>(null);
  const [x, setX] = useState<XPublicIdentity | null>(null);
  const [availability, setAvailability] = useState(FALLBACK_AVAILABILITY);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SESSION_TIMEOUT_MS);

    void fetch("/api/public-auth/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new SessionReadProblem(
            response.status >= 500 ? "unavailable" : "error",
            `The session check failed (HTTP ${response.status}).`,
          );
        }
        return (await response.json()) as PublicSessionResponse;
      })
      .then((data) => {
        setGoogle(data.user ?? null);
        setX(data.x ?? null);
        setAvailability(data.availability ?? FALLBACK_AVAILABILITY);
        setMessage(null);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        /* An abort we caused by unmounting is not a failure to report. A
           timeout aborts too, so it is distinguished by the flag rather than
           by the signal. */
        if (controller.signal.aborted && !timedOut) return;
        /* Identities stay null, but `known` stays false with them: consumers
           must not read this as "signed out". */
        setGoogle(null);
        setX(null);
        if (timedOut) {
          setStatus("unavailable");
          setMessage("The session service did not respond within ten seconds.");
        } else if (cause instanceof SessionReadProblem) {
          setStatus(cause.kind);
          setMessage(cause.message);
        } else {
          setStatus("unavailable");
          setMessage("The session service could not be reached.");
        }
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const refresh = useCallback(() => {
    setStatus("checking");
    setMessage(null);
    setAttempt((value) => value + 1);
  }, []);

  /* A sign-in or sign-out this tab performed is authoritative for this tab:
     the cookie is already set or cleared by the time it resolves, so the
     identity is applied directly rather than re-fetched. `status` becomes
     "ready" with it — a sign-in that succeeds while the background check was
     failing has answered the question the check could not. */
  const applyGoogle = useCallback((identity: GooglePublicIdentity | null) => {
    setGoogle(identity);
    setStatus("ready");
    setMessage(null);
  }, []);

  const applyX = useCallback((identity: XPublicIdentity | null) => {
    setX(identity);
    setStatus("ready");
    setMessage(null);
  }, []);

  const value = useMemo<PublicSessionValue>(
    () => ({
      status,
      known: status === "ready",
      google,
      x,
      availability,
      message,
      refresh,
      setGoogle: applyGoogle,
      setX: applyX,
    }),
    [status, google, x, availability, message, refresh, applyGoogle, applyX],
  );

  return <PublicSessionContext.Provider value={value}>{children}</PublicSessionContext.Provider>;
}

/**
 * The session, for any component — mounted under the provider or not.
 *
 * This threw at first, on the theory that a header silently rendering "signed
 * out" because nobody wrapped the tree is worse than a crash. The test suite
 * disagreed, and it was right: five route tests render page components
 * directly rather than through the root layout, and so a `SiteHeader` that
 * throws without a provider is a `SiteHeader` that can take a page render down
 * with it — in a test today, in some future render path tomorrow.
 *
 * The theory was also wrong on its own terms. There is no silent wrong answer
 * to fall back to: `UNPROVIDED` is `checking` with `known: false`, which is
 * exactly what a consumer must already handle, and which by contract may not
 * be rendered as a signed-out reader. Degrading here says "I do not know",
 * which is true, instead of asserting something false or crashing.
 *
 * A missing provider is a mistake, but not one this hook reports: warning
 * from here would be a side effect during render, which the React Compiler
 * lint correctly refuses. `tests/public-account-surface.test.ts` asserts that
 * the root layout mounts the provider instead — the guarantee belongs in CI,
 * not in every render of every page.
 */
export function usePublicSession(): PublicSessionValue {
  const value = useContext(PublicSessionContext);
  if (!value) {
    return UNPROVIDED;
  }
  return value;
}

/**
 * What an unwrapped tree sees: the honest "not known" state, frozen.
 *
 * `refresh` and the setters are no-ops rather than missing — a consumer that
 * calls one gets nothing rather than a crash, and there is nothing to refresh
 * without a provider to hold the result.
 */
const UNPROVIDED: PublicSessionValue = Object.freeze({
  status: "checking",
  known: false,
  google: null,
  x: null,
  availability: FALLBACK_AVAILABILITY,
  message: null,
  refresh: () => {},
  setGoogle: () => {},
  setX: () => {},
});

class SessionReadProblem extends Error {
  constructor(
    readonly kind: "unavailable" | "error",
    message: string,
  ) {
    super(message);
    this.name = "SessionReadProblem";
  }
}
