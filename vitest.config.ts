import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      /* `server-only` throws on import unless resolved through React's
         `react-server` condition, which vitest does not apply. The package
         ships an empty module for precisely this case, so point at it rather
         than dropping the import from the modules under test — the guard has
         to keep working in the build, where it is the thing stopping a
         Postgres driver reaching a client bundle. */
      /* Located by resolving the package the way Node does, then taking the
         sibling file — `exports` maps `empty.js` only under the `react-server`
         condition, so it cannot be required by subpath.

         Not a path relative to this config file: hardcoding
         `./node_modules/server-only/empty.js` breaks in a git worktree, where
         that directory can exist but be empty. The alias then points at a file
         that is not there and 12 test files fail to load — 82 failures with no
         message naming the cause. */
      "server-only": join(dirname(require.resolve("server-only")), "empty.js"),
    },
  },
  test: {
    /* PGlite compiles Postgres to WASM; the first instance in a worker pays a
       one-off start cost that dwarfs the tests themselves. */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    environment: "node",
    /* One PGlite instance per test file, each a full Postgres in WASM, is
       heavy enough that unbounded parallelism starves the pool rather than
       speeding it up. `.ai/STATE.md` already recorded that the suite gets
       OOM-killed (exit 137) at default parallelism alongside another heavy
       process, and that two workers is the reliable setting — but that lived
       only in prose, so `npm run verify:full`, which is the gate CI runs and
       the one this repo tells you to run, did not honour it.

       Measured 2026-09-02 on this workstation: the default pool produced 110
       failures, every one a 30-60s timeout in files the change never touched;
       the same suite at two workers passed 72/72 files and 696 tests. The
       failures were the machine, not the code, and a gate that cannot tell
       you which is not a gate.

       Set here rather than as a flag on the `test` script so every entry
       point agrees — `npm test`, `verify:full`, `test:watch`, and a bare
       `npx vitest run`. `maxWorkers` is the vitest 4 spelling; the older
       `poolOptions.forks.maxForks` is gone from `InlineConfig` and typecheck
       rejects it. */
    maxWorkers: 2,
  },
});
