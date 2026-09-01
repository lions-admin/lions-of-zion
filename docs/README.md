# Documentation

Reference documentation for the repository. Written to be true rather than
aspirational: anything not verified against the code is marked as a gap, not
described as though it works.

| Document | For |
| --- | --- |
| [`architecture.md`](architecture.md) | The system map — both halves, the enforced boundaries, the flows, and the known gaps |
| [`api.md`](api.md) | Every HTTP route, its guard, its shape, its error codes |
| [`data-model.md`](data-model.md) | Tables, triggers, versioning, RLS, the two axes, the test database |
| [`environment.md`](environment.md) | Every environment variable, by name. No values |
| [`operations.md`](operations.md) | Install, run, verify, CI, deploy, troubleshoot |
| [`vercel-infrastructure.md`](vercel-infrastructure.md) | Verified Vercel, Neon, Blob, Queue, Cron and AI deployment record |

## Active task briefs

| Document | For |
| --- | --- |
| [`archive-integration.md`](archive-integration.md) | Bringing the two October 7 testimony archives onto `/october-7`. Phases 1 and 3 complete; media is live on the CDN |
| [`fake-resistance-integration.md`](fake-resistance-integration.md) | Bringing the disinformation research onto `/fake-resistance`. **Its publication gate does not behave as the brief describes** — see `.ai/STATE.md` |
| [`PROJECT_MAP.md`](PROJECT_MAP.md) | The repository's shape: every area's role, the entry points, where a new file goes |

## Where else things are written down

- **[`../CLAUDE.md`](../CLAUDE.md)** — implementation reference. Direct owner
  instructions override it and every other repository document.
- **[`../.ai/WORKFLOW.md`](../.ai/WORKFLOW.md)** — optional working notes.
- **[`../.ai/DECISIONS.md`](../.ai/DECISIONS.md)** — historical decisions.
- **[`../.ai/STATE.md`](../.ai/STATE.md)** — an optional project snapshot.
- **[`../app/globals.css`](../app/globals.css)** — the reading-page type,
  spacing and colour system lives in the commented token block at the top of
  this file: three faces, seven type steps, eight spacing steps, six colours.
  Read it before touching reading-page CSS. It replaces .ai/DESIGN-V2.md,
  which was folded into those comments and deleted (commit 10bfd8b).
- **[`../.ai/ROLLBACK.md`](../.ai/ROLLBACK.md)** — undoing a bad production
  deploy.
- **[`../TODOS.md`](../TODOS.md)** — the Hebrew delivery plan; the place to
  check what is considered unfinished.
- **[`../components/content/README.md`](../components/content/README.md)** —
  every prop of the shared content-presentation components.

## Historical

- **[`archive/`](archive/README.md)** — documents that were true, did their job,
  and are kept for the record rather than for use. Nothing in it is a source of
  truth, and nothing in it is to be corrected to match the present — with one
  recorded exception on 2026-09-01, described in that directory's README. It
  holds the closed design audit (83 of 83) and its 219 KB evidence report, the
  August 2026 wave log, and an orphaned external review.

## Standalone HTML pages

Both open from the filesystem, need no server, and make no network request.

- [`engine-explainer.html`](engine-explainer.html) — **not about the particle
  scene.** A hand-written Hebrew page, `מנוע האימות`, explaining the
  *verification* engine: how information is ingested, modelled, evidenced,
  assessed, searched and published. It walks the seven backend domains, the
  end-to-end routes through them, the iron rules, and a glossary. It was
  described here as an explainer for the particle engine until 2026-09-01; that
  was simply wrong, and the two engines have nothing to do with each other.
- [`project-map.html`](project-map.html) — the generated repository map, below.

## The interactive map

[`project-map.html`](project-map.html) — **generated, never hand-edited**, and
in Hebrew like [`engine-explainer.html`](engine-explainer.html). Run
`npm run map` to rebuild it from the repository as it actually is: every count,
size, route, import edge and boundary check on that page is scanned at run time
by [`scripts/project-map.mjs`](../scripts/project-map.mjs). It lists every
tracked file with a Hebrew explanation, and a flowchart mode with pan/zoom
diagrams. Click any file, folder or node to open the explanation drawer.
`npm run map:check` exits non-zero when the page has drifted from the tree, so a
new area cannot quietly go undocumented.
