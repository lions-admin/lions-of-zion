# Automated Geopolitical Brief, News Articles, and Narrative Monitoring

## Current implementation state

The application contains the production pipeline and all public/admin
surfaces. Automatic publication is enabled only in Production and only after
the data-contract and quality gates pass. The database pause remains the
immediate stop control; Preview cannot publish. This protects the site from
repeating the defective first run while preserving the owner's chosen
automatic-publication workflow.

## Implemented in the repository

- Publication sections, public projections, source/evidence/narrative links,
  editorial filters, versions, audit records, corrections, related articles,
  three ordered homepage slots, canonical pages, sitemap, and social cards.
- Direct-source RSS/Atom connector and Google Agent Search connector with
  post-retrieval domain allowlist enforcement, publisher-family
  attribution, canonical URL normalization, deduplication, fetch audit rows,
  private raw Blob storage, and repeated-failure source disabling.
- Israel-local durable collection and editorial jobs with queue delivery,
  lease recovery, checkpoints, quarantine, pause/resume, idempotent stage
  records, and idempotent automatic-publication candidate keys.
- Structured OpenAI triage and drafting contracts using
  `openai/gpt-5-nano` and `openai/gpt-5-mini`; no change to Grok chat.
- Claim/evidence matrices, quality gates, budget ceilings, no partial-edition
  publishing, transparent machine provenance, and a Daily Brief/Narrative
  Watch contract that preserves uncertainty.
- Administrator health, usage, spending, queue, failed-run, draft/publication,
  traceability, edit, archive, and homepage-feature controls.
- Public Daily Brief hub, separate Israel and War updates, Narrative Watch,
  dated archive/filtering, homepage fallback headlines, and honest empty
  states.
- Production safety controls: resource isolation, Preview dry-run, safe fetch
  protection, origin/rate-limit checks, security headers, deep health checks,
  durable alerts, backup/restore/retention scripts, and runbooks.

## Ongoing production acceptance

1. Google Agent Search is provisioned with Workload Identity Federation and a
   least-privilege service account. Keep using the authenticated browser
   session for provider changes; do not create a static key.
2. Configure distinct Preview/Production environment variables and resource
   labels. Keep the briefing Blob store separate from the October 7 archive.
3. Create a backup and isolated restore target, then prove the restore drill.
4. Seed sources, verify feeds in the target environment, and enable only feeds
   with direct, usable publisher results.
5. Run a live collection with publication paused. Sample direct URLs, dates,
   excerpts, source families, and duplicate decisions.
6. Run three controlled full editorial packets with publication paused; review
   claim matrices and Narrative Watch output.
7. Verify the public and administrator experience in Chrome and physical
   mobile devices, then run the read-only production smoke command.
8. Test a controlled provider failure, alert, retry, quarantine, and recovery.
9. Production automatic publication is enabled by the owner decision. Keep
   the database pause as the immediate stop control; pause publication if an
   acceptance check fails, remediate it, and rerun the affected checks before
   resuming it.

Detailed commands and acceptance evidence are in
`docs/briefing-operations.md`. The task-level rebuild checklist remains in
`GEOPOLITICAL_BRIEF_REBUILD_TODOS.md` and must not be marked complete before
those provider and live acceptance actions are recorded.
