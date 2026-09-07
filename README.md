# Editorial updates delivery branch (`chatgpt-editorial-updates`)

This orphan branch accepts only root-level `editorial-updates/YYYY-MM-DD-<runId>.json` packages. Nested directories are intentionally not delivery inputs. The
workflow checks out `main` for validation and delivery tooling, posts each
package to the authenticated application receiver, polls its durable run, and
fails when a create, update, or homepage decision fails.

It contains no application code and must never be merged into `main`.

## The branch name

This branch was `editorial-updates` until 2026-09-07. It was renamed so the
scheduled ChatGPT editor writes to a branch named for what writes to it, and so
a path the automation once knew is no longer a path to anything.

The package **directory** is still `editorial-updates/` and the receiver is
still `/api/internal/editorial-updates/ingest` — renaming either would strand
in-flight deliveries and orphan the audit rows that already name the service.
Only the branch changed.

`editorial-updates` still exists and still holds every package delivered before
the rename. Its copy of this workflow now watches this branch instead, so a
push there delivers nothing.
