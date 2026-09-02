#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

export type ChangedFile = {
  path: string;
  structural?: boolean;
};

export type VerificationStep = {
  id: "typecheck" | "lint" | "test";
  command: string;
  args: string[];
  reason: string;
};

export type VerificationPlan = {
  files: string[];
  steps: VerificationStep[];
};

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const TEST = /^(?:tests\/|.*\.(?:test|spec)\.[cm]?[jt]sx?$)/;
const CONTENT = /^(?:content-packages\/|public\/matrix\/)/;
const MIGRATION = /^server\/db\/migrations\//;

const step = (
  id: VerificationStep["id"],
  args: string[],
  reason: string,
): VerificationStep => ({ id, command: "npm", args, reason });

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
  const paths = files.map((file) => file.path);
  const hasCode = paths.some((path) => CODE.test(path) && !TEST.test(path));
  const hasTests = paths.some((path) => TEST.test(path));
  const hasContent = paths.some((path) => CONTENT.test(path));
  const hasMigration = paths.some((path) => MIGRATION.test(path));
  const steps: VerificationStep[] = [];
  if (hasCode) {
    steps.push(step("typecheck", ["run", "typecheck"], "application or tooling code changed"));
    steps.push(step("lint", ["run", "lint"], "application or tooling code changed"));
  }
  if (hasCode || hasTests || hasContent || hasMigration) {
    steps.push(step("test", ["test"], "code, tests, content, or migrations changed"));
  }
  return { files: paths, steps };
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

type CliOptions = {
  dryRun: boolean;
  files: ChangedFile[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    files: [],
  };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
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
  if (!plan.steps.length) console.log("Automated checks: none selected for this diff.");
  else {
    console.log("Automated checks:");
    for (const item of plan.steps) {
      console.log(`  - ${item.command} ${item.args.join(" ")} (${item.reason})`);
    }
  }
}

function run(): void {
  const options = parseArgs(process.argv.slice(2));
  const changes = options.files.length ? options.files : readWorkingTreeChanges();
  if (!changes.length) {
    console.log("No working-tree changes detected.");
    return;
  }

  const plan = buildVerificationPlan(changes);
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
