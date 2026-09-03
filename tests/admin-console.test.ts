/**
 * ADMIN-002, STATE-004, AUTH-001 — the three acceptance clauses on the
 * operations console that nothing was checking.
 *
 * All three fail silently. A destructive control that opens no confirmation
 * still deletes. A focus fallback pointed at a non-focusable element still
 * type-checks, still renders, and simply does nothing on the one path it
 * exists for. An identifier field with the wrong `autocomplete` token still
 * submits — a password manager just stops offering to fill or to save, which
 * nobody notices until they are locked out of the one account this deployment
 * has.
 *
 * **How each claim here is obtained, because that matters more than the
 * count of assertions:**
 *
 *  - *Rendered*: the component is run through `renderToReadableStream` in a
 *    node environment, the pattern `tests/state-causes.test.ts` and
 *    `tests/live-surfaces.test.ts` already use, and the assertion is made
 *    against real markup. Everything on `/admin/login` and every state of
 *    `ConfirmDialog` is reachable this way, because both render their whole
 *    surface on first paint.
 *  - *Source*: the property needs a DOM, an event, or a layout pass, so it is
 *    pinned as a structural assertion over the files instead and is named as
 *    such on the test. `/admin` itself renders a skeleton until its effects
 *    run, so its loaded console is in this second group.
 *
 * Keyboard order is settled by the two facts that together determine it, both
 * checkable here: tab order follows DOM order in the absence of a positive
 * `tabindex`, and it keeps following DOM order even when CSS reorders a flex
 * or grid line — which is exactly what makes `order` and `-reverse` the
 * classic way for visual order and keyboard order to come apart. So: no
 * positive tabindex, and no reordering CSS on the surface.
 */
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";

/* Both admin client components call `useRouter`, which has no app-router
   context outside a Next render. Nothing here asserts on navigation. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, forward() {}, refresh() {} }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

/* `createAuthClient()` runs at module scope in both the sign-in form and the
   sign-out control and wants a configured deployment. The console's markup
   does not depend on it. */
vi.mock("@neondatabase/auth/next", () => ({
  createAuthClient: () => ({
    signIn: { email: async () => ({ error: null }) },
    signUp: { email: async () => ({ error: null }) },
    signOut: async () => {},
  }),
}));

const { AdminLogin } = await import("@/app/admin/login/AdminLogin");
const { default: AdminLoginPage } = await import("@/app/admin/login/page");
const { default: AdminPage } = await import("@/app/admin/page");
const { ConfirmDialog } = await import("@/app/admin/ConfirmDialog");
type ConfirmIntent = Parameters<typeof ConfirmDialog>[0]["intent"];

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

async function render(node: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

/** React splits interpolated text with an empty comment. */
const prose = (markup: string) => markup.replaceAll("<!-- -->", "");

/**
 * React's SSR stream writes DOM-property spellings verbatim —
 * `autoComplete="username"`, `spellCheck="false"`, `minLength="8"`. HTML
 * attribute names are ASCII case-insensitive and the parser lowercases them,
 * so what reaches the document is `autocomplete`, which is what a password
 * manager reads; confirmed in Chromium, see the note in the report for this
 * task. Attribute assertions here therefore compare case-insensitively rather
 * than pinning a spelling React chose.
 */
const attr = (tag: string, name: string, value: string) =>
  new RegExp(`\\b${name}="${value}"`, "i").test(tag);

/** Strips block comments, so a rule or a prohibition that names the thing it
 *  forbids is not mistaken for the thing itself. */
const uncommented = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ADMIN_SOURCES = [
  "app/admin/page.tsx",
  "app/admin/AdminStatus.tsx",
  "app/admin/PublicationManager.tsx",
  "app/admin/ConfirmDialog.tsx",
  "app/admin/SignOutButton.tsx",
  "app/admin/login/page.tsx",
  "app/admin/login/AdminLogin.tsx",
] as const;

/** The index at which the first match starts, or -1. Used to compare the
 *  positions of two things in one rendered document. */
const at = (markup: string, needle: string | RegExp) =>
  typeof needle === "string" ? markup.indexOf(needle) : markup.search(needle);

/* ── AUTH-001: the password-manager contract ──────────────────────────────
   The acceptance clause is "password-manager/autocomplete behaviour
   preserved". A manager recognises a login form by one pair of tokens and
   fills it once; a field that is remounted between renders defeats both. */

describe("AUTH-001 — the sign-in form as a password manager sees it (rendered)", () => {
  it("offers the login pair a manager keys on: username with current-password", async () => {
    const markup = await render(createElement(AdminLogin));

    const identifier = markup.match(/<input[^>]*name="email"[^>]*>/)?.[0];
    const password = markup.match(/<input[^>]*name="password"[^>]*>/)?.[0];
    expect(identifier, "the identifier input is rendered on first paint").toBeTruthy();
    expect(password, "the password input is rendered on first paint").toBeTruthy();

    /* `username` is the field-name token for the identifier half of a
       sign-in pair. `email` describes an email address in a contact form and
       is not what a manager pairs with `current-password`. */
    expect(attr(identifier!, "autocomplete", "username")).toBe(true);
    expect(attr(identifier!, "type", "email")).toBe(true);
    expect(attr(password!, "autocomplete", "current-password")).toBe(true);
    expect(attr(password!, "type", "password")).toBe(true);
  });

  it("keeps both fields inside one real form, in the order a manager fills them", async () => {
    const markup = await render(createElement(AdminLogin));

    /* One form. A manager that finds a password field with no form, or two
       forms sharing the pair, will not offer to save. */
    expect(markup.match(/<form/g)).toHaveLength(1);

    const formStart = at(markup, "<form");
    const formEnd = at(markup, "</form>");
    const identifierAt = at(markup, /<input[^>]*name="email"/);
    const passwordAt = at(markup, /<input[^>]*name="password"/);
    expect(identifierAt).toBeGreaterThan(formStart);
    expect(passwordAt).toBeLessThan(formEnd);
    expect(identifierAt).toBeLessThan(passwordAt);
  });

  it("submits through the form rather than a bare click handler", async () => {
    const markup = await render(createElement(AdminLogin));
    /* Sign in is a `type="submit"` inside the form, so Enter in either field
       is a sign-in — the path a manager drives after filling. */
    const signIn = markup.match(/<button[^>]*value="signin"[^>]*>/)?.[0];
    expect(signIn).toBeTruthy();
    expect(signIn).toContain('type="submit"');
    expect(at(markup, /<button[^>]*value="signin"/)).toBeLessThan(at(markup, "</form>"));
  });

  it("keeps first-time setup out of the sign-in block without splitting the form", async () => {
    const markup = await render(createElement(AdminLogin));
    const formId = markup.match(/<form[^>]*\bid="([^"]+)"/)?.[1];
    expect(formId, "the form carries the id the bootstrap button points at").toBeTruthy();

    const bootstrap = markup.match(/<button[^>]*value="signup"[^>]*>/)?.[0];
    expect(bootstrap).toBeTruthy();
    /* Outside the form in the document, associated by `form=`. That keeps it
       out of the sign-in block visually and in tab order while remaining the
       submit event's `submitter`, which is what the branch in `submit()`
       reads. */
    expect(bootstrap).toContain(`form="${formId}"`);
    expect(at(markup, /<button[^>]*value="signup"/)).toBeGreaterThan(at(markup, "</form>"));
    /* And it is reached after sign in, never before it. */
    expect(at(markup, /<button[^>]*value="signin"/)).toBeLessThan(at(markup, /<button[^>]*value="signup"/));
  });

  it("mounts both announcement regions before either has anything to say", async () => {
    const markup = await render(createElement(AdminLogin));
    /* A live region inserted in the same commit as its text is announced
       unreliably, so both are in the first paint and both are empty. */
    expect(markup).toMatch(/<p[^>]*role="alert"[^>]*><\/p>/);
    expect(markup).toMatch(/<p[^>]*role="status"[^>]*aria-live="polite"[^>]*><\/p>/);
  });

  it("never remounts a field between renders", () => {
    const source = read("app/admin/login/AdminLogin.tsx");
    const form = source.slice(source.indexOf("<form"), source.indexOf("</form>"));
    /* A `key` on a field, or a field mounted behind a condition, makes React
       tear the input down and build a new one — a manager's fill is lost and
       it is asked to fill again. Neither appears in the sign-in block. */
    expect(form).not.toMatch(/<Field[^>]*\bkey=/);
    expect(form).not.toMatch(/\?\s*<Field/);
    expect(form).not.toMatch(/&&\s*<Field/);
  });

  it("reads the submission before the first state change disables the fields", () => {
    const source = read("app/admin/login/AdminLogin.tsx");
    const body = source.slice(source.indexOf("async function submit"));
    /* `disabled` controls are dropped from a `FormData` built after the
       re-render. The read has to come first, and it does. */
    expect(body.indexOf("new FormData(event.currentTarget)")).toBeLessThan(body.indexOf("setPending("));
  });
});

describe("AUTH-001 — the sign-in surface states its language (rendered)", () => {
  it("declares lang=en on the sign-in surface itself", async () => {
    const markup = await render(await AdminLoginPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toMatch(/<main[^>]*lang="en"/);
  });

  it("names the account-not-linked case as guidance rather than as a failure", async () => {
    const markup = prose(await render(
      await AdminLoginPage({ searchParams: Promise.resolve({ error: "account_not_linked" }) }),
    ));
    expect(markup).toContain("not linked to the administrator account yet");
    /* Guidance, not an alert: the operator is not stuck, they have a next
       step, and an assertive region would interrupt to say so. */
    expect(markup.match(/role="alert"[^>]*>[^<]/)).toBeNull();
  });
});

/* ── STATE-004: one confirmation, and what it must say ────────────────────
   "Action, target, consequence and cancel are explicit" is four things, and
   the failure mode is that three of them are present and one is not. */

const intent = {
  action: "Delete this publication permanently",
  target: "Reported claim: a hospital was struck",
  targetDetail: "narrative-watch-hospital · Narrative Watch · Archived",
  consequence:
    "The publication and its version history are deleted and cannot be restored from this console.",
  confirmLabel: "Delete permanently",
  tone: "danger",
  run: () => {},
} satisfies NonNullable<ConfirmIntent>;

describe("STATE-004 — the destructive confirmation (rendered)", () => {
  it("renders nothing at all when no confirmation is pending", async () => {
    const markup = await render(createElement(ConfirmDialog, { intent: null, onClose: () => {} }));
    expect(markup).toBe("");
  });

  it("states action, target, consequence and a cancel — all four, always", async () => {
    const markup = prose(await render(
      createElement(ConfirmDialog, { intent, onClose: () => {} }),
    ));

    /* The action names the dialog, so it is the first thing announced. */
    const titleId = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(markup).toMatch(new RegExp(`<h2[^>]*id="${titleId}"[^>]*>${intent.action}`));

    for (const term of ["Action", "Target", "Consequence"]) {
      expect(markup, `${term} is one of the three labelled rows`).toContain(`<dt>${term}</dt>`);
    }
    expect(markup).toContain(intent.target);
    expect(markup).toContain(intent.targetDetail);
    expect(markup).toContain(intent.consequence);

    /* The confirming control repeats the verb. "OK" confirms nothing. */
    expect(markup).toContain(intent.confirmLabel);
    expect(markup).toContain(">Cancel<");
  });

  it("puts cancel before confirm, so the safe control is the one Tab reaches first", async () => {
    const markup = await render(createElement(ConfirmDialog, { intent, onClose: () => {} }));
    /* DOM order is tab order here — see the CSS assertions below, and
       `dialog.module.css`'s footer is `justify-content: flex-end`, which
       moves the pair as a block without reordering it. */
    expect(at(markup, ">Cancel<")).toBeLessThan(at(markup, `>${intent.confirmLabel}<`));
  });

  it("offers a way out that names itself as a way out", async () => {
    const markup = await render(createElement(ConfirmDialog, { intent, onClose: () => {} }));
    /* The header control on a destructive confirmation is not a neutral
       "Close" — dismissing it is a cancel, and it says so. */
    expect(markup).toContain('aria-label="Cancel and close"');
  });

  it("uses the danger variant for anything not explicitly marked routine", async () => {
    const danger = await render(createElement(ConfirmDialog, { intent, onClose: () => {} }));
    const primary = await render(createElement(ConfirmDialog, {
      intent: { ...intent, tone: "primary" as const },
      onClose: () => {},
    }));
    /* `tone` defaults to danger: an intent that forgets to say what it is
       gets the cautious treatment, not the cheerful one. */
    expect(danger).not.toBe(primary);
    expect(await render(createElement(ConfirmDialog, {
      intent: { ...intent, tone: undefined },
      onClose: () => {},
    }))).toBe(danger);
  });
});

describe("STATE-004 — one implementation, used by every destructive action (source)", () => {
  const sources = new Map(ADMIN_SOURCES.map((file) => [file, read(file)] as const));

  it("leaves no bespoke confirm anywhere under app/admin", () => {
    for (const [file, source] of sources) {
      /* `window.confirm` cannot name a target, cannot state a consequence,
         and blocks the main thread. Comments are stripped first, because the
         file that replaced it says so in its own header. */
      const code = uncommented(source);
      expect(code, `${file} uses the shared confirmation`).not.toMatch(/\bwindow\.confirm\b/);
      expect(code, `${file} uses the shared confirmation`).not.toMatch(/(?<![.\w])confirm\s*\(/);
    }
  });

  it("routes every danger-variant control through an intent", () => {
    /* A `<Button …>` opening tag cannot be matched by "up to the first `>`":
       `onClick={() => …}` contains one. Scan to the first `>` that is not the
       tail of an arrow. */
    const openingTags = (source: string) => {
      const tags: string[] = [];
      for (let index = source.indexOf("<Button"); index !== -1; index = source.indexOf("<Button", index + 1)) {
        let cursor = index;
        while (cursor < source.length) {
          cursor = source.indexOf(">", cursor + 1);
          if (cursor === -1) break;
          if (source[cursor - 1] !== "=") break;
        }
        if (cursor !== -1) tags.push(source.slice(index, cursor + 1));
      }
      return tags;
    };

    /* Does `name` end at `setConfirmIntent`? Either it is a local function
       that opens one, or it is a prop bound to such a function at the one
       call site in this file. One hop is enough for this console and a
       second would start guessing. */
    const opensAConfirmation = (source: string, name: string): boolean => {
      const declared = source.indexOf(`function ${name}`);
      if (declared !== -1) {
        const body = source.slice(declared);
        return body.slice(0, body.indexOf("\n  }")).includes("setConfirmIntent(");
      }
      const bound = source.match(new RegExp(`${name}=\\{(\\w+)\\}`))?.[1];
      return bound ? opensAConfirmation(source, bound) : false;
    };

    for (const [file, source] of sources) {
      const destructive = openingTags(source).filter((tag) => tag.includes('variant="danger"'));
      if (destructive.length === 0) continue;

      expect(source, `${file} reaches the shared confirmation`).toMatch(/ConfirmDialog/);
      for (const tag of destructive) {
        const handler = tag.match(/onClick=\{(?:\([^)]*\)\s*=>\s*)?(\w+)/)?.[1];
        expect(handler, `a danger control in ${file} has a named handler`).toBeTruthy();
        expect(
          opensAConfirmation(source, handler!),
          `${handler} in ${file} opens a confirmation rather than acting straight away`,
        ).toBe(true);
      }
    }
  });

  it("confirms what reaches readers, not only what is styled as dangerous", () => {
    /* The acceptance clause is "dangerous", and `variant="danger"` is only
       the visual half of that. Publishing and pausing publication are not
       styled red — pausing is the cautious move and publishing is the
       ordinary one — but both change what the public sees, and both are the
       kind of thing an operator should not be able to do by landing on a
       button. Each is checked by name, so a rebuild that quietly drops one
       fails here rather than in Production. */
    const status = read("app/admin/AdminStatus.tsx");
    const queue = read("app/admin/PublicationManager.tsx");

    for (const [file, source, handler] of [
      ["AdminStatus.tsx", status, "requestPublicationControl"],
      ["AdminStatus.tsx", status, "requestEditionPublication"],
      ["AdminStatus.tsx", status, "requestForcedRerun"],
      ["PublicationManager.tsx", queue, "requestTransition"],
      ["PublicationManager.tsx", queue, "requestArchive"],
      ["PublicationManager.tsx", queue, "requestDelete"],
    ] as const) {
      const declared = source.indexOf(`function ${handler}`);
      expect(declared, `${handler} exists in ${file}`).toBeGreaterThan(-1);
      const body = source.slice(declared);
      const scope = body.slice(0, body.indexOf("\n  }"));
      expect(scope, `${handler} opens a confirmation`).toContain("setConfirmIntent(");

      /* And every intent it can build carries all four parts. A handler with
         two branches — pause and resume, publish and publish-update — is
         where one of them quietly loses its consequence, so the four keys are
         counted rather than merely found: `action` appears n times, and so
         must the other three. */
      const count = (key: string) => [...scope.matchAll(new RegExp(`(?<![\\w.])${key}:`, "g"))].length;
      const branches = count("action");
      expect(branches, `${handler} builds at least one intent`).toBeGreaterThan(0);
      for (const key of ["target", "consequence", "confirmLabel"]) {
        expect(count(key), `every intent in ${handler} states ${key}`).toBe(branches);
      }
    }

    /* The status transition that reaches the public is the one that asks;
       the rest move between internal states and do not. */
    expect(queue).toMatch(/if \(to !== "published"\)[\s\S]{0,80}return;/);
  });

  it("gives every confirmation a focus fallback that can actually take focus", () => {
    let checked = 0;
    for (const [file, source] of sources) {
      /* `ConfirmDialog.tsx` declares and forwards the prop; the consumers are
         the files that also own the ref. */
      if (file.endsWith("ConfirmDialog.tsx")) continue;
      const refs = [...source.matchAll(/fallbackFocusRef=\{(\w+)\}/g)].map((match) => match[1]);
      for (const ref of refs) {
        expect(source, `${ref} is a ref declared in ${file}`).toMatch(
          new RegExp(`const ${ref} = useRef`),
        );
        /* The element the ref is attached to has to be focusable, or
           `focus()` is a silent no-op and the fallback is decorative. This is
           the assertion that would have caught `controlBar` — a plain `<div>`
           with no `tabIndex` — sitting in this slot since the rebuild. */
        const host = source.match(
          new RegExp(`<[a-zA-Z]+(?:(?!<)[\\s\\S])*?ref=\\{${ref}\\}(?:(?!<)[\\s\\S])*?>`),
        );
        expect(host, `${ref} in ${file} is attached to an element`).toBeTruthy();
        expect(host![0], `${ref} in ${file} is focusable`).toContain("tabIndex={-1}");
        checked += 1;
      }
    }
    /* Both consoles pass one, and a console that stopped passing one would
       otherwise slip through this loop in silence. */
    expect(checked).toBe(2);
  });

  it("restores focus once, on unmount, rather than on each of five close paths", () => {
    const source = read("app/admin/ConfirmDialog.tsx");
    /* Escape, the close control, Cancel, the backdrop and a completed action
       all end in the same unmount, so one restore covers all five. The
       opener is captured during the first render, before `Dialog`'s effect
       moves focus into the panel. */
    expect(source).toMatch(/document\.activeElement/);
    expect(source).toMatch(/requestAnimationFrame/);
    expect(source).toMatch(/isConnected/);
    expect(source).toMatch(/fallback\?\.focus\(\)/);
    /* Remounted per intent, so a second confirmation never restores focus to
       the opener of the first. */
    expect(source).toMatch(/key=\{`\$\{intent\.action\}::\$\{intent\.target\}`\}/);
  });
});

/* ── ADMIN-002: information architecture and keyboard order ─────────────── */

describe("ADMIN-002 — the console header (rendered)", () => {
  it("gives the operator a way to end the session, in the header", async () => {
    const markup = prose(await render(createElement(AdminPage)));
    /* `SignOutButton` was written for this slot and imported nowhere, so the
       rebuilt console had no sign-out control at all. */
    expect(markup).toContain("Sign out");
  });

  it("reads and tabs in the same sequence: heading, map, sign out", async () => {
    const markup = prose(await render(createElement(AdminPage)));
    const heading = at(markup, "<h1");
    const map = at(markup, "System architecture map");
    const signOut = at(markup, "Sign out");
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(map);
    expect(map).toBeLessThan(signOut);
  });

  it("declares the console's language on the console itself", async () => {
    const markup = await render(createElement(AdminPage));
    expect(markup).toMatch(/<main[^>]*lang="en"/);
  });
});

describe("ADMIN-002 — keyboard order matches visual layout (source)", () => {
  /* Two facts settle this together. Tab visits focusable elements in DOM
     order unless a positive `tabindex` overrides it; and CSS that reorders a
     flex or grid line moves what the eye sees while leaving DOM order — and
     therefore tab order — exactly where it was. So a surface with neither has
     tab order equal to visual order by construction. */

  it("never overrides tab order with a positive tabindex", () => {
    for (const file of ADMIN_SOURCES) {
      const source = read(file);
      const values = [...source.matchAll(/tabIndex=\{(-?\d+)\}/g)].map((match) => Number(match[1]));
      for (const value of values) {
        expect(value, `${file} uses only 0 or -1 for tabIndex`).toBeLessThanOrEqual(0);
      }
      expect(source, `${file} does not set tabindex as a string attribute`)
        .not.toMatch(/tabindex="[1-9]/);
    }
  });

  it("never reorders a line in the console stylesheet", () => {
    const rules = uncommented(read("app/admin/admin.module.css"));

    expect(rules, "no `order` property").not.toMatch(/(^|[;{\s])order\s*:/);
    expect(rules, "no reversed flex or grid direction")
      .not.toMatch(/(flex-direction|flex-flow|grid-auto-flow)\s*:[^;]*reverse/);
    expect(rules, "no reversed wrap").not.toMatch(/flex-wrap\s*:\s*wrap-reverse/);
    expect(rules, "no right-to-left run").not.toMatch(/direction\s*:\s*rtl/);
    expect(rules, "no float").not.toMatch(/(^|[;{\s])float\s*:/);

    /* Explicit grid placement can move an item away from its source position,
       so the exceptions are enumerated rather than allowed as a class. Both
       are `.logList span` — the status pill taking the left column across
       both rows of a log entry, and the reset that undoes it in one column —
       and a log entry holds a span, a strong and a small: no focusable
       descendant, so nothing that has a tab position to disagree with. */
    const placements = [...rules.matchAll(/([^{}]+)\{[^}]*\b(?:grid-row|grid-column|grid-area)\s*:/g)]
      .map((match) => match[1].trim().split("\n").pop()!.trim());
    expect(placements).toEqual([".logList span", ".logList span"]);
  });

  it("takes nothing interactive out of the flow", () => {
    const css = uncommented(read("app/admin/admin.module.css"));
    /* Absolute or fixed positioning is the other way visual order and DOM
       order come apart. The console has exactly one such rule and it is the
       visually-hidden live region, which holds nothing focusable. */
    const positioned = [...css.matchAll(/\.([A-Za-z][\w-]*)\s*\{[^}]*position\s*:\s*(absolute|fixed)/g)]
      .map((match) => match[1]);
    expect(positioned).toEqual(["consolePending"]);
  });

  it("keeps irreversible controls last in the reading order of their own area", () => {
    for (const file of ["app/admin/AdminStatus.tsx", "app/admin/PublicationManager.tsx"]) {
      const source = read(file);
      const zone = source.indexOf("styles.dangerZone");
      expect(zone, `${file} has a danger zone`).toBeGreaterThan(-1);

      /* Last in its *area*, not last in the file: the console's pipeline
         danger zone is followed by the whole Sources section, which is
         routine work in a different area. The boundary is the next named
         area, or the end of the component. A routine control between the
         danger zone and that boundary is one an operator tabs *through* on
         the way past something irreversible. */
      const boundary = source.indexOf("<section", zone);
      const area = source.slice(zone, boundary === -1 ? undefined : boundary);
      expect(area.match(/variant="(primary|secondary)"/),
        `${file} places no routine control after the danger zone in its area`).toBeNull();
    }
  });

  it("names the console's areas, so the sequence is one an operator can predict", () => {
    const status = read("app/admin/AdminStatus.tsx");
    const queue = read("app/admin/PublicationManager.tsx");
    /* ADMIN-002's information architecture: system status, pipeline,
       sources, then the publication queue and its editor. Each is a labelled
       `<section>`, in that order, and tab order follows it. */
    const order = ["console-status", "console-pipeline", "console-sources"];
    let previous = -1;
    for (const id of order) {
      const position = status.indexOf(`id="${id}"`);
      expect(position, `${id} is a named area`).toBeGreaterThan(previous);
      expect(status).toContain(`aria-labelledby="${id}-heading"`);
      previous = position;
    }
    expect(queue).toContain('id="console-queue"');
    expect(queue).toContain('aria-labelledby="console-queue-heading"');
  });
});
