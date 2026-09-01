"use client";

type GoogleCredentialResponse = { credential?: string };
type GoogleAccountsId = {
  initialize: (configuration: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean }) => void;
  renderButton: (parent: HTMLElement, options: { theme: "outline"; size: "large"; text: "signin_with"; width?: number; locale?: string }) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_ID = "google-identity-services";
const SCRIPT_URL = "https://accounts.google.com/gsi/client";

/** Loads the official Google Identity Services client from Google. It is never
 * bundled or self-hosted, so Google can deliver security updates to the login
 * surface. */
export async function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const existing = window.google?.accounts?.id;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (script) {
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error("Google Identity Services failed to load.")), { once: true });
      return;
    }
    const next = document.createElement("script");
    next.id = SCRIPT_ID;
    next.src = SCRIPT_URL;
    next.async = true;
    next.onload = () => resolve();
    next.onerror = () => reject(new Error("Google Identity Services failed to load."));
    document.head.append(next);
  });

  const identity = window.google?.accounts?.id;
  if (!identity) throw new Error("Google Identity Services is unavailable.");
  return identity;
}

export function googleIdentityClientId(): string | null {
  const value = process.env.NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID?.trim();
  return value || null;
}

/**
 * Redeem a credential from Google's official button through the site's Neon
 * Auth proxy.  Using `fetch` here is intentional: the proxy must return its
 * session cookies to this origin before the app navigates to a protected page.
 */
export type GoogleSignedInUser = { id: string; email: string; name: string };

export async function signInWithGoogleCredential(credential: string): Promise<GoogleSignedInUser> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch("/api/public-auth/google", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("החיבור מול שירות ההתחברות לא הסתיים בזמן. נסה שוב מאוחר יותר.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const body = await response.json().catch(() => null) as { message?: unknown; user?: GoogleSignedInUser } | null;
  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Google sign-in could not be completed.");
  }
  if (!body?.user) throw new Error("Google sign-in did not return a user session.");
  return body.user;
}
