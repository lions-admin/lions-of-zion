import { describe, expect, it } from "vitest";
import { parseFeed } from "@/server/modules/sources/connectors/rss";

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Wire</title>
    <item>
      <title>Border incident reported</title>
      <link>https://example.org/a</link>
      <guid>urn:example:a</guid>
      <description>A short summary of the incident.</description>
      <pubDate>Mon, 24 Aug 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Follow-up statement issued</title>
      <link>https://example.org/b</link>
      <description>No guid on this one.</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry>
    <title>A statement was published</title>
    <id>urn:example:atom-1</id>
    <link href="https://example.org/atom-1" rel="alternate"/>
    <summary>An Atom entry summary.</summary>
    <published>2026-08-24T10:00:00Z</published>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dwsyn="http://rss.dw.com/syndication/dwsyn/">
  <item rdf:about="https://example.org/rdf-1">
    <title>World report with Israel context</title>
    <link>https://example.org/rdf-1</link>
    <description>An RSS 1.0 description.</description>
    <dc:date>2026-08-31T09:18:38Z</dc:date>
    <dwsyn:contentID>78560116</dwsyn:contentID>
  </item>
</rdf:RDF>`;

describe("RSS/Atom feed parsing", () => {
  it("parses RSS 2.0 items, preferring the guid as the external id", () => {
    const items = parseFeed(RSS2);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "urn:example:a",
      title: "Border incident reported",
      url: "https://example.org/a",
      excerpt: "A short summary of the incident.",
    });
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });

  it("falls back to the link when an item has no guid", () => {
    const items = parseFeed(RSS2);
    expect(items[1]!.externalId).toBe("https://example.org/b");
  });

  it("parses Atom entries", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "urn:example:atom-1",
      title: "A statement was published",
      url: "https://example.org/atom-1",
      excerpt: "An Atom entry summary.",
    });
  });

  it("parses RSS 1.0 RDF items", () => {
    const items = parseFeed(RDF);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "78560116",
      title: "World report with Israel context",
      url: "https://example.org/rdf-1",
      excerpt: "An RSS 1.0 description.",
    });
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });

  it("returns nothing for a document that is neither RSS nor Atom", () => {
    expect(parseFeed("<not-a-feed><x>1</x></not-a-feed>")).toEqual([]);
  });

  it("derives a stable id from the title when both guid and link are absent", () => {
    const noId = `<rss version="2.0"><channel><item><title>Only a title</title></item></channel></rss>`;
    const items = parseFeed(noId);
    expect(items[0]!.externalId).toMatch(/^[a-f0-9]{32}$/);
  });
});
