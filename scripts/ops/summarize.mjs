#!/usr/bin/env node
/**
 * Ask the server for a Hebrew summary of a task — the thin CLI over the
 * digest pipeline in `report.mjs`.
 *
 *   npm run ops:summarize -- --task KEY --transcript PATH   # one Claude transcript
 *   npm run ops:summarize -- --file digest.json             # a digest you built yourself
 *   npm run ops:summarize -- --all-imported [--only-missing] # every backfill task (ledger-aware)
 *
 * The digest — first prompt, last two assistant texts, files edited, commits,
 * tool counts — goes to `POST /api/internal/ops/tasks/summarize`, and the
 * server writes the title, summary, changes, remaining and blockers with a
 * model. Nothing here calls a model; nothing here decides what the summary
 * says. Unreachable server → the digest is spooled under
 * `~/.lions-ops/spool-digests/` and `report.mjs flush` retries it.
 */
import { readFileSync } from "node:fs";
import { boundDigest, buildDigestFromTranscript, loadConfig, sendDigest } from "./report.mjs";

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const [flag, inline] = arg.slice(2).split(/=(.*)/s);
    if (["all-imported", "only-missing", "help", "dry-run"].includes(flag)) out[flag] = true;
    else out[flag] = inline ?? argv[++i];
  }
  return out;
}

function usage() {
  return [
    "usage: summarize.mjs --task KEY --transcript PATH [--language he|en|mixed]",
    "       summarize.mjs --file digest.json [--task KEY]",
    "       summarize.mjs --all-imported [--only-missing]",
    "  --dry-run prints the bounded digest and sends nothing",
  ].join("\n");
}

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help || args._.includes("-h")) {
    console.log(usage());
    return 0;
  }
  const config = loadConfig();

  if (args["all-imported"]) {
    const { collectTasks, summarizeTasks, LEDGER_PATH } = await import("./backfill.mjs");
    const tasks = Object.values(collectTasks()).flat();
    if (args["dry-run"]) {
      console.log(`${tasks.length} imported tasks, ${tasks.filter((t) => t.digest.lastAssistant).length} with text to summarize`);
      return 0;
    }
    if (!config.secret) {
      console.error("[summarize] OPS_REPORT_SECRET is not set; nothing posted.");
      return 1;
    }
    const result = await summarizeTasks(tasks, { config, onlyMissing: Boolean(args["only-missing"]) });
    console.log(`done: ${result.sent} summarized, ${result.failed} failed, ${result.empty} empty, ${result.skipped} already in ${LEDGER_PATH}`);
    return result.failed ? 1 : 0;
  }

  let digest;
  if (args.file) {
    digest = JSON.parse(readFileSync(args.file, "utf8"));
    if (args.task) digest.taskKey = args.task;
  } else if (args.transcript) {
    digest = buildDigestFromTranscript(args.transcript, { taskKey: args.task });
    if (digest.error) throw new Error(`cannot read transcript: ${digest.error}`);
  } else {
    throw new Error(`nothing to summarize.\n${usage()}`);
  }
  if (args.language) digest.language = args.language;
  const bounded = boundDigest(digest);
  if (!bounded.taskKey) throw new Error("no task key: pass --task KEY (the transcript carried no session id)");
  if (args["dry-run"]) {
    console.log(JSON.stringify(bounded, null, 2));
    return 0;
  }
  const result = await sendDigest(bounded, { config, timeoutMs: 90000 });
  console.log(`${result.sent ? "summarized" : result.spooled ? "spooled digest" : "rejected"} → ${bounded.taskKey}${result.error ? ` — ${result.error}` : ""}`);
  return result.sent || result.spooled ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`[summarize] ${error?.message ?? error}`);
    process.exit(1);
  },
);
