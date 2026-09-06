# Editorial updates delivery branch

This orphan branch accepts only root-level `editorial-updates/YYYY-MM-DD-<runId>.json` packages. Nested directories are intentionally not delivery inputs. The
workflow checks out `main` for validation and delivery tooling, posts each
package to the authenticated application receiver, polls its durable run, and
fails when a create, update, or homepage decision fails.

It contains no application code and must never be merged into `main`.
