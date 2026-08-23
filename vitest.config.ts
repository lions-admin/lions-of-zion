import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

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
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    /* PGlite compiles Postgres to WASM; the first instance in a worker pays a
       one-off start cost that dwarfs the tests themselves. */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
