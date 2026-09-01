import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";

afterEach(() => vi.unstubAllEnvs());

describe("public editorial mutation guard", () => {
  it("refuses every public mutation from a Vercel preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => requirePublicMutationEnvironment()).toThrow(/Preview deployments cannot mutate/);
  });

  it("allows the production and local integration paths", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => requirePublicMutationEnvironment()).not.toThrow();
    vi.stubEnv("VERCEL_ENV", "development");
    expect(() => requirePublicMutationEnvironment()).not.toThrow();
  });
});
