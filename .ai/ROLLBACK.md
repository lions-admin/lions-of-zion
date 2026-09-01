# Rollback

How to undo a bad production deploy on this project. `CLAUDE.md` is explicit
that git auto-deploy is not connected — production deployment is a separate,
manual Vercel operation — so a bad deploy on `main` does not automatically
reach production, and rolling back does not require a git revert either.

## Fastest path: Vercel Instant Rollback

1. Open the project in the Vercel dashboard → **Deployments**.
2. Find the last deployment that was known-good — the one before the one
   you're rolling back from. Every deployment is tied to a specific commit
   SHA, shown in its details; cross-check against `git log` if you need to
   confirm which commit that was.
3. Open that deployment's **⋯** menu → **Promote to Production** (this is
   Vercel's "Instant Rollback" — it re-points the production domain at an
   already-built deployment, so it's immediate, no rebuild required).
4. Confirm the promotion. Production traffic now serves the previous
   deployment.

This is the right move for "the thing we just shipped is visibly broken and
we need it gone now" — it does not touch `main`, does not require a new
build, and is reversible the same way if the rollback itself turns out to
be wrong.

## After rolling back

- **Verify the rollback actually took**: load the live production URL and
  confirm it shows the previous, known-good content — not just that the
  Vercel dashboard says the promotion succeeded. Check a page you know
  changed in the bad deploy (its content, or its build ID if visible) to
  be sure you're not looking at a cached edge response.
- **Don't silently leave `main` ahead of production**: the rollback means
  `main` now contains commits that are not live. Note this state explicitly
  (a comment on the PR/commit that caused the issue, or a note in
  `.ai/STATE.md`) so the next session doesn't assume `main` matches
  production and re-attempt the same broken deploy without a fix.
- **Fix forward on `main`, then redeploy manually**: per `CLAUDE.md`, the
  next production deploy is still a manual Vercel operation once the fix
  lands — there's no auto-deploy to worry about re-triggering the same bug.

## If the bad deploy already changed data, not just code

This project's backend (Neon Postgres, evidence/assessment tables) is
provisioned and live in production as of 2026-08-26 — this said
"unprovisioned" until 2026-08-27 and cited `.ai/STATE.md`, which by then said
the opposite. **This section is therefore more relevant, not less**: a rollback
can now leave behind data a bad deploy wrote. Once it is
provisioned, a rollback of the frontend deployment does **not** roll back
any database writes that happened while the bad version was live (e.g. a
`report` submitted through the broken `POST /api/v1/reports` endpoint).
Check `server/db/migrations/` for the current schema and consider whether
the bad deploy could have written data with a shape the rolled-back code
no longer expects, before assuming the rollback alone is sufficient.

## What this does *not* cover

- Rolling back a bad `npm run bake:nav-lion` / `bake:nav-icons` /
  `poster:nav` asset bake — those are static files in `public/`,
  committed to git like any other file; reverting the commit that changed
  them and redeploying is the right move there, not a Vercel promotion.
- Rolling back environment variable changes made directly in the Vercel
  dashboard (`DATABASE_URL`, `AI_GATEWAY_API_KEY`, etc.) — Instant Rollback
  only repoints which build serves traffic, it does not restore a previous
  environment variable value. Check the Vercel project's environment
  variable history separately if a bad env change is part of the incident.

## Briefing-specific data recovery

The Daily Brief is a separate operational stream. A code rollback does not
remove an article or undo a scheduled job that already wrote to Postgres.

1. Immediately pause automatic publication from the administrator control.
2. Archive an incorrect public article. This removes it from public APIs,
   homepage placement, sitemap, and cache projections while preserving sources,
   evidence, model runs, versions, and audit history.
3. If a schema migration or bulk cleanup needs reversal, create/verify a
   PostgreSQL backup first and restore it only to a newly provisioned isolated
   target with:

   ```bash
   RESTORE_DATABASE_URL='postgresql://isolated-target' \
     npm run briefing:restore:verify -- /secure/path/backup.dump --isolated
   ```

4. Inspect the restored migration journal, publication/evidence counts, and
   the public smoke endpoints before deciding on a forward repair. Never point
   the restore command at Production.
5. Raw briefing captures are private objects under `briefing/raw/`. Retention
   and cleanup never operate on the October 7 archive resource.

## Rows that outlive the code that wrote them

Three shapes written from 2026-09-01 onward do not roll back with the code,
because nothing about them lives in a migration. Check each one before
promoting an older deployment.

**Publications marked as unsourced analysis.** `narrative_watch_details` is
jsonb, so `evidenceBasis` arrived without a migration and leaves without one. A
row carrying `"evidenceBasis": "analysis"` is a record that cites nothing
deliberately, and code from before that field has no branch for it. It renders
as an ordinary sourced report that happens to list no sources, with the badge,
the disclosure paragraph and the evidence-basis row all absent — and the public
headline comes out **"Reported claim: Analysis: …"**, because the older
read-time prefixer does not recognise the newer prefix and adds its own in
front. A record the site published as its own reasoning is then labelled a
reported claim. That is the exact artefact the marking exists to prevent, so
leaving one live under rolled-back code is worse than the deploy being undone.
Find them first, and archive them (step 2 of the list above) before promoting:

```sql
SELECT public_id, title FROM publication
WHERE narrative_watch_details->>'evidenceBasis' = 'analysis';
```

**Outbox rows on a retired topic.** `item.detected` has had no producer since
2026-09-01 but keeps a registered consumer in `server/jobs/consumers/index.ts`
precisely so that rows a previous deploy wrote can still be acknowledged —
`dispatchOutboxMessage` throws on an unregistered topic, and a queue message
for one then retries against that throw until the queue gives up. Whatever a
rollback or a forward fix does to the rest of that change, **the consumer
registration has to survive until the pending count is zero**:

```sql
SELECT count(*) FROM outbox
WHERE topic = 'item.detected' AND published_at IS NULL;
```

Restoring the producers without restoring the consumer, and deleting the
tombstone before that count reaches zero, both produce the same failure: rows
that cannot be drained and a queue retrying into an exception. The two-deploy
retirement this belongs to is recorded in `.ai/DECISIONS.md` (2026-09-01).

**Quality-check rows counted by a code constant.** `qualityCandidatePassed`
requires the number of recorded checks for a candidate to equal
`REQUIRED_QUALITY_CHECKS.length` exactly, so an edition whose checks were
written under one version of that list cannot be automatically published by
another. Moving across a change to the list strands the in-flight edition's
automatic publication in *both* directions — a rollback does it as surely as
the deploy did. **Cross that boundary between editions**; the run is 07:00
Asia/Jerusalem. An edition caught mid-flight is not lost: its articles can be
published from the administrator's publication manager by hand.
