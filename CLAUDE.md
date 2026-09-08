# CLAUDE.md

This file provides non-visual implementation guidance to Claude Code when
working with code in this repository.

@AGENTS.md

## Owner authority

The current user is the sole developer and project owner. Their direct task
instruction overrides repository notes and historical decisions.

## Repository and publication

Lions of Zion is a Next.js public site with an information-model backend under
`app/api/` and `server/`. The repository is public: a push publishes source.

**A push to `main` deploys to Production.** This paragraph claimed the
opposite until 2026-09-04 — "a separate manual Vercel operation" — and it was
wrong twice in one session: both pushes were live on `lionsofzion.io` inside
two minutes. The mechanism is the GitHub integration on the Vercel project,
whose `productionBranch` is `main`; `vercel.json` disables git deployment for
exactly one branch (`briefing-packages`) and for nothing else. There are no
deploy hooks. Verify with
`vercel api "/v9/projects/<id>?teamId=<team>"` and read `link.productionBranch`.

Two consequences worth holding before pushing:

- **A schema change must be applied before the code that needs it is pushed**,
  not after. Migration `0051` added an `entity_type` value the operations
  console writes on every tool call; the push reached Production first and the
  audit write would have failed on first use. `npm run db:migrate` against
  Preview, then Production, then push.
- **Production database credentials are not readable from this machine.** Every
  one of them is a Vercel *sensitive* env var, which is write-only by design:
  `vercel env pull` and `/v9/projects/:id/env?decrypt=true` both return an
  empty value, and the var's `contentHint` says the secret lives in the Neon
  integration rather than in Vercel. `.env.local` holds a real connection
  string, but it is a **Preview** branch (`DATABASE_RESOURCE_ENV=preview`,
  endpoint `ep-old-feather-…`); Production is the Neon `main` branch on a
  different endpoint. Get it from the Neon Console, or authenticate `neonctl`.

## Reference documentation

**`docs/editorial-dna.md` is the binding definition of what this site and this
system are** — an owner ruling recorded 2026-09-06. It outranks this file and
every other document here; where one of them contradicts it, the other one is
wrong. Read it before any editorial, routing, homepage or media work.

Operational reference lives in `docs/architecture.md`, `docs/api.md`,
`docs/data-model.md`, `docs/environment.md`, `docs/operations.md`,
`docs/whole-site-updates.md`, `docs/briefing-packages.md`, and
`docs/vercel-infrastructure.md`.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:changed
npm run verify:full
```

## Backend architecture

An information-model API: sources are ingested, evidence is attached to items,
assessments are reviewed by a second human, and published items are searchable.
Neon, Blob and AI Gateway **are provisioned and live in Production** — see the
wired-infrastructure list in
[`.claude/skills/project-invariants/SKILL.md`](.claude/skills/project-invariants/SKILL.md),
and `docs/vercel-infrastructure.md` for the topology. This paragraph claimed the
opposite until 2026-08-27 while another section of this same file described the
live stack, so treat the wired list as authoritative if anything here drifts
again. Frontend work must still not silently provision or mutate those
services.

### The backend detail lives in a skill

The layering rules, the module shape, the cross-cutting invariants, the wired
infrastructure and the test harness are documented in
[`.claude/skills/project-invariants/SKILL.md`](.claude/skills/project-invariants/SKILL.md).
They are loaded on demand when a task touches `server/`, `app/api/` or
`lib/publication-routing.ts`, rather than competing for attention during
frontend work. **Read that skill before editing backend code.** In one line
each, so a reader knows what is there:

- **Layering is lint-enforced, not convention** — `eslint.config.mjs` states it
  as errors, and `tsc` cannot see any of it. A route importing the database
  typechecks perfectly.
- **`recordVersion()` is the only write path for a versioned entity**;
  **`emit()` writes job intent inside the causing transaction**; **only the
  WebSocket `neon-serverless` driver may be exported** from
  `server/db/client.ts`.
- **RLS is engaged at runtime** through `withDatabaseRole`, which is also the
  one real untested mechanism.
- **Business rules live in SQL triggers as often as in TypeScript**, so changing
  one usually means a new numbered migration. Read the *highest-numbered*
  migration that defines a trigger, never the one that introduced it.
- **Get the module list from `ls server/modules`**, and count every other
  asserted number at its source. Both have been wrong in this file before.

`docs/architecture.md` remains the full system map.

### The whole-site editorial update, and the one article that may cite nothing

**Read [`docs/editorial-dna.md`](docs/editorial-dna.md) first.** It is the
owner's binding definition of what this site and this system are, recorded
2026-09-06, and it outranks this file. What follows is only the part an
implementer is most likely to break.

The system is not a Daily Brief. A run is a **whole-site editorial update**
composed outside this repository and delivered in: it researches, creates,
updates, publishes, attaches images, routes, recomposes the homepage, and
reports. It owns **five destinations** —

| Destination | Route | Sections |
| --- | --- | --- |
| News & Analysis | `/geopolitical-brief` | `daily_brief`, `israel_update`, `news` |
| Fake Resistance | `/fake-resistance` | `narrative_watch`, `influence_investigation`, `antisemitism` |
| The People of Israel | `/people-of-israel` | `people`, `courage_service`, `innovation`, `technology_ai`, `science_medicine`, `achievement`, `international_cooperation`, `history_context` |
| October 7 | `/october-7` | none — a static archive a run never writes into |
| Behind the Desk / How It Works | `/information-war` | none — `SYSTEM_LINK` in `components/site/navigation-model.ts` |

Refutations are `narrative_watch`, because an anti-Israel news item *is* a
narrative — that owner ruling (`.ai/DECISIONS.md`, 2026-09-01) is what avoided
a new section, an enum migration, and a frontend routing change. The
`war_update` section was removed completely on 2026-09-05: `/war-update` is a
permanent redirect and security material feeds the Daily Brief. (This
paragraph said "the section contract has three values" until 2026-09-06;
`PUBLICATION_SECTIONS` in `server/contracts/enums.ts` has fourteen. Count it at
the source or do not state it.)

Our Heroes and Israel's Story were **not deleted** when The People of Israel
absorbed them: `/our-heroes` and `/israels-story` keep their addresses and
their shells, recorded as `LEGACY_SECTION_PAGES` in `lib/site-navigation.ts`.

Four invariants an editor must not break:

- **`publication.section` is the only editorial choice, and every surface is
  derived from it** in `lib/publication-routing.ts` — hub, route, homepage
  band, homepage kind, breadcrumb, card label. There is deliberately no
  `homepageCategory`, `destination` or `frontendSection` for a model to pick.
  A second model-set field plus scattered
  `section === "narrative_watch" ? … : …` ternaries is exactly how a record
  ends up filed as news on the homepage and as a claim assessment on its own
  page. Derive lists from `SECTIONS_BY_HOMEPAGE_SECTION` rather than writing
  them by hand — `LiveBriefHub` hardcoded `["daily_brief", "israel_update"]`
  and rendered `news` records nowhere until 2026-09-06.
- **A Narrative Watch record may publish citing nothing**, marked in public as
  this organisation's own analysis. `evidenceBasis` is **derived, never chosen
  by the model** — it is exactly `evidenceIds.length === 0`, set by
  `applyEditorial` on create and merged back from the stored row on update
  (`updatePublicationSchema` omits the field on purpose). It is also
  **all-or-nothing**: an analysis article cites nothing anywhere, and a
  half-sourced one is rejected by the `createPublicationSchema` refine.
- **`narrativeWatchTitle()` in `server/contracts/publication.ts` is the only
  headline prefixer.** It was duplicated across two modules with divergent
  recogniser regexes; left unmerged, a refutation rendered as
  "Reported claim: Analysis: X". Read `evidenceBasis` as `=== "analysis"` and
  never as `!== "analysis"` — rows predating the field carry no key, and an
  absent value must fall to the strict side.
- **No quality check is ever skipped, and exemptions live *inside* a pass
  condition**, following `daily_brief_official_context`. **Read the rest of
  this bullet before relying on it** — this paragraph described two enforcement
  layers until 2026-09-05, and both had already been removed on 2026-09-03.

  What is true now:

  - `REQUIRED_QUALITY_CHECKS` lives in `server/modules/briefing/quality.ts`.
    **Do not quote its length here or anywhere else** — this file said "now 18"
    against an array of 17, and `docs/architecture.md`/`docs/data-model.md`
    said "eighteen" in six more places. Count it at the source or do not state
    it.
  - The **SQL trigger no longer counts anything.** Migration `0049` replaced
    `enforce_publication_publish_gate()` with a body that has no
    `briefing_quality_check` query, no twelve-name subset and no
    `quality_passes <> 12` raise. Migration `0060` is the current body: it
    enforces machine **provenance** — a `briefing_run_id` with a
    `briefing_candidate_key`, *or* an `editorial_run_id` with an
    `editorial_operation_key`, plus a non-empty `machine_author`.
  - **`publications/repo.ts` does not count them either** — `595ca9d` deleted
    `qualityCandidatePassed()` and the import. `grep -c REQUIRED_QUALITY_CHECKS
    server/modules/publications/repo.ts` returns 0.
  - So the deterministic suite runs on **exactly one path**:
    `evaluateCandidate()` in `external-publish.ts`, i.e. the legacy
    `external-briefing-v1` ingest at
    `POST /api/internal/briefing/external-publish`. **The whole-site path has
    no quality gate**, by owner ruling — see the launch posture below.
  - The internal briefing initiator is retired: no Vercel cron, queue trigger,
    admin action, or operations-agent tool may start research, drafting, or a
    daily edition. The legacy implementation and its records remain only for
    compatibility and historical inspection.

  The rule at the top of this bullet still holds for the path that has checks.
  What is gone is the belief that SQL will catch you if you break it.

**Launch-period posture, by owner ruling (2026-09-06).** During the run-in
period the system carries the minimum enforcement that protects it and no more:
no `external-briefing-v1` as the central constraint, no heavy quality
contracts, no editorial gates, no quotas, no candidate caps, no balance quotas,
no redundant validation loops. What stays is auth, database integrity,
persistence, media safety, security, idempotency and transactions where they
are needed, and enough parsing that nothing crashes. Do not add an editorial
gate back without an owner instruction; ordered contracts return after launch.
`docs/editorial-dna.md` §11 lists both halves precisely.

**Delivery, in one line.** Baseline `main`; delivery branch `chatgpt-editorial-updates`
(excluded from Vercel in `vercel.json`); package
`editorial-updates/<Israel-local-date>-<runId>.json`; contract
`whole-site-update-v1` (`server/contracts/whole-site-update.ts`); ingest
`POST /api/internal/editorial-updates/ingest`; status
`GET /api/internal/editorial-updates/runs/{runId}`. The mechanism is
`docs/whole-site-updates.md`. The contract is `.strict()` and describes content
and placement only — there is no representable field for SQL, a command, a
migration, an environment value, or application code, which is what makes the
run's auto-fix boundary structural rather than a matter of trust. Homepage
placements are three areas (`news`, `fakeResistance`, `people`) × two positions
(`lead`, `secondary`); October 7 is not placeable.
