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

  it("pins briefing workers to the declared production region with explicit capacity", () => {
    const functions = vercelConfig.functions as Record<string, {
      maxDuration?: number;
      regions?: string[];
    }>;
    const briefingFunctions = Object.entries(functions)
      .filter(([file]) => file.includes("/briefing/") || file.includes("/cron/briefing/"));
    expect(briefingFunctions.length).toBeGreaterThan(0);
    for (const [file, config] of briefingFunctions) {
      expect(config.maxDuration, `${file} must declare maxDuration`).toBeGreaterThan(0);
      expect(config.regions, `${file} must declare a region`).toEqual(["iad1"]);
    }
  });
});
