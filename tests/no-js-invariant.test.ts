import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";

/**
 * Every reading route must be readable with JavaScript off.
 *
 * Two mechanisms have broken this property in this repository, and both are
 * pinned here.
 *
 * **The root boundary.** A root-level `app/loading.tsx` wraps *every* route in
 * a Suspense boundary. Streaming SSR then emits the real markup inside
 * `<div hidden id="S:0">` for an inline `$RC` script to reveal — so with
 * scripting off the loading shell stays and the page never appears. It was
 * deleted for exactly that reason (`.ai/DECISIONS.md`, 2026-08-26).
 *
 * **The segment boundary.** A segment-root `loading.tsx` does the same thing
 * one level down, and on this site that is just as total: the header, the
 * navigation and the footer are mounted by `EditorialShell` *inside each page*
 * rather than by `app/layout.tsx` (see the note on the footer in
 * `EditorialShell`), so the segment boundary swallows the entire chrome and not
 * merely the page body. Seven routes carried one, and with scripting off each
 * rendered its `<title>` and nothing else — no header, no nav, no `h1`, no
 * prose. `/methodology` measured 19 characters of body text that way; without
 * the file its prerendered HTML carries over twelve thousand.
 *
 * So the file checks below are the cheap tripwire, and the renders under them
 * are the property itself.
 */
const ROOT = process.cwd();
const exists = async (p: string) =>
  access(path.join(ROOT, p)).then(
    () => true,
    () => false,
  );
const read = (rel: string) => readFile(path.join(ROOT, rel), "utf8");

/* ── The file-shape tripwire ─────────────────────────────────────────────── */

describe("the no-JavaScript invariant: boundaries nothing can resolve", () => {
  it("has no root-level loading.tsx", async () => {
    expect(
      await exists("app/loading.tsx"),
      "app/loading.tsx is back. A root Suspense boundary hides every route's " +
        "markup behind an inline script, so no page renders without JavaScript. " +
        "Scope loading state to its own segment instead — see CLAUDE.md.",
    ).toBe(false);
  });

  it("has no root-level template.tsx or default.tsx either", async () => {
    /* Same class of problem: both re-wrap the whole tree at the root. */
    for (const file of ["app/template.tsx", "app/default.tsx"]) {
      expect(await exists(file), `${file} re-wraps every route at the root`).toBe(false);
    }
  });

  it("has no segment-root loading.tsx on a reading route", async () => {
    /* Each of these shipped one, and each rendered as a bare title without
       JavaScript. An inner `<Suspense>` around the async region is the
       replacement: it streams the data and leaves the shell in the document. */
    for (const segment of [
      "methodology",
      "search",
      "updates",
      "geopolitical-brief",
      "fact-check",
      "ask",
      "articles/[publicId]",
    ]) {
      expect(
        await exists(`app/${segment}/loading.tsx`),
        `app/${segment}/loading.tsx puts this site's header, nav and footer — all ` +
          "mounted inside the page by EditorialShell — behind a Suspense boundary " +
          "only client JavaScript can resolve. Wrap the async region in a " +
          "<Suspense> inside the shell instead.",
      ).toBe(false);
    }
  });

  it("keeps the News & Analysis shell out of its own boundary", async () => {
    /* `LiveBriefHub` renders `EditorialShell`. The moment it is `async` again,
       everything it returns — masthead included — moves behind the fallback,
       which is the segment-`loading.tsx` failure rebuilt by hand. */
    const source = await read("components/briefs/LiveBriefHub.tsx");
    expect(source).toContain("export function LiveBriefHub");
    expect(source).not.toContain("export async function LiveBriefHub");
  });

  it("keeps the two DocPage desks out of their own boundary", async () => {
    for (const [file, name] of [
      ["app/updates/page.tsx", "UpdatesPage"],
      ["app/fact-check/page.tsx", "FactCheckPage"],
    ] as const) {
      const source = await read(file);
      expect(source, file).toContain(`export default function ${name}`);
      expect(source, file).not.toContain(`export default async function ${name}`);
    }
  });
});

/* ── The property itself, rendered ───────────────────────────────────────── */

/**
 * How a no-JavaScript reader is measured here.
 *
 * The naive version of this test renders the page, waits for `allReady`, and
 * splits the string at the first `<div hidden id="S:">`. It passes on broken
 * code — measured, not assumed. React buffers while nothing is reading the
 * stream, so a boundary that resolves before the first flush is written
 * *inline*, in place, and the split finds no hole at all: the pre-fix page,
 * whose entire chrome sat behind the boundary, comes back looking complete.
 *
 * So the boundary is held open instead. The reads below never resolve, the
 * stream is drained until it goes idle, and what has arrived by then is
 * exactly what a reader with scripting off is left looking at — because `$RC`
 * never runs for them either, so pending is the state they stay in. Nothing in
 * it depends on flush timing.
 */
const never = () => new Promise<never>(() => {});

const listBriefingPublications = vi.fn();
const getPublicPublication = vi.fn();

vi.mock("@/lib/publications", () => ({
  listBriefingPublications: (...args: unknown[]) => listBriefingPublications(...args),
  getPublicPublication: (...args: unknown[]) => getPublicPublication(...args),
  isMissingPublication: () => false,
}));

/* `SearchPanel` calls `useRouter`, which has no app-router context outside a
   Next render. Nothing here asserts on navigation; the stub exists so the
   client component can produce its first paint, which is what a no-JS reader
   is left with. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push() {},
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
    refresh() {},
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("notFound() was called");
  },
}));

const detailShape = {
  exactClaim: "A hospital in the north was struck on Tuesday.",
  propagators: ["An account with 400,000 followers"],
  arenas: ["X"],
  trendDirection: "rising",
  israeliPosition: null,
  securityContext: null,
  supportingEvidenceIds: ["11111111-1111-4111-8111-111111111111"],
  contradictingEvidenceIds: [],
  verificationState: "misleading",
  knownUnknowns: [],
  evidenceBasis: "sourced",
} as const;

const record = {
  publicId: "narrative-watch-hospital",
  kind: "analysis",
  section: "narrative_watch",
  title: "Reported claim: a hospital was struck",
  summary: "The footage is real and predates the strike it is offered as evidence of.",
  body: "The first passage.\n\nThe second passage.",
  language: "en",
  publishedAt: "2026-09-02T11:20:00.000Z",
  updatedAt: "2026-09-02T11:20:00.000Z",
  autoPublishedAt: "2026-09-02T11:20:00.000Z",
  editorialTopic: null,
  primaryActor: null,
  arena: "X",
  featuredIsraelStory: false,
  narrativeWatchDetails: detailShape,
} as unknown as PublicPublication;

const detail = {
  ...record,
  sources: [],
  passages: [],
  relatedArticles: [],
  narratives: [],
  corrections: [],
} as unknown as PublicPublicationDetail;

/**
 * The HTML that reaches the browser while the data is still pending.
 *
 * `renderToReadableStream` resolves as soon as the *shell* — everything
 * outside a Suspense boundary — is complete, which is the whole property under
 * test: if the component that renders `EditorialShell` is itself async, there
 * is no shell, and this call never resolves. The race turns that into a named
 * failure rather than a bare timeout.
 */
async function pendingHtml(route: string, node: unknown): Promise<string> {
  const stream = await Promise.race([
    renderToReadableStream(node as React.ReactElement, { onError: () => {} }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `${route}: the shell never completed while the read was pending. The ` +
                "component rendering EditorialShell is async, so the masthead, the " +
                "nav and the h1 are all behind the boundary — which is the " +
                "segment-loading.tsx failure by another route.",
            ),
          ),
        4_000,
      ),
    ),
  ]);
  /* The render is abandoned below; nothing waits on it finishing. */
  stream.allReady.catch(() => {});

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let html = "";
  for (;;) {
    const next = await Promise.race([
      reader.read(),
      new Promise<"idle">((resolve) => setTimeout(() => resolve("idle"), 150)),
    ]);
    if (next === "idle" || next.done) break;
    html += decoder.decode(next.value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return html;
}

/** The whole document, for the routes that hold nothing back. */
async function fullHtml(node: unknown): Promise<string> {
  const stream = await renderToReadableStream(node as React.ReactElement);
  await stream.allReady;
  return new Response(stream).text();
}

/** Readable text, with the inline scripts and styles taken out. */
function visibleText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linksIn(markup: string): string[] {
  return [...markup.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
}

/**
 * The shape every one of these routes must hold.
 *
 * `h1` and the skip link come from `EditorialShell`/`DocPage`; the link count
 * is the masthead nav, which is the difference between a page a no-JS reader
 * can leave and a dead end. The numbers are floors, not measurements — each
 * route clears them several times over, and the point is that the regression
 * takes them to zero.
 */
function expectShellRenders(route: string, markup: string) {
  expect(markup, `${route}: the skip link is not in the initial HTML`).toContain(
    "Skip to content",
  );
  expect(markup, `${route}: no h1 in the initial HTML`).toMatch(/<h1[\s>]/);
  expect(
    linksIn(markup).length,
    `${route}: the masthead navigation is not in the initial HTML`,
  ).toBeGreaterThan(8);
  expect(
    visibleText(markup).length,
    `${route}: the initial HTML carries almost no readable text`,
  ).toBeGreaterThan(200);
}

describe("the no-JavaScript invariant: the shell arrives before the data", () => {
  it("serves the News & Analysis shell while the projection read is still pending", async () => {
    listBriefingPublications.mockImplementation(never);
    const { default: Page } = await import("@/app/geopolitical-brief/page");
    const html = await pendingHtml(
      "/geopolitical-brief",
      await Page({ searchParams: Promise.resolve({}) } as never),
    );

    expectShellRenders("/geopolitical-brief", html);
    /* The desk was renamed from "The Daily Brief" to "News & Analysis"
       (commit 00240da): the visible h1 (components/briefs/LiveBriefHub.tsx:49)
       and the JSON-LD name (app/geopolitical-brief/page.tsx:23) now agree on
       it. The h1 is HTML-escaped in SSR ("News &amp; Analysis"); the JSON-LD
       script is raw text, so the JSON name is not escaped. */
    expect(html).toContain("News &amp; Analysis");
    expect(html).toContain('"name":"News & Analysis"');
    expect(html).toContain("Intelligence desk");
    /* And the read really is behind a boundary — otherwise the fallback is
       dead code and the route gained nothing but a slower first byte. The
       pending read's fallback is the desk skeleton whose status label is
       "Loading news and analysis" (LiveBriefHub.tsx:57, rendered as an
       sr-only span by SkeletonRegion). */
    expect(html).toContain("Loading news and analysis");
  });

  it("serves the /updates shell while the projection read is still pending", async () => {
    listBriefingPublications.mockImplementation(never);
    const { default: Page } = await import("@/app/updates/page");
    const html = await pendingHtml(
      "/updates",
      Page({ searchParams: Promise.resolve({}) } as never),
    );

    expectShellRenders("/updates", html);
    expect(html).toContain("Everything this desk has published");
    expect(html).toContain("Loading the record");
  });

  it("serves the /fact-check shell while the projection read is still pending", async () => {
    listBriefingPublications.mockImplementation(never);
    getPublicPublication.mockImplementation(never);
    const { default: Page } = await import("@/app/fact-check/page");
    const html = await pendingHtml(
      "/fact-check",
      Page({ searchParams: Promise.resolve({}) } as never),
    );

    expectShellRenders("/fact-check", html);
    expect(html).toContain("Claims in circulation");
    expect(html).toContain("Loading the checked claims");
  });
});

describe("the no-JavaScript invariant: the routes that hold nothing back", () => {
  it("renders /search complete, with its no-JS index", async () => {
    const { default: Page } = await import("@/app/search/page");
    const html = await fullHtml(await Page({ searchParams: Promise.resolve({}) } as never));

    expectShellRenders("/search", html);
    /* Nothing on this route is read from the server, so there is nothing to
       stream and nothing may be held back. */
    expect(html).not.toContain('<div hidden id="S:');
    expect(html).toContain("Search runs in your browser");
  });

  it("renders /ask complete, with its no-JS explanation", async () => {
    const { default: Page } = await import("@/app/ask/page");
    const html = await fullHtml(Page());

    expectShellRenders("/ask", html);
    expect(html).not.toContain('<div hidden id="S:');
    expect(html).toContain("needs JavaScript");
  });

  it("renders an article complete: its headline is the data", async () => {
    getPublicPublication.mockResolvedValue(detail);
    const { default: Page } = await import("@/app/articles/[publicId]/page");
    const html = await fullHtml(
      await Page({ params: Promise.resolve({ publicId: record.publicId }) } as never),
    );

    expectShellRenders("/articles/[publicId]", html);
    /* Deliberately not streamed. Every element of this page — the `h1`, the
       breadcrumb's last crumb, the whole body — is the record, so there is no
       static prose to hoist above a boundary; and `notFound()` has to settle
       before the response head is written, or a missing record answers 200
       with a not-found body. So the page awaits, and the reader gets all of it
       at once. */
    expect(html).not.toContain('<div hidden id="S:');
    expect(html).toContain("a hospital was struck");
  });
});

/* ── /methodology: prerendered, and nothing to stream ────────────────────── */

describe("the no-JavaScript invariant: /methodology stays static", () => {
  it("awaits nothing, so a skeleton there could only ever be pure loss", async () => {
    /* This route reads no data at build time or at request time — `next build`
       marks it `○ (Static)`. It was still carrying `SkeletonInstitution` behind
       a segment boundary, which cost the whole page its no-JS render in order
       to stand in for content that was already prerendered. */
    const source = await read("app/methodology/page.tsx");
    expect(source).not.toMatch(/\bawait\b/);
    expect(source).not.toMatch(/\basync\b/);
  });
});
