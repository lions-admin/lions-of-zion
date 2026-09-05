/**
 * The public account surface (AUTH-002).
 *
 * Two claims are worth a test more than the rest of this file, and everything
 * else here exists to keep them honest:
 *
 *  1. **A failed session check is never rendered as a signed-out reader.**
 *     The expensive bug on a sign-in page is not an error message; it is an
 *     invitation to sign in shown to someone who already is, because a request
 *     timed out. It reads as "you have been logged out".
 *
 *  2. **Google and X are shown separately and never merged.** Two cookies in
 *     one request are two sign-ins, not one person with two names.
 *
 * The renders go through `renderToReadableStream` in a node environment, the
 * same way `tests/state-causes.test.ts` does: effects do not run, which is
 * exactly right here — it is the first paint, before any of them, that decides
 * what a reader is told about their own session.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import {
  publicDisplayName,
  publicInitials,
  type ProviderAvailability,
} from "@/server/contracts/public-session";
import type { PublicSessionValue } from "@/components/auth/PublicSessionProvider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

/* A configured client id, so the signed-out branch can be observed. The real
   accessor reads a build-inlined `NEXT_PUBLIC_*` value that a test process
   does not have. */
vi.mock("@/components/auth/google-identity", () => ({
  googleIdentityClientId: () => "test-client-id.apps.googleusercontent.com",
  loadGoogleIdentity: vi.fn(),
  signInWithGoogleCredential: vi.fn(),
}));

const session = vi.fn<() => PublicSessionValue>();
vi.mock("@/components/auth/PublicSessionProvider", () => ({
  usePublicSession: () => session(),
  PublicSessionProvider: ({ children }: { children: unknown }) => children,
}));

const { PublicAuthControl } = await import("@/components/auth/PublicAuthControl");

const GOOGLE = { id: "google:1", email: "reader@example.com", name: "Dana Reader" };
const X = { id: "42", username: "lions_reader", name: "Dana On X" };

function state(over: Partial<PublicSessionValue> = {}): PublicSessionValue {
  const ready: ProviderAvailability = "ready";
  return {
    status: "ready",
    known: true,
    google: null,
    x: null,
    availability: { google: ready, x: ready },
    message: null,
    refresh: () => {},
    setGoogle: () => {},
    setX: () => {},
    ...over,
  };
}

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

async function render(props: { xError?: string } = {}): Promise<string> {
  const stream = await renderToReadableStream(createElement(PublicAuthControl, props));
  await stream.allReady;
  const markup = await new Response(stream).text();
  /* React splits interpolated text with an empty comment; sentences are read
     as a person sees them, not as the stream writes them. */
  return markup.replaceAll("<!-- -->", "");
}

/* ── The contract's own helpers ──────────────────────────────────────────── */

describe("display names and initials", () => {
  it("prefers a name, falls back to the address, and to the handle", () => {
    expect(publicDisplayName(GOOGLE)).toBe("Dana Reader");
    expect(publicDisplayName({ ...GOOGLE, name: "  " })).toBe("reader@example.com");
    expect(publicDisplayName(X)).toBe("Dana On X");
    expect(publicDisplayName({ id: "42", username: "lions_reader" })).toBe("@lions_reader");
    expect(publicDisplayName(null)).toBeNull();
  });

  it("takes one letter per word, up to two", () => {
    expect(publicInitials(GOOGLE)).toBe("DR");
    expect(publicInitials({ id: "42", username: "lions_reader" })).toBe("LR");
    expect(publicInitials({ ...GOOGLE, name: "Dana" })).toBe("D");
    expect(publicInitials(null)).toBe("");
  });

  it("does not cut a character outside the BMP in half", () => {
    /* X permits an emoji as the first character of a display name. `charAt`
       would return a lone surrogate here and render as a replacement glyph. */
    const initials = publicInitials({ id: "42", username: "x", name: "🦁 Desk" });
    expect(Array.from(initials)).toHaveLength(2);
    expect(initials.startsWith("🦁")).toBe(true);
  });
});

/* ── Claim 1: a failed check is not a signed-out reader ──────────────────── */

describe("a session check that did not land", () => {
  it("says it is still checking, and offers no sign-in yet", async () => {
    session.mockReturnValue(state({ status: "checking", known: false }));
    const markup = await render();

    expect(markup).toContain("Checking your sign-in");
    expect(markup).not.toContain("Sign in with X");
    expect(markup).not.toContain("Sign in with Google");
  });

  it.each([
    ["unavailable", "temporarily unavailable"],
    ["error", "could not be checked"],
  ] as const)("reports a %s check as a failure, not as being signed out", async (status, copy) => {
    session.mockReturnValue(
      state({ status, known: false, message: "The session service could not be reached." }),
    );
    const markup = await render();

    expect(markup).toContain(copy);
    expect(markup).toContain("Try again");
    /* The whole point: no sign-in invitation anywhere on a failed check. */
    expect(markup).not.toContain("Sign in with X");
    expect(markup).not.toContain("Sign in with Google");
    expect(markup).not.toContain("Back to the desk");
  });
});

/* ── Claim 2: two providers, never merged ────────────────────────────────── */

describe("two providers", () => {
  it("offers both when nobody is signed in", async () => {
    session.mockReturnValue(state());
    const markup = await render();

    expect(markup).toContain("Sign in with Google");
    expect(markup).toContain("Sign in with X");
    /* Nothing to go back to the desk *as* yet. */
    expect(markup).not.toContain("Back to the desk");
  });

  it("shows both identities separately, each with its own sign-out", async () => {
    session.mockReturnValue(state({ google: GOOGLE, x: X }));
    const markup = await render();

    expect(markup).toContain("Dana Reader");
    expect(markup).toContain("Dana On X");
    expect(markup).toContain("@lions_reader");
    expect(markup).toContain("Sign out of Google");
    expect(markup).toContain("Sign out of X");
    /* Two accounts, not one merged identity: neither block claims the other. */
    expect(markup).not.toContain("linked");
    expect(markup).not.toContain("connected account");
  });

  it("keeps one provider's sign-in open while the other is signed in", async () => {
    session.mockReturnValue(state({ google: GOOGLE }));
    const markup = await render();

    expect(markup).toContain("Sign out of Google");
    expect(markup).toContain("Sign in with X");
    expect(markup).not.toContain("Sign out of X");
  });
});

/* ── Availability is not an error ────────────────────────────────────────── */

describe("a provider that cannot be used here", () => {
  it("states an unconfigured provider plainly, with no button to press", async () => {
    session.mockReturnValue(
      state({ availability: { google: "ready", x: "unconfigured" } }),
    );
    const markup = await render();

    expect(markup).toContain("no X application is configured");
    expect(markup).not.toContain("Sign in with X");
    /* Not dressed as a failure: the page is working. */
    expect(markup).not.toContain("Try again");
  });

  it("sends a local reader to the live site rather than starting a doomed flow", async () => {
    session.mockReturnValue(
      state({ availability: { google: "ready", x: "production-only" } }),
    );
    const markup = await render();

    expect(markup).toContain("live site only");
    expect(markup).toContain("https://lionsofzion.io/account");
    /* The decisive assertion: no local sign-in is offered, because its
       `__Host-` state cookie cannot be written over plain http and the flow
       would fail on arrival at the production callback. */
    expect(markup).not.toContain('action="/auth/x"');
  });
});

/* ── Starting the X flow is an action, not a prefetchable link ───────────── */

describe("the X sign-in control", () => {
  /* This shipped as a GET form and was a dead button in production. The site's
     CSP carries `form-action 'self' https://www.paypal.com`, and Chrome
     applies `form-action` to every hop of a submission's redirect chain:
     `/auth/x` passed as 'self', its 302 to x.com did not, and the browser
     cancelled the navigation silently. A link is not subject to `form-action`.
     Both assertions below are load-bearing; neither is style. */
  it("is a link, because `form-action` would cancel a form's redirect to X", async () => {
    session.mockReturnValue(state());
    const markup = await render();

    expect(markup).toContain('href="/auth/x"');
    expect(markup).not.toContain('action="/auth/x"');
    expect(markup).not.toMatch(/<form[^>]*\/auth\/x/);
  });

  it("does not let the router prefetch a route handler that mints state", async () => {
    session.mockReturnValue(state());
    const markup = await render();

    /* `next/link` prefetches, and prefetching `/auth/x` *runs* it: OAuth state
       minted and a `__Host-` cookie spent because a button scrolled into view.
       `documentNavigation` takes the plain-anchor branch instead. */
    const control = read("components/auth/PublicAuthControl.tsx");
    expect(control).toContain("documentNavigation");
    /* A plain anchor, so no router payload attributes ride along. */
    expect(markup).toMatch(/<a [^>]*href="\/auth\/x"/);
  });

  it("wears X's own mark, drawn inline rather than fetched from X", async () => {
    session.mockReturnValue(state());
    const markup = await render();

    expect(markup).toContain("Sign in with X");
    /* Inline SVG, no request to a provider CDN: the site's `img-src` blocks
       one, and a logo fetched from X would announce the visitor to X before
       they had chosen anything. */
    expect(markup).toContain('viewBox="0 0 1200 1227"');
    expect(markup).not.toMatch(/<img[^>]+(twimg|x\.com|twitter)/);
    /* The mark is decorative; the button's name is its text. */
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});

/* ── What a failed callback is allowed to say ────────────────────────────── */

describe("the marker the X callback sends back", () => {
  it.each([
    ["cancelled", "cancelled before it finished"],
    ["unavailable", "not available on this deployment"],
    ["failed", "could not be completed"],
  ])("turns %s into words a reader can act on", async (marker, copy) => {
    session.mockReturnValue(state());
    expect(await render({ xError: marker })).toContain(copy);
  });

  it("never renders the raw marker, and treats an unknown one as a failure", async () => {
    session.mockReturnValue(state());
    const markup = await render({ xError: "token_exchange_401_abcdef" });

    expect(markup).toContain("could not be completed");
    expect(markup).not.toContain("token_exchange_401_abcdef");
  });

  it("says nothing when the callback sent no marker", async () => {
    session.mockReturnValue(state());
    const markup = await render();

    expect(markup).not.toContain("could not be completed");
    expect(markup).not.toContain("cancelled");
  });
});

/* ── Server availability and the build-time client id can disagree ───────── */

describe("Google configured on the server but not in the bundle", () => {
  it("says so plainly instead of rendering an empty button slot", async () => {
    vi.resetModules();
    vi.doMock("@/components/auth/google-identity", () => ({
      googleIdentityClientId: () => null,
      loadGoogleIdentity: vi.fn(),
      signInWithGoogleCredential: vi.fn(),
    }));
    const { PublicAuthControl: Control } = await import(
      "@/components/auth/PublicAuthControl"
    );

    session.mockReturnValue(state());
    const stream = await renderToReadableStream(createElement(Control, {}));
    await stream.allReady;
    const markup = (await new Response(stream).text()).replaceAll("<!-- -->", "");

    expect(markup).toContain("no client ID is configured");
    expect(markup).not.toContain('aria-label="Sign in with Google"');
    /* X is unaffected: one provider's configuration is not the other's. */
    expect(markup).toContain("Sign in with X");
  });
});

/* ── The provider must actually be mounted ───────────────────────────────── */

describe("the root layout", () => {
  /* `usePublicSession` degrades to "unknown" rather than throwing when no
     provider is above it, so a tree that forgot to mount one would not crash —
     it would quietly show every reader the neutral Account link for ever.
     Nothing at runtime can tell the difference, which is why the guarantee is
     asserted here instead. */
  it("mounts the session provider around the page tree", () => {
    const layout = readFileSync(
      path.join(process.cwd(), "app/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("PublicSessionProvider");
    expect(layout).toMatch(/<PublicSessionProvider>\s*\{children\}\s*<\/PublicSessionProvider>/);
  });
});
