#!/usr/bin/env tsx
/**
 * One classifier, two callers: an agent verifying an edit locally, and CI
 * deciding which jobs to run.
 *
 * The rule is proportionality. A Markdown edit does not need a production
 * build; a CSS change does not need 55 PGlite databases; a migration or a
 * change to `server/core` needs everything. Before 2026-09-08 CI made no such
 * distinction — every commit, including a docs-only one, ran typecheck, lint,
 * all 166 test files and two production builds — and this script, while it
 * did classify, could only ever emit the whole test suite and never emitted a
 * build at all.
 *
 * Two properties are load-bearing:
 *
 * **Unknown means high risk.** A path that matches no class below is treated
 * as high risk, not as safe. The cost of over-verifying is minutes; the cost
 * of under-verifying is a broken deploy, and the classifier is not the place
 * to be clever.
 *
 * **The build is not optional for anything that ships.** `next build` is what
 * Vercel runs. If application code changed, CI builds, whatever the tests say.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export type ChangedFile = {
  path: string;
  structural?: boolean;
};

export type VerificationStep = {
  id: "typecheck" | "lint" | "test" | "test:related" | "build";
  command: string;
  args: string[];
  reason: string;
};

/** What CI switches its jobs on, and what `--json` prints. */
export type ChangeClasses = {
  /** Nothing outside documentation, agent instructions and prose changed. */
  docsOnly: boolean;
  /** Application or tooling source — the trigger for typecheck, lint, build. */
  code: boolean;
  /** Test files themselves. */
  tests: boolean;
  /** Editorial packages and static public assets. */
  content: boolean;
  /** A numbered SQL migration. */
  migration: boolean;
  /** Shared foundations, security, dependencies, build/CI config — or a path
   *  this classifier could not place. Forces the full suite. */
  highRisk: boolean;
  /** A file was added, renamed or deleted rather than edited in place. */
  structural: boolean;
  /** True when the diff is small, presentational and touches nothing shared,
   *  so `vitest related` covers it and the full suite is not warranted. */
  relatedOnly: boolean;
  /** The changed source files `vitest related` should be pointed at. */
  codeFiles: string[];
};

export type VerificationPlan = {
  files: string[];
  classes: ChangeClasses;
  steps: VerificationStep[];
};

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const TEST = /^(?:tests\/|.*\.(?:test|spec)\.[cm]?[jt]sx?$)/;
const CONTENT = /^(?:content-packages\/|public\/)/;
const MIGRATION = /^server\/db\/migrations\//;
const STYLE = /\.(?:css|scss)$/;
const DOCS = /^(?:docs\/|\.ai\/|\.claude\/|\.codex\/|\.agents\/)|(?:^|\/)[^/]*\.md$|^LICENSE$/;

/**
 * Changing any of these can break something a targeted run would not look at:
 * the database and its policies, the request/auth boundary, the contracts every
 * layer shares, the dependency tree, or the tooling that decides what "passing"
 * means. `.github/**` is here because a workflow edit must be validated by the
 * full pipeline it is editing.
 */
const HIGH_RISK = [
  /^server\/db\//,
  /^server\/core\//,
  /^server\/contracts\//,
  /^server\/http\//,
  /auth/i,
  /^package(?:-lock)?\.json$/,
  /^next\.config\.ts$/,
  /^vercel\.json$/,
  /^vitest\.config\.ts$/,
  /^eslint\.config\.mjs$/,
  /^tsconfig(?:\..+)?\.json$/,
  /^drizzle\.config\.ts$/,
  /^\.github\//,
  /^tests\/fixtures\//,
  /^middleware\.ts$/,
  /^instrumentation\.ts$/,
];

/** Paths that are genuinely inert at runtime and need no application check. */
const INERT = [DOCS, /^\.gitignore$/, /^\.gitattributes$/, /^\.editorconfig$/];

const step = (
  id: VerificationStep["id"],
  args: string[],
  reason: string,
): VerificationStep => ({ id, command: "npm", args, reason });

function classify(files: ChangedFile[]): ChangeClasses {
  const paths = files.map((file) => file.path);
  const placed = (path: string) =>
    INERT.some((rx) => rx.test(path))
    || HIGH_RISK.some((rx) => rx.test(path))
    || CODE.test(path)
    || STYLE.test(path)
    || CONTENT.test(path)
    || MIGRATION.test(path);

  return {
    docsOnly: paths.length > 0 && paths.every((path) => INERT.some((rx) => rx.test(path))),
    code: paths.some((path) => (CODE.test(path) || STYLE.test(path)) && !TEST.test(path)),
    tests: paths.some((path) => TEST.test(path)),
    content: paths.some((path) => CONTENT.test(path)),
    migration: paths.some((path) => MIGRATION.test(path)),
    /* The `!placed` arm is the safety net, not an afterthought: a file nobody
       taught this script about escalates to the full suite. */
    highRisk: paths.some((path) => HIGH_RISK.some((rx) => rx.test(path)) || !placed(path)),
    structural: files.some((file) => Boolean(file.structural)),
    relatedOnly: false,
    codeFiles: paths.filter((path) => (CODE.test(path) || STYLE.test(path)) && !TEST.test(path)),
  };
}

/**
 * `vitest related` walks the real module graph and runs exactly the test files
 * that import the changed ones — 198ms for a single component against 176s for
 * the whole suite. It is trustworthy only when the change cannot reach code the
 * graph does not connect it to, so it is confined to presentational edits:
 * nothing shared, nothing generated, nothing structural, and a small enough
 * diff that the graph is a description of the change rather than a guess.
 */
const RELATED_FILE_CEILING = 25;

function eligibleForRelated(classes: ChangeClasses, paths: string[]): boolean {
  if (classes.highRisk || classes.migration || classes.content) return false;
  /* A new or moved file can add an import edge that no existing test covers,
     and a deleted one removes the test that would have caught it. */
  if (classes.structural) return false;
  if (!classes.code || classes.codeFiles.length === 0) return false;
  if (paths.length > RELATED_FILE_CEILING) return false;
  /* Server code reaches modules through service and repository boundaries that
     integration tests exercise without importing the changed file directly. */
  return classes.codeFiles.every((path) =>
    /^(?:app\/(?!api\/)|components\/|lib\/)/.test(path));
}

export function buildVerificationPlan(changes: ChangedFile[]): VerificationPlan {
  const unique = new Map<string, ChangedFile>();
  for (const change of changes) {
    const previous = unique.get(change.path);
    unique.set(change.path, {
      path: change.path,
      structural: Boolean(previous?.structural || change.structural),
    });
  }

  const files = [...unique.values()].sort((a, b) => a.path.localeCompare(b.path));
  const classes = classify(files);
  classes.relatedOnly = eligibleForRelated(classes, files.map((file) => file.path));
  const steps: VerificationStep[] = [];

  if (classes.code || classes.highRisk) {
    steps.push(step("typecheck", ["run", "typecheck"], "application or tooling code changed"));
    steps.push(step("lint", ["run", "lint"], "application or tooling code changed"));
  }
  if (classes.relatedOnly) {
    steps.push({
      id: "test:related",
      command: "npx",
      args: ["vitest", "related", "--run", ...classes.codeFiles],
      reason: "an isolated presentational change — only the tests that import it",
    });
  } else if (classes.code || classes.tests || classes.content || classes.migration || classes.highRisk) {
    steps.push(step("test", ["test"], classes.highRisk
      ? "a shared, security or configuration boundary changed — the full suite runs"
      : "code, tests, content, or migrations changed"));
  }
  /* Content is in here because `content-packages/**` and `public/**` are read
     during static generation: an edit there can break a build that every
     other check passes. */
  if (classes.code || classes.content || classes.highRisk) {
    steps.push(step("build", ["run", "build"], "a change that reaches the production bundle"));
  }
  return { files: files.map((file) => file.path), classes, steps };
}

function gitNames(args: string[]): string[] {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.split("\0").filter(Boolean);
}

export function readWorkingTreeChanges(): ChangedFile[] {
  const tracked = gitNames(["diff", "--name-only", "-z", "HEAD", "--"]);
  const structural = new Set(
    gitNames(["diff", "--name-only", "--diff-filter=ADR", "-z", "HEAD", "--"]),
  );
  const untracked = gitNames(["ls-files", "--others", "--exclude-standard", "-z"]);
  for (const path of untracked) structural.add(path);

  return [...new Set([...tracked, ...untracked])].map((path) => ({
    path,
    structural: structural.has(path),
  }));
}

/**
 * A commit range, for CI. `base...head` is the merge-base form on purpose:
 * a PR must be judged on what it changes relative to where it forked, not on
 * everything that landed on `main` while it was open.
 */
export function readRangeChanges(range: string): ChangedFile[] {
  const tracked = gitNames(["diff", "--name-only", "-z", range, "--"]);
  const structural = new Set(
    gitNames(["diff", "--name-only", "--diff-filter=ADR", "-z", range, "--"]),
  );
  return tracked.map((path) => ({ path, structural: structural.has(path) }));
}

type CliOptions = {
  dryRun: boolean;
  json: boolean;
  range: string | null;
  files: ChangedFile[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, json: false, range: null, files: [] };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg.startsWith("--range=")) options.range = arg.slice(8);
    else if (arg.startsWith("--file=")) options.files.push({ path: arg.slice(7) });
    else if (arg.startsWith("--structural-file=")) {
      options.files.push({ path: arg.slice(18), structural: true });
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printPlan(plan: VerificationPlan): void {
  console.log(`Changed files (${plan.files.length}):`);
  for (const file of plan.files) console.log(`  - ${file}`);
  const on = Object.entries(plan.classes).filter(([, value]) => value).map(([key]) => key);
  console.log(`Change classes: ${on.length ? on.join(", ") : "none"}`);
  if (!plan.steps.length) console.log("Automated checks: none selected for this diff.");
  else {
    console.log("Automated checks:");
    for (const item of plan.steps) {
      console.log(`  - ${item.command} ${item.args.join(" ")} (${item.reason})`);
    }
  }
}

/** GitHub Actions reads job conditions from here. Booleans are printed as
 *  `true`/`false` strings because that is what `$GITHUB_OUTPUT` carries. */
function emitJson(plan: VerificationPlan): void {
  const output = {
    ...plan.classes,
    codeFiles: plan.classes.codeFiles.join(" "),
    steps: plan.steps.map((item) => item.id),
    fileCount: plan.files.length,
  };
  console.log(JSON.stringify(output, null, 2));
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  const lines = Object.entries(output)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : String(value)}`)
    .join("\n");
  appendFileSync(target, `${lines}\n`);
}

function run(): void {
  const options = parseArgs(process.argv.slice(2));
  const changes = options.files.length
    ? options.files
    : options.range
      ? readRangeChanges(options.range)
      : readWorkingTreeChanges();

  if (!changes.length) {
    /* An empty diff is not "safe to skip everything" in CI — a re-run of the
       same commit, or a merge that changed nothing, still has to report. */
    const empty = buildVerificationPlan([]);
    if (options.json) emitJson(empty);
    else console.log("No changes detected.");
    return;
  }

  const plan = buildVerificationPlan(changes);
  if (options.json) {
    emitJson(plan);
    return;
  }
  printPlan(plan);
  if (options.dryRun) return;

  for (const item of plan.steps) {
    const result = spawnSync(item.command, item.args, { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  console.log("Changed-file verification passed.");
}

const invokedDirectly = process.argv[1]?.endsWith("scripts/verify-changed.ts");
if (invokedDirectly) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
