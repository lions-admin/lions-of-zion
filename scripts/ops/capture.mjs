#!/usr/bin/env node
/**
 * Screenshot one or more URLs and attach them to a task on the operations board.
 *
 *   npm run ops:capture -- --url http://localhost:3000/ --widths 1280,390 --kind after --pair hero
 *   npm run ops:capture -- --url https://lionsofzion.io/fake-resistance --kind screenshot --task claude:abc
 *
 * Full-page PNGs land in `~/.lions-ops/captures/` and are attached through
 * `report.mjs`, so a capture made offline is spooled like any other report.
 * `--pair KEY` becomes `KEY@<width>` per viewport, which is what lets the
 * board show a before and an after of the same width side by side.
 *
 * Playwright is a devDependency of this repository, not of this script: if it
 * is not installed where this runs, the script says so and exits 0.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ATTACHMENT_KINDS, CAPTURES_DIR, defaultTaskKey, parseArgs, reportAttachment, resolveIdentity } from "./report.mjs";

function readOptions(argv) {
  const urls = [];
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url") urls.push(argv[++i]);
    else if (argv[i] === "--widths") rest.push("--meta", `widths=${argv[++i]}`);
    else if (argv[i] === "--kind") rest.push("--attachment-kind", argv[++i]);
    else rest.push(argv[i]);
  }
  const args = parseArgs(rest);
  const widths = String(args.meta.widths ?? "1280,390").split(",").map((w) => Number(w.trim())).filter((w) => w > 0);
  return { urls: urls.filter(Boolean), widths, kind: args.attachmentKind ?? "screenshot", pair: args.pairKey, taskKey: args.taskKey, caption: args.caption };
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  if (!options.urls.length) {
    console.error("usage: capture.mjs --url U [--url U2] [--widths 1280,390] [--kind screenshot|before|after] [--pair KEY] [--task KEY] [--caption C]");
    return 2;
  }
  if (!ATTACHMENT_KINDS.includes(options.kind)) {
    console.error(`--kind must be one of ${ATTACHMENT_KINDS.join(", ")}`);
    return 2;
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("[ops-capture] playwright is not installed here (npm ci in the repository installs it); nothing captured.");
    return 0;
  }

  const identity = resolveIdentity();
  const taskKey = options.taskKey ?? defaultTaskKey(identity).taskKey;
  mkdirSync(CAPTURES_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const browser = await chromium.launch();
  let attached = 0;
  let spooled = 0;
  try {
    for (const url of options.urls) {
      const slug = url.replace(/^https?:\/\//, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";
      for (const width of options.widths) {
        const context = await browser.newContext({ viewport: { width, height: Math.round(width * 0.7) }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const file = join(CAPTURES_DIR, `${stamp}-${slug}-${width}.png`);
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
          await page.waitForTimeout(800);
          await page.screenshot({ path: file, fullPage: true });
        } catch (error) {
          console.error(`[ops-capture] ${url} @${width}: ${error?.message ?? error}`);
          await context.close();
          continue;
        }
        await context.close();
        const result = await reportAttachment(file, {
          taskKey,
          kind: options.kind,
          caption: options.caption ?? `${url} @ ${width}px`,
          pairKey: options.pair ? `${options.pair}@${width}` : undefined,
        });
        if (result.sent) attached += 1;
        else spooled += 1;
        console.log(`${result.sent ? "attached" : "spooled"} ${file}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`${attached} attached, ${spooled} spooled → ${taskKey}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`[ops-capture] ${error?.message ?? error}`);
    process.exit(1);
  },
);
