import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";

const { publication } = vi.hoisted(() => ({ publication: {
  publicId: "daily-brief-2026-08-31",
  title: "Daily Brief",
  summary: "A verified daily update.",
  section: "daily_brief",
  kind: "brief",
  body: "Article body.",
  status: "published",
  publishedAt: "2026-08-31T07:00:00.000Z",
  updatedAt: "2026-08-31T08:15:00.000Z",
  autoPublishedAt: "2026-08-31T07:00:00.000Z",
  passages: [],
  sources: [],
  narratives: [],
  relatedArticles: [],
  corrections: [],
} as const }));

vi.mock("@/lib/publications", () => ({
  getPublicPublication: vi.fn().mockResolvedValue(publication),
  isMissingPublication: () => false,
}));

import ArticlePage, { collapsePublicPassages, generateMetadata } from "@/app/articles/[publicId]/page";

describe("article structured data", () => {
  it("collapses repeated public passages without hiding a distinct claim", () => {
    const base = { claim: { publicId: "claim-1", title: "Claim", assessment: "unresolved" }, sources: [{ title: "Source", publisher: "Source", url: "https://source.example/a" }] };
    const passages = collapsePublicPassages([
      { ...base, position: 1, text: "The source reports a regional security update after a Sunday meeting." },
      { ...base, position: 2, text: "The source reports a new regional security update following the Sunday meeting." },
      { ...base, position: 3, text: "The source separately reports that independent verification remains unavailable." },
    ]);
    expect(passages).toHaveLength(2);
    expect(passages.map((passage) => passage.position)).toEqual([1, 3]);
  });

  const props = { params: Promise.resolve({ publicId: publication.publicId }) };

  it("publishes one canonical NewsArticle record with the stored dates", async () => {
    const stream = await renderToReadableStream(await ArticlePage(props));
    await stream.allReady;
    const markup = await new Response(stream).text();
    const match = markup.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    expect(match?.[1]).toBeTruthy();
    const jsonLd = JSON.parse(match![1]!);

    expect(jsonLd).toMatchObject({
      "@type": "NewsArticle",
      datePublished: publication.publishedAt,
      dateModified: publication.updatedAt,
      mainEntityOfPage: "https://lionsofzion.io/articles/daily-brief-2026-08-31",
    });
    expect(markup.match(/https:\/\/lionsofzion\.io\/articles\/daily-brief-2026-08-31/g)).toHaveLength(1);
  });

  it("uses the same single canonical URL in page metadata", async () => {
    const metadata = await generateMetadata(props);
    expect(metadata.alternates?.canonical).toBe("https://lionsofzion.io/articles/daily-brief-2026-08-31");
    expect(metadata.openGraph).toMatchObject({
      publishedTime: publication.publishedAt,
      modifiedTime: publication.updatedAt,
    });
  });
});
