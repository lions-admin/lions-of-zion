import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import vercelConfig from "../vercel.json";

const routeDirs = [
  join(process.cwd(), "app/api/internal/cron"),
  join(process.cwd(), "app/api/internal/queue"),
];

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await routeFiles(path));
    else if (entry.name === "route.ts") files.push(path);
  }
  return files;
}

describe("briefing server runtime contracts", () => {
  it("declares a Node runtime and bounded duration for every cron and queue route", async () => {
    const files = (await Promise.all(routeDirs.map(routeFiles))).flat();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, `${file} must use the Node runtime`).toMatch(/export const runtime = ["']nodejs["'];/);
      const duration = source.match(/export const maxDuration = (\d+);/);
      expect(duration, `${file} must bound function duration`).not.toBeNull();
      expect(Number(duration?.[1])).toBeGreaterThan(0);
    }
  });

  it("keeps the external receiver configured without a legacy internal executor", () => {
    const functions = vercelConfig.functions as Record<string, {
      maxDuration?: number;
      regions?: string[];
    }>;
    const receiver = functions["app/api/internal/briefing/external-publish/route.ts"];
    expect(receiver?.maxDuration).toBeGreaterThan(0);
    expect(receiver?.regions).toEqual(["iad1"]);
    const sourceIngest = functions["app/api/internal/queue/ingest/route.ts"];
    expect(sourceIngest?.maxDuration).toBeGreaterThan(0);
    expect(sourceIngest?.regions).toEqual(["iad1"]);

    expect(Object.keys(functions)).not.toEqual(expect.arrayContaining([
      expect.stringContaining("/cron/briefing/"),
      expect.stringContaining("/queue/briefing/"),
      expect.stringContaining("admin/briefing/run"),
    ]));
    /* There is no `crons` array at all since 2026-09-08: the owner removed
       every schedule, and the four routes are now driven by hand from the
       admin console or the Operations tick workflow. The assertion that the
       retired initiator has no schedule is therefore satisfied by the
       stronger fact that nothing has one — and this asserts that, so a
       reinstated cron has to be a deliberate edit to this test too. */
    expect(vercelConfig).not.toHaveProperty("crons");

    /* Production deploy `dpl_HheUpCu…`, 2026-09-08, failed before the build
       even started:

         The `vercel.json` schema validation failed with the following
         message: should NOT have additional property `//crons`

       The published schema sets `additionalProperties: false`, so the
       `"//key"` comment convention that is harmless in `package.json` is a
       hard deploy failure here. There is no way to write a comment in this
       file; explanations belong in AGENTS.md or docs/operations.md. */
    const allowed = new Set([
      "$schema", "ignoreCommand", "git", "functions", "crons", "redirects",
      "rewrites", "headers", "buildCommand", "installCommand", "outputDirectory",
      "framework", "regions", "cleanUrls", "trailingSlash", "images", "public",
    ]);
    for (const key of Object.keys(vercelConfig)) {
      expect(key.startsWith("//"), `vercel.json rejects the comment key "${key}"`).toBe(false);
      expect(allowed.has(key), `vercel.json key "${key}" is not one this test knows to be valid`).toBe(true);
    }
  });
});
