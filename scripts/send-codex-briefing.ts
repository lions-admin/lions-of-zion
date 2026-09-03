import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const urlArg = args.find((arg) => arg.startsWith("--url="))?.slice("--url=".length);
const dryRun = args.includes("--dry-run");

if (!file) throw new Error("Usage: npm run briefing:codex:send -- <package.json> [--dry-run] [--url=https://lionsofzion.io]");

const body = await readFile(file, "utf8");
JSON.parse(body);

if (dryRun) {
  process.stdout.write(`${body}\n`);
  process.exit(0);
}

const secret = process.env.CODEX_BRIEFING_IMPORT_SECRET?.trim();
if (!secret) throw new Error("CODEX_BRIEFING_IMPORT_SECRET is not set.");

const baseUrl = (urlArg ?? process.env.CODEX_BRIEFING_IMPORT_URL ?? "https://lionsofzion.io").replace(/\/$/, "");
const response = await fetch(`${baseUrl}/api/internal/codex/briefing-import`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${secret}`,
    "content-type": "application/json",
  },
  body,
});
const text = await response.text();
if (!response.ok) throw new Error(`Import failed with HTTP ${response.status}: ${text}`);
process.stdout.write(`${text}\n`);
