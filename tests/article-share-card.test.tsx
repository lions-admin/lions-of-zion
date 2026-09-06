/**
 * The article share card — `app/articles/[publicId]/opengraph-image.tsx`.
 *
 * Two things are being held here. The first is that the card is the *only*
 * Open Graph image a crawler sees: file-based metadata overrides
 * `generateMetadata`, so the `openGraph.images` that `page.tsx` computes from
 * the article's hero never reaches anyone. The hero has to be drawn onto this
 * card or it is not shared at all.
 *
 * The second is the failure mode that fix introduces. Handing satori a URL it
 * cannot load fails the whole render, which would turn a card that always
 * worked into a 500 — and no card is worse than a plain one. The picture is
 * therefore fetched here, and every failure path falls back to the
 * typographic card rather than throwing.
 */
import { describe, expect, it, vi } from "vitest";

const hero = {
  id: "a".repeat(32),
  src: "https://blob.example.com/publications/media/hero.png",
  width: 1200, height: 630, alt: "A published photograph", caption: null,
  credit: "Lions of Zion", sourceUrl: null, disclosure: null,
  role: "editorial-illustration", focalPoint: { x: 50, y: 50 }, sensitivity: "safe",
  rights: { status: "cleared", basis: "Original editorial illustration", reference: "test", clearedAt: "2026-09-01", surfaces: ["homepage", "article"] },
};

const article = {
  publicId: "og-card", section: "news", title: "A published editorial report",
  publishedAt: "2026-09-06T07:00:00.000Z", updatedAt: "2026-09-06T07:00:00.000Z",
  narrativeWatchDetails: null, media: hero,
};

vi.mock("@/lib/publications", () => ({ getPublicPublication: async () => article }));

const { default: ShareCard } = await import("@/app/articles/[publicId]/opengraph-image");

/** A one-pixel PNG: enough for satori to decode, small enough to inline. */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/* `@vercel/og` fetches its own WebAssembly and font assets through the same
   global, so only the hero request may be intercepted. */
function stubHeroFetch(respond: () => Promise<Response>) {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes("blob.example.com") ? respond() : real(input as never, init)));
}

const render = () => ShareCard({ params: Promise.resolve({ publicId: "og-card" }) });

describe("article share card", () => {
  it("draws the article's own hero onto the card", async () => {
    stubHeroFetch(async () => new Response(png, { headers: { "content-type": "image/png" } }));
    const response = await render();
    expect(response.headers.get("content-type")).toContain("image/png");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 60000);

  it("still renders a card when the hero cannot be fetched", async () => {
    stubHeroFetch(async () => { throw new Error("blob unreachable"); });
    const response = await render();
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 60000);

  it("still renders a card when the hero is a format satori cannot decode", async () => {
    stubHeroFetch(async () => new Response(png, { headers: { "content-type": "image/avif" } }));
    const response = await render();
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 60000);
});
