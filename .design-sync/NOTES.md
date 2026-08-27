# design-sync notes — Lions of Zion

Repo-specific gotchas for future syncs. Read this before re-running.

## What this repo is (and isn't)

- **This is a Next.js application, not a published component library.**
  `package.json` is `private: true` with no `main`/`module`/`exports`/`files`,
  there is no `dist/`, and the only build is `next build`. So the converter runs
  in **authored-entry** mode: `.design-sync/ds-entry.ts` names the exports, and
  it is passed with `--entry`. There is no `buildCmd` — nothing needs building
  before the converter runs.
- **`srcDir` must be set to `components`.** The converter's default source-root
  fallback is `src/` → `lib/` → `components/`. This repo HAS a `lib/`
  (`lib/content/`, the editorial content seam) which is not components at all,
  so the default would pick the wrong root. `"srcDir": "components"` is
  load-bearing, not cosmetic.

## Browser for the render check

No playwright browser cache on this machine, and none is needed: both
`package-validate.mjs` and `package-capture.mjs` honour **`DS_CHROMIUM_PATH`**.
Point it at the installed Chrome and skip the ~200MB download:

```
DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Verified working (Chrome 151, headless). Note this is unrelated to the repo's
own "must use real Chrome with `headless: false`" rule in CLAUDE.md — that rule
is about the **WebGPU particle scene**, which is out of scope for this sync.
Plain DOM/CSS component previews are fine headless.

## Host shims for `next/*`

`.design-sync/shims/` holds three host shims, aliased in
`.design-sync/tsconfig.sync.json` (which is what `cfg.tsconfig` points at —
it extends the repo's `@/*` paths and adds these):

| Shim | Why |
| --- | --- |
| `next/link` → `next-link.tsx` | Used by `components/content/**` and `BriefError`. Outside a Next app there is no router; `Link` renders an anchor and so does the shim. Routing-only props are accepted and dropped rather than leaked to the DOM. |
| `next/image` → `next-image.tsx` | `GeopoliticalBrief` imports baked SVG assets. esbuild already loads `.svg`/`.png` as data URLs, so there is nothing for an optimizer to do. |
| `next/navigation` → `next-navigation.ts` | `usePathname` picks per-route starter questions in the chat. The shim reports the real browser path. |

These are **host-environment shims, not reimplementations** of Lions of Zion
components — the same category as the converter externalizing React to
`window.React`. No DS component was rewritten.

## Excluded from the bundle, and why

- `components/particle-nav/**` — `three/webgpu` + TSL, needs a real GPU and the
  baked `public/particles/lion-v2-*.bin` buffers. CLAUDE.md documents that
  headless Chromium's SwiftShader is correctly rejected by the GPU probe, so it
  can never produce a preview. It is a rendering engine, not a DS component.
- `ChatParticleCanvas`, `ParticleChatLauncher` — pull the above in transitively
  (`ParticleChatLauncher` imports `ChatParticleCanvas`).
- `ScanBackdrop` — an **async Server Component** that reads
  `public/matrix/matrix-fragments.en.json` with `node:fs`. Nothing in a browser
  bundle can run it.
- `SectionPage`, `DocPage`, `SectionBlock`, `HomeFrontPage` — page shells that
  hard-depend on `ScanBackdrop`. See "Re-sync risks".

## Host wrapper: `DesignSurface`

This system is **dark-first**, and its ground + reading defaults live on
`<body>` in `app/globals.css`. Outside the app there is no such `<body>`: the
preview harness owns it (and paints it `#fff`), and a design built with the
system owns its own. So the body layer is expressed as a component,
`.design-sync/shims/DesignSurface.tsx`, exported from the entry and wired as
`cfg.provider`.

It reads only existing tokens — no new design decisions, no hard-coded values —
so the palette and type cannot drift from the real site. Measured effect:
floor cards dropped from 12 to 8 once it was wired, because several components
need the ground to render anything meaningful.

## `app/globals.css` is an app shell, not a DS stylesheet

Two rules in it are actively wrong for a component library, and
`.design-sync/build-styles.mjs` neutralizes them at the end of the generated
entry:

- `html, body { height: 100%; overflow: hidden }` — correct for a full-viewport
  particle scene that must never scroll, **fatal** for a design built with the
  DS: every such design would be unscrollable with content below the fold
  unreachable, and nothing downstream would catch it. Neutralized with
  `height: auto; min-height: 100%; overflow: visible`, appended last so it wins
  at equal specificity without forking the app's stylesheet.

## Known render warns (triaged — a warn NOT in this list is new)

- `[FONT_MISSING] "Charter"` — Charter is a **fallback stack entry** in
  `--face-display: var(--font-newsreader), Charter, Georgia, …`, never a
  primary family. Newsreader itself ships (50 `@font-face` rules in
  `fonts/fonts.css`). Nothing to fix; do not chase it.
- `tokens: 77 defined, 64 referenced (2 missing, below threshold)` —
  informational, below the converter's own threshold.

## Traps that cost time here (do not rediscover)

1. **`cfg.tsconfig` `baseUrl` resolves against the tsconfig's own directory.**
   A `.design-sync/tsconfig.sync.json` with `baseUrl: "."` points at
   `.design-sync/`, not the repo root — every alias silently missed, and real
   Next got bundled instead of the shims (561 KB bundle, `process is not
   defined`, all 20 components dead on `window.LionsOfZion`). It is `".."`.
2. **Do not put `"@/*"` in the sync tsconfig.** The converter's paths plugin
   tests `existsSync(stem + ext)` with `""` first, so a barrel import like
   `@/components/content` resolves to the **directory** and esbuild fails with
   `Cannot read file … is a directory`. Leaving `@/*` out keeps those imports
   on esbuild's native tsconfig discovery (which finds the repo `tsconfig.json`
   and resolves `index.ts` correctly) and narrows the plugin to the shims.
3. **A CSS `@import url(...)` appended by `cfg.cssEntry` is dead.** The
   converter appends the entry to the END of `_ds_bundle.css`; an `@import`
   after any style rule is invalid and silently ignored. Measured: it landed at
   line 2887 of 2899 and never loaded. `build-styles.mjs` therefore **inlines**
   the `@font-face` rules, which are order-independent.
4. **`cssEntry` is appended verbatim — its own local `@import`s are NOT
   resolved.** An earlier attempt at `.design-sync/ds-styles.css` doing
   `@import "../app/globals.css"` silently dropped the entire token system
   (`--face-display` referenced 8 times, defined zero). `build-styles.mjs`
   inlines `globals.css` instead.
5. **`cfg.tokensGlob` needs `cfg.tokensPkg`** — `copyTokens` returns early
   without it, so it cannot be used for repo-local token files.
6. **`remoteStyleImports` is only populated from a Storybook static build**, so
   the `@import url()` slot in `styles.css` is unreachable in the package shape.

## Guidelines

`cfg.guidelinesGlob` is pinned to `[".ai/DESIGN-V2.md"]`. The converter default
(`docs/*.md`) sweeps this repo's **engineering** reference — `api.md`,
`data-model.md`, `operations.md` — which is not design guidance and would
mislead the design agent.

## Prop contracts are hand-written (`dtsPropsFor`) — and must stay maintained

There is no `dist/` and therefore **no shipped `.d.ts` tree**, so the
converter's prop extraction produced a `[key: string]: unknown` stub for all
21 components. That is the single worst outcome for the design agent: the
`<Name>Props` interface is the API contract it codes against, and a stub means
no contract at all.

`cfg.dtsPropsFor` therefore carries a hand-written props body for **every**
component, transcribed from the real source types.

**This is the main re-sync risk in this repo.** A prop added or renamed in
`components/**` will NOT appear in the uploaded `.d.ts` until `dtsPropsFor` is
updated by hand — nothing detects the drift. Diff the source prop types against
`dtsPropsFor` on every re-sync. The permanent fix is a real library build.

## Re-sync risks

- **`dtsPropsFor` drift** (above) — the highest-value check on any re-sync.
- **Fonts are fetched from Google at build time.** `build-styles.mjs` requires
  network access once per build and fails loudly if a family goes missing. The
  bundle itself has no build-time dependency on the host, but the `@font-face`
  `src:` URLs point at `fonts.gstatic.com`, so rendered designs load them at
  runtime.
- **`.design-sync/.cache/ds-styles.css` is generated and gitignored.** A fresh
  clone must run `node .design-sync/build-styles.mjs` before
  `package-build.mjs`, or the build has no `cssEntry`. There is no automation
  enforcing that order — it is documented here and nowhere else.
- **`app/globals.css` is read wholesale.** Any new app-shell rule added to it
  (a second `overflow: hidden`, a fixed inset, a `position: fixed` on `body`)
  ships into every design built with the DS. Re-read the neutralizer block in
  `build-styles.mjs` when globals.css changes materially.
- **The excluded set is a judgment, not a limit.** `SectionPage`, `DocPage`,
  `SectionBlock` and `HomeFrontPage` are excluded only because they import
  `ScanBackdrop`. If that ever becomes client-safe, they become the most
  valuable things in the system to sync — they are the page templates.
- **`ChatOpenProvider` is required** by `AskAboutFileCta` and `AskTheLionChat`;
  both throw without it. Their previews compose it for that reason.
- **Only partially verified**: the forms render but were never submitted (they
  post to real endpoints), and `AskTheLionChat` was verified in its offline
  state only — a database is provisioned as of 2026-08-26 (this said it was not), so the online transcript path has
  never been rendered.

## Re-sync command

```
node .design-sync/build-styles.mjs   # MUST run first — generates cssEntry
DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry .design-sync/ds-entry.ts --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```
