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

- **[`../CLAUDE.md`](../CLAUDE.md)** — the working brief: stable architecture
  and the invariants an editor must not break. Read it before changing code.
- **[`../.ai/DECISIONS.md`](../.ai/DECISIONS.md)** — **the ADR log.**
  Append-only, newest first. It records *why* durable choices were made; git
  records what changed. One entry per decision a later reader would otherwise
  re-litigate or accidentally undo.
- **[`../.ai/STATE.md`](../.ai/STATE.md)** — a snapshot of where the work
  stands right now. Rewritten in place, not appended to.
- **[`../.ai/DESIGN-V2.md`](../.ai/DESIGN-V2.md)** — the reading-page type and
  layout system. Read before touching reading-page CSS.
- **[`../.ai/ROLLBACK.md`](../.ai/ROLLBACK.md)** — undoing a bad production
  deploy.
- **[`../TODOS.md`](../TODOS.md)** — the Hebrew delivery plan; the place to
  check what is considered unfinished.
- **[`../components/content/README.md`](../components/content/README.md)** —
  every prop of the shared content-presentation components.

## Historical

- **[`archive/`](archive/README.md)** — documents that were true, did their job,
  and are kept for the record rather than for use. Nothing in it is a source of
  truth, and nothing in it is to be corrected to match the present. It holds the
  closed design audit (83 of 83) and its 219 KB evidence report, the superseded
  navigation-layer specification, and an orphaned external review.
- [`engine-explainer.html`](engine-explainer.html) — a standalone explainer
  page for the particle engine.

## The interactive map

[`project-map.html`](project-map.html) — **in Hebrew**, like
[`engine-explainer.html`](engine-explainer.html). Four hand-drawn SVG flow
diagrams, each showing one mechanism you cannot infer from a directory listing:
the lint-enforced wall between the two halves and the single import that crosses
it; the role every request is assigned before its route runs; how ~1,190 pages
are derived from package indexes rather than written by hand; and the one
invariant CI cannot see. Hover or click any node for its explanation.
Self-contained: open it from disk — no server, no network request.
