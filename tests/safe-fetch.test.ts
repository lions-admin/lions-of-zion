import { describe, expect, it, vi } from "vitest";
import { assertSafePublicUrl, safeFetchText } from "@/server/core/safe-fetch";
import { bucketForSubject, OUTBOUND_SOURCE_DOMAIN, OUTBOUND_SOURCE_GLOBAL } from "@/server/core/rate-limit";
import { normalizePublicUrl } from "@/server/core/url-normalization";

const publicResolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) as never;

describe("safe source fetching", () => {
  it("uses non-reversible shared buckets for global and publisher ceilings", () => {
    expect(bucketForSubject("outbound-source-global", "all")).toMatch(/^outbound-source-global:[a-f0-9]{32}$/);
    expect(bucketForSubject("outbound-source-domain", "example.org")).not.toContain("example.org");
    expect(OUTBOUND_SOURCE_GLOBAL.limit).toBeGreaterThan(OUTBOUND_SOURCE_DOMAIN.limit);
    expect(OUTBOUND_SOURCE_DOMAIN.windowSeconds).toBe(60);
  });

  it("removes tracking parameters while preserving editorial parameters", () => {
    expect(normalizePublicUrl(
      "HTTPS://Example.ORG:443/story/?utm_source=x&chapter=2&fbclid=abc#section",
    )).toBe("https://example.org/story?chapter=2");
  });

  it.each([
    "http://127.0.0.1/feed",
    "http://10.0.0.2/feed",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/feed",
    "http://metadata.google.internal/computeMetadata/v1",
  ])("rejects local or metadata URL %s", async (url) => {
    await expect(assertSafePublicUrl(url, publicResolver)).rejects.toThrow(/not allowed|private|local/i);
  });

  it("rejects a public URL that redirects to a private address", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    })) as never;
    await expect(safeFetchText("https://example.org/feed", {
      accept: "application/xml",
      allowedContentTypes: [/xml/],
      fetchImpl,
      resolveHost: publicResolver,
    })).rejects.toThrow(/private/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("applies outbound limits to every resolved publisher before sending a request", async () => {
    const limitedHosts: string[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return calls === 1
        ? new Response(null, { status: 302, headers: { location: "https://www.example.org/feed" } })
        : new Response("<rss/>", { status: 200, headers: { "content-type": "application/xml" } });
    }) as never;
    await safeFetchText("https://example.org/feed", {
      accept: "application/xml",
      allowedContentTypes: [/xml/],
      fetchImpl,
      resolveHost: publicResolver,
      enforceRateLimit: async (url) => { limitedHosts.push(url.hostname); },
    });
    expect(limitedHosts).toEqual(["example.org", "www.example.org"]);
  });

  it("rejects an oversized streamed response", async () => {
    const fetchImpl = vi.fn(async () => new Response("x".repeat(101), {
      status: 200,
      headers: { "content-type": "application/xml" },
    })) as never;
    await expect(safeFetchText("https://example.org/feed", {
      accept: "application/xml",
      allowedContentTypes: [/^application\/xml$/],
      maxBytes: 100,
      fetchImpl,
      resolveHost: publicResolver,
    })).rejects.toThrow(/100-byte limit/);
  });

  it("rejects an unexpected media type", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html/>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })) as never;
    await expect(safeFetchText("https://example.org/feed", {
      accept: "application/xml",
      allowedContentTypes: [/xml/],
      fetchImpl,
      resolveHost: publicResolver,
    })).rejects.toThrow(/content type/i);
  });

  it("retries only transient source responses within the connector budget", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 503, headers: { "content-type": "text/plain" } }))
      .mockResolvedValueOnce(new Response("<rss/>", { status: 200, headers: { "content-type": "application/xml" } })) as never;
    const sleep = vi.fn(async () => undefined);

    const response = await safeFetchText("https://example.org/feed", {
      accept: "application/xml",
      allowedContentTypes: [/^application\/xml$/],
      retryAttempts: 2,
      retryBackoffMs: 50,
      fetchImpl,
      resolveHost: publicResolver,
      sleep,
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it("does not retry a deterministic content validation failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html/>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })) as never;

    await expect(safeFetchText("https://example.org/feed", {
      accept: "application/xml",
      allowedContentTypes: [/xml/],
      retryAttempts: 2,
      fetchImpl,
      resolveHost: publicResolver,
    })).rejects.toThrow(/content type/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
