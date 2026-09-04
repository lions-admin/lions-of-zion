import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries, as lint errors.
 *
 * These are the rules from the backend plan. Stating them in a document makes
 * them an opinion someone can disagree with in review; stating them here makes
 * a violation fail the build. The two that matter most:
 *
 *   - The WebGL frontend and the backend cannot reach into each other. `app/`
 *     and `components/` may import types from `server/contracts` and nothing
 *     else, which is what keeps a Postgres driver out of a client bundle.
 *   - Route handlers may not import the database. "No business logic in route
 *     handlers" is otherwise a thing everyone agrees with and nobody enforces.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "server/db/migrations/**",
    /* Agent tooling, not application source — the same call already made for
       `scripts/**`. It also contains git worktrees, each a full checkout with
       its own node_modules: without this, `npm run lint` walks into bundled
       vendor code and reports thousands of errors in files nobody wrote. */
    ".claude/**",
    ".agents/**",
    ".codex/**",
    ".ds-sync/**",
    "ds-bundle/**",
    /* The same call tsconfig makes for `midjrny`: scratch checkouts that
       appear beside the repo during graphics work, each with vendored code
       and its own type shims that would otherwise pollute both gates. */
    "midjrny/**",
    "midjrny-wt-*/**",
  ]),

  {
    /* The frontend. May read the shared vocabulary; may not reach further.
       `lib/**` is included: it is the frontend's content seam, and should be
       held to the same boundary as `app/` and `components/`. */
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              /* Negations carve contracts back out — the frontend is meant to
                 share the vocabulary, just not the runtime. */
              group: [
                "@/server/*",
                "@/server/**",
                "!@/server/contracts",
                "!@/server/contracts/*",
              ],
              message:
                "The frontend may only import @/server/contracts/*. Everything else under server/ is backend-only.",
            },
          ],
        },
      ],
    },
  },

  {
    /* Route handlers may also live outside `app/api` when a provider requires
       a human-facing callback URL. Treat those files as server handlers, not
       as browser UI — the public X OAuth callback is one such endpoint. */
    files: ["app/auth/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  {
    /*
     * React's immutability checks correctly protect render state, but Three.js
     * frame callbacks are an imperative boundary by design: they mutate camera
     * transforms and GPU uniform handles outside React's render cycle. The
     * set-state rule likewise misclassifies asynchronous GPU capability and
     * asset-loading effects. Keep the exception scoped to this engine only.
     */
    files: ["components/particle-nav/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  {
    /* Route handlers. Parse, call one service, serialize. */
    files: ["app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/db", "@/server/db/*", "@/server/db/**"],
              message:
                "Route handlers may not touch the database. Call a module's index.ts; the module owns its repository.",
            },
            {
              group: ["@/server/modules/*/service", "@/server/modules/*/repo", "@/server/modules/*/rules"],
              message:
                "Import a module through its index.ts, not by reaching into its internals.",
            },
            {
              group: ["@/components/*", "@/components/**"],
              message: "An API route has no components.",
            },
          ],
        },
      ],
    },
  },

  {
    /* `app/auth` contains HTTP Route Handlers, not React UI. It may call a
       module's public facade. These handlers are deliberately the only
       exception to the React-side server-import boundary above. */
    files: ["app/auth/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/core",
                "@/server/core/*",
                "@/server/core/**",
                "@/server/db",
                "@/server/db/*",
                "@/server/db/**",
                "@/server/http",
                "@/server/http/*",
                "@/server/http/**",
                "@/server/jobs",
                "@/server/jobs/*",
                "@/server/jobs/**",
                "@/server/modules/*/*",
                "@/server/modules/*/**",
              ],
              message:
                "Authentication routes may call a module's public index only; core and persistence remain backend internals.",
            },
          ],
        },
      ],
    },
  },

  {
    /* Contracts. Zod and nothing else — this file must stay importable from a
       React Server Component and from a test with no database. */
    files: ["server/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/db*", "@/server/core*", "@/server/modules*", "@/server/http*"],
              message:
                "server/contracts may import only zod. It has to stay free of any runtime dependency.",
            },
            { group: ["server-only", "next/*", "drizzle-orm", "drizzle-orm/*"], message: "Same." },
          ],
        },
      ],
    },
  },

  {
    /* The schema layer. Owns tables; knows nothing about domain services. */
    files: ["server/db/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/modules*", "@/server/http*", "@/app/*", "@/components/*"],
              message: "The database layer is imported by modules, not the other way round.",
            },
          ],
        },
      ],
    },
  },

  {
    /* Nothing under server/ may reach into the frontend. */
    files: ["server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app/**", "@/components/*", "@/components/**"],
              message:
                "The backend does not import the frontend. The WebGL experience is a separate concern and stays one.",
            },
          ],
        },
      ],
    },
  },

  {
    /* Jobs orchestrate. A job containing an editorial `if` is a bug. */
    files: ["server/jobs/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/db", "@/server/db/*", "@/server/db/**"],
              message:
                "Jobs call module services, which own their own persistence. Reaching past them puts orchestration and policy in the same file.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
