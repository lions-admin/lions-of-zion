import { describe, expect, it, vi } from "vitest";
import { googleCloudAccessToken } from "@/server/core/google-cloud-auth";
import { parseAgentSearchResults, shouldRetryAgentSearch } from "@/server/modules/sources/connectors/agent-search";
import { parseGdeltResults } from "@/server/modules/sources/connectors/gdelt";

describe("Google Workload Identity Federation", () => {
  it("exchanges Vercel OIDC and impersonates the configured service account", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("sts.googleapis.com")) {
        return Response.json({ access_token: "federated-token" });
      }
      return Response.json({ accessToken: "short-lived-google-token", expireTime: "2099-01-01T00:00:00Z" });
    }) as unknown as typeof fetch;

    const token = await googleCloudAccessToken({
      project: "project-id",
      location: "global",
      servingConfig: "projects/project-id/locations/global/servingConfigs/default",
      workloadIdentityProvider: "projects/123/locations/global/workloadIdentityPools/vercel/providers/lions",
      serviceAccountEmail: "search@project-id.iam.gserviceaccount.com",
    }, { fetchImpl, oidcToken: async () => "vercel-oidc" });

    expect(token).toBe("short-lived-google-token");
    expect(calls).toHaveLength(2);
    const stsBody = calls[0]!.init!.body as URLSearchParams;
    expect(stsBody.get("subject_token")).toBe("vercel-oidc");
    expect(stsBody.get("audience")).toBe(
      "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/vercel/providers/lions",
    );
    expect(new Headers(calls[1]!.init!.headers).get("authorization")).toBe("Bearer federated-token");
  });
});

describe("Agent Search result projection", () => {
  it("keeps direct publisher fields and discards generated summary prose", () => {
    const items = parseAgentSearchResults({
      results: [{
        id: "result-1",
        document: {
          name: "documents/result-1",
          derivedStructData: {
            link: "https://news.example.org/world/report?utm_source=google",
            htmlTitle: "<b>Verified</b> report",
            snippets: [{ snippet: "The source describes the event.", snippetStatus: "SUCCESS" }],
            datePublished: "2026-08-30T06:00:00Z",
            summary: "This generated editorial summary must not be retained.",
          },
        },
      }],
      totalSize: 1,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "result-1",
      title: "Verified report",
      url: "https://news.example.org/world/report?utm_source=google",
      excerpt: "The source describes the event.",
      publisher: { name: "news.example.org", homepageUrl: "https://news.example.org" },
    });
    expect(JSON.stringify(items[0])).not.toContain("generated editorial summary");
  });

  it("drops redirect records without a direct HTTP publisher URL", () => {
    const items = parseAgentSearchResults({
      results: [{ document: { derivedStructData: { link: "javascript:alert(1)", title: "Bad" } } }],
    });
    expect(items).toEqual([]);
  });

  it("enforces the configured publisher allowlist after retrieval", () => {
    const items = parseAgentSearchResults({
      results: [
        { id: "allowed", document: { derivedStructData: { link: "https://news.example.org/story", title: "Allowed" } } },
        { id: "blocked", document: { derivedStructData: { link: "https://untrusted.example.net/story", title: "Blocked" } } },
      ],
    }, ["example.org"]);

    expect(items.map((item) => item.externalId)).toEqual(["allowed"]);
  });
});

describe("Agent Search retry policy", () => {
  it("retries only provider-declared transient failures", () => {
    expect(shouldRetryAgentSearch(429)).toBe(true);
    expect(shouldRetryAgentSearch(503)).toBe(true);
    expect(shouldRetryAgentSearch(400)).toBe(false);
    expect(shouldRetryAgentSearch(403)).toBe(false);
  });
});

describe("GDELT result projection", () => {
  it("keeps the original publisher URL and contextual excerpt", () => {
    const items = parseGdeltResults({
      articles: [{
        url: "https://regional.example.com/story/42",
        title: "Regional report",
        seendate: "20260830T091500Z",
        domain: "regional.example.com",
        language: "Arabic",
        sourcecountry: "Qatar",
        context: "A contextual sentence returned by GDELT.",
      }],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe("https://regional.example.com/story/42");
    expect(items[0]?.excerpt).toBe("A contextual sentence returned by GDELT.");
    expect(items[0]?.publishedAt?.toISOString()).toBe("2026-08-30T09:15:00.000Z");
    expect(items[0]?.discoveryMetadata).toMatchObject({
      provider: "gdelt_context_2",
      sourceLanguage: "Arabic",
      sourceCountry: "Qatar",
    });
  });
});
