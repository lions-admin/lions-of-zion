import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { changedEditorialUpdatePackages, ZERO_SHA } from '@/scripts/list-editorial-update-packages';

const repositories: string[] = [];

function git(repository: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' }).trim();
}

async function repository(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'lions-editorial-packages-'));
  repositories.push(path);
  git(path, 'init', '--initial-branch=editorial-updates');
  git(path, 'config', 'user.email', 'tests@example.com');
  git(path, 'config', 'user.name', 'Editorial package tests');
  await writeFile(join(path, 'README.md'), 'package branch\n');
  git(path, 'add', 'README.md');
  git(path, 'commit', '-m', 'baseline');
  return path;
}

async function writePackage(path: string, name: string): Promise<void> {
  await mkdir(join(path, 'editorial-updates'), { recursive: true });
  await writeFile(join(path, 'editorial-updates', name), '{}\n');
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map(async path => {
    await (await import('node:fs/promises')).rm(path, { recursive: true, force: true });
  }));
});

describe('editorial update package discovery', () => {
  it('detects the root-level path that the old ** Git pathspec skipped', async () => {
    const path = await repository();
    const before = git(path, 'rev-parse', 'HEAD');
    const name = '2026-09-06-chatgpt-test-example.json';
    await writePackage(path, name);
    git(path, 'add', '.');
    git(path, 'commit', '-m', 'add package');
    const sha = git(path, 'rev-parse', 'HEAD');

    expect(git(path, 'ls-files', 'editorial-updates/**/*.json')).toBe('');
    expect(changedEditorialUpdatePackages({ repository: path, before, sha })).toEqual([`editorial-updates/${name}`]);
  });

  it('ignores unrelated and nested files, and returns multiple root packages once each', async () => {
    const path = await repository();
    const before = git(path, 'rev-parse', 'HEAD');
    await writePackage(path, '2026-09-06-first.json');
    await writePackage(path, '2026-09-06-second.json');
    await mkdir(join(path, 'editorial-updates', 'nested'), { recursive: true });
    await writeFile(join(path, 'editorial-updates', 'nested', '2026-09-06-not-authorized.json'), '{}\n');
    await writeFile(join(path, 'notes.txt'), 'ignore\n');
    git(path, 'add', '.');
    git(path, 'commit', '-m', 'add files');
    const sha = git(path, 'rev-parse', 'HEAD');

    expect(changedEditorialUpdatePackages({ repository: path, before, sha })).toEqual([
      'editorial-updates/2026-09-06-first.json',
      'editorial-updates/2026-09-06-second.json',
    ]);
  });

  it('uses the same root-level rule for a zero-SHA initial delivery branch', async () => {
    const path = await repository();
    await writePackage(path, '2026-09-06-initial.json');
    await mkdir(join(path, 'editorial-updates', 'nested'), { recursive: true });
    await writeFile(join(path, 'editorial-updates', 'nested', '2026-09-06-ignored.json'), '{}\n');
    git(path, 'add', '.');
    git(path, 'commit', '-m', 'initial package');
    const sha = git(path, 'rev-parse', 'HEAD');

    expect(changedEditorialUpdatePackages({ repository: path, before: ZERO_SHA, sha })).toEqual([
      'editorial-updates/2026-09-06-initial.json',
    ]);
  });
});
