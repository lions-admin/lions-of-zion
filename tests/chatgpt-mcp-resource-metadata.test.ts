import { describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/oauth-protected-resource/route";

describe("ChatGPT MCP protected-resource metadata", () => {
  it("advertises the canonical public MCP audience", async () => {
    const response = GET(new Request("https://preview.example.test/.well-known/oauth-protected-resource"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      resource: "https://preview.example.test/api/mcp",
      authorization_servers: ["https://preview.example.test"],
      scopes_supported: ["editorial"],
    });
  });
});
