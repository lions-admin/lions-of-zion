import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    /* PGlite compiles Postgres to WASM; the first instance in a worker pays a
       one-off start cost that dwarfs the tests themselves. */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    /* `server-only` throws outside a React Server Component. The modules under
       test that carry it are exercised through the ones that do not. */
    environment: "node",
  },
});
