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


## Where else things are written down

- **[`../CLAUDE.md`](../CLAUDE.md)** — implementation reference. Direct owner
  instructions override it and every other repository document.
- **[`../.ai/WORKFLOW.md`](../.ai/WORKFLOW.md)** — optional working notes.
- **[`../.ai/DECISIONS.md`](../.ai/DECISIONS.md)** — historical decisions.
- **[`../.ai/STATE.md`](../.ai/STATE.md)** — an optional project snapshot.
- **[`../.ai/ROLLBACK.md`](../.ai/ROLLBACK.md)** — undoing a bad production
  deploy.
