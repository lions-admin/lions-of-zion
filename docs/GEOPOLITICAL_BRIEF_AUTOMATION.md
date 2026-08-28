# Automated Geopolitical Brief, News Articles, and Narrative Monitoring

## Status

**In progress.** This document is the dedicated implementation checklist for
the automated editorial pipeline. It is intentionally separate from
`TODOS.md`.

## Product decision

- Google Search and verified RSS feeds discover public source material.
- OpenAI processes, classifies, edits, and drafts English editorial content.
- The existing Grok-powered public chat remains unchanged and is not part of
  this pipeline.
- Eligible output is published automatically each day under the approved
  editorial policy. The administrator can immediately unpublish, archive, or
  delete any article from the admin area.
- The system must not invent articles, sources, claims, or citations. A failed
  or empty run creates no publication.
- X is not used for discovery, analysis, or publication in this feature.

## Implementation checklist

### Content model and publication safety

- [ ] Add the `daily_brief`, `israel_update`, `war_update`, and
      `narrative_watch` publication sections.
- [ ] Link publications to narratives, source evidence, and information items.
- [ ] Add three ordered homepage feature slots for published content.
- [ ] Add public read models and endpoints that exclude drafts and internal
      analysis.
- [ ] Preserve version, source, model-run, and publication history for every
      generated article.

### Discovery and source monitoring

- [ ] Add Google Search discovery with query, result, citation, and retrieval
      audit records.
- [ ] Keep RSS ingestion, verify feeds before activation, and surface failed or
      stale feeds in the admin area.
- [ ] Group duplicate and syndicated reporting by source family rather than
      treating repeated copies as independent confirmation.
- [ ] Record original publisher, canonical URL, language, source category, and
      collection time for each discovered result.
- [ ] Run topic and narrative queries covering Israel, the war, the IDF,
      hostages, Iran, Hamas, Hezbollah, regional security, international
      reporting, and hostile or misleading narratives.

### OpenAI editorial pipeline

- [ ] Add dedicated OpenAI model profiles for triage and drafting without
      changing the Grok chat profile.
- [ ] Use `GPT-5 Nano` for relevance, duplicate assistance, claim extraction,
      topic routing, and narrative matching.
- [ ] Use `GPT-5 Mini` for English brief, article, and narrative-watch drafts.
- [ ] Require validated structured output. Invalid model output produces no
      draft or publication.
- [ ] Preserve the distinction between source claim, observed fact, analysis,
      editorial conclusion, and uncertainty.
- [ ] Present the official Israeli position first and centrally while keeping
      claim confidence tied to the available source record.
- [ ] Publish up to one daily brief, five news or analysis articles, and three
      narrative-watch articles per Israel-local day.
- [ ] Stop drafting at the feature-specific daily or monthly budget limit while
      preserving collected evidence for a later run.

### Admin and public experience

- [ ] Show collection health, query usage, RSS status, draft/publication queue,
      narrative activity, model spend, and failed runs in the admin dashboard.
- [ ] Allow the administrator to edit, regenerate, publish, unpublish, archive,
      delete, and feature an article.
- [ ] Turn `/geopolitical-brief` into the Daily Brief and Updates hub.
- [ ] Add separate canonical article pages at `/articles/[publicId]`.
- [ ] Add the Narrative Watch and Global Trends area to the brief hub.
- [ ] Add featured leading headlines and article links to the homepage.
- [ ] Add article metadata, structured data, sitemap entries, sources,
      corrections, and related context.

### Scheduling and verification

- [ ] Keep RSS collection on the existing recurring ingestion schedule.
- [ ] Run Google discovery once daily with a 5,000-query monthly hard limit.
- [ ] Run the editorial pipeline at 07:00 Israel time with idempotency by local
      date and pipeline stage.
- [ ] Set a $0.50 daily and $10 monthly OpenAI ceiling for this feature.
- [ ] Verify collection, deduplication, automatic publication, unpublishing,
      public API isolation, homepage placement, mobile rendering, and recovery
      after a failed run.

## Provider setup still required

- [ ] Create and provide the Google Search credential in the authenticated
      browser session.
- [ ] Add the Google credential and the briefing budget settings to the
      production environment.
- [ ] Run a controlled production collection and publication smoke test after
      the credential is configured.
