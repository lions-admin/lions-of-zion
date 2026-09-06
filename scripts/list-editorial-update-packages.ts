/**
 * Lists the canonical package files introduced by one delivery-branch push.
 *
 * The workflow intentionally asks Git only for the directory, then applies
 * this exact root-level rule in TypeScript. GitHub Actions' trigger uses the
 * matching `editorial-updates/*.json` expression, avoiding divergent `**`
 * semantics between the trigger and Git pathspecs.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ZERO_SHA = '0000000000000000000000000000000000000000';
export const EDITORIAL_UPDATE_PACKAGE_PATH = /^editorial-updates\/\d{4}-\d{2}-\d{2}-[^/]+\.json$/;

export function isEditorialUpdatePackagePath(path: string): boolean {
  return EDITORIAL_UPDATE_PACKAGE_PATH.test(path);
}

function git(repository: string, args: string[]): string {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' });
}

export function changedEditorialUpdatePackages({ repository, before, sha }: {
  repository: string;
  before: string;
  sha: string;
}): string[] {
  const output = before === ZERO_SHA
    ? git(repository, ['ls-files', '--', 'editorial-updates'])
    : git(repository, ['diff', '--name-only', '--diff-filter=ACMR', before, sha, '--', 'editorial-updates']);
  return [...new Set(output.split(/\r?\n/).filter(isEditorialUpdatePackagePath))].sort();
}

function usage(): never {
  console.error('Usage: npm run editorial:packages -- --repository <path> --before <sha> --sha <sha>');
  process.exit(2);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function main(): void {
  const args = process.argv.slice(2);
  const repository = option(args, '--repository');
  const before = option(args, '--before');
  const sha = option(args, '--sha');
  if (!repository || !before || !sha) usage();
  try {
    const packages = changedEditorialUpdatePackages({ repository, before, sha });
    if (packages.length) process.stdout.write(`${packages.join('\n')}\n`);
  } catch (cause) {
    console.error(`Package discovery failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
