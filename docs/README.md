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
| [`archive-integration.md`](archive-integration.md) | Bringing the two October 7 testimony archives onto `/october-7`. Phase 1 done, Phases 2–4 open |

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

- [`graphics-task-02.md`](graphics-task-02.md) — the 2026 specification for
  the navigation layer, kept for its reasoning. **Superseded**: it describes
  files that no longer exist. Do not follow it as instructions.
- [`engine-explainer.html`](engine-explainer.html) — a standalone explainer
  page for the particle engine.
