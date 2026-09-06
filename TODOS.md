# Lions of Zion — Master Project TODOS

**Updated:** 2026-09-06  
**Status:** Unified single source of truth for all outstanding tasks and repairs.  
**Architecture References:** `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `UX-CONTRACT.md`.

---

## 1. UI, Performance & Experience (P0 / P1)

- [x] **LCP Optimization (< 2.5s at 390px)**
  - *Context:* Current LCP measures ~5.8s–7.5s on mobile. `cls: 0` is already achieved and must be preserved.
  - *Actions:*
    - Optimize SSR rendering / caching in `app/page.tsx` (`export const revalidate = 60` with on-demand invalidation via `publication-cache.ts`).
    - Preloaded hero poster images (`lion-hero-poster-portrait.jpg` and `lion-hero-poster-desktop.jpg`) in `<head>` for immediate network fetch.
    - Added `priority={lead}` and `fetchPriority={lead ? "high" : "auto"}` in `HomeMedia` (`components/home/HomeJourneyPrimitives.tsx`).
  - *Files:* `app/page.tsx`, `components/home/HomeJourneyPrimitives.tsx`.

- [x] **Homepage Bundle Size Budget**
  - *Context:* Homepage gzip bundle was over the 310 kB target budget.
  - *Actions:* Code-split heavy client interactive components (`EditorialIntro`, `HomeEvidencePipeline`) in `components/home/HomeSystemSection.tsx` via `next/dynamic` with `{ ssr: true }`.
  - *Files:* `components/home/HomeSystemSection.tsx`, `scripts/perf-budgets.json`.

- [ ] **Physical Hardware Review (iPhone & Safari)**
  - *Context:* Automated testing passed in Chromium emulation (320px–1920px); real hardware validation is pending.
  - *Actions:* Verify touch targets (≥44px), font readability, smooth scrolling, and safe area insets on physical iOS Safari.

- [x] **No-JS Mobile Navigation Presentation Polish**
  - *Context:* When JavaScript is disabled on mobile (390px), the fallback navigation list expands inline above the hero.
  - *Actions:* Added dedicated, high-end editorial container style for the no-JS fallback navigation with "Navigation index" label, compact padding, and tightened font sizes on mobile.
  - *Files:* `components/site/site-header.module.css`.

---

## 2. Media Generation & Database Persistence

- [ ] **AI Image Generator Integration (`gpt-image-1.5`)**
  - *Context:* Image generation via the AI Gateway profile `gpt-image-1.5` is planned for automated editorial media generation.
  - *Actions:*
    - Implement provider client connecting through AI Gateway to `gpt-image-1.5`.
    - Apply strict provenance tracking, aspect ratio enforcement, and local/Vercel Blob storage writing (`BLOB_MEDIA_HOST`).
    - Enforce automatic `role: "editorial-illustration"` disclosure labeling.
  - *Files:* `server/modules/media/`, `server/contracts/editorial-media.ts`.

- [ ] **Canonical Database Persistence for Publication Media**
  - *Context:* Media currently resolves via `content-packages/homepage/media.json` and the local registry bridge.
  - *Actions:*
    - Finalize migration to store `media` directly on publication database records.
    - Ensure backwards compatibility for publications with null media.
    - Enforce audit history and versioning via `recordVersion()`.
  - *Files:* `server/db/schema/publications.ts`, `server/modules/publications/`, `lib/content/homepage-adapters.ts`.

- [ ] **Media Coverage for All Content Domains**
  - *Context:* Some older hero profiles and historical chapters lack rights-cleared visual assets.
  - *Actions:* Map rights-cleared, safe historical images or appropriate non-graphic covers. Never scrape or invent fake documentary evidence.
  - *Files:* `content-packages/homepage/media.json`, `lib/content/our-heroes.ts`, `lib/content/israels-story.ts`.

---

## 3. Editorial Workflow & Public Reading

- [ ] **End-to-End Rehearsal in Preview Environment**
  - *Context:* Complete research-to-publication cycle has not been rehearsed in full end-to-end flow with interruption recovery.
  - *Actions:* Run a full simulated daily edition cycle: research ingestion → claim matrix → drafting → quality checks → publication → outbox drain.
  - *Verification:* Confirm idempotent recovery upon simulated mid-flight failure.

- [ ] **Connect Automatic October 7 Public Material Recommendations**
  - *Context:* Newly ingested and verified external archival material needs automated recommendations to the October 7 desk while preserving sensitive content gates.
  - *Files:* `components/home/HomeArchiveSection.tsx`, `lib/content/documentation.ts`, `lib/content/testimonies.ts`.

- [ ] **Full Multi-Viewport Visual Matrix Pass**
  - *Context:* Required visual evidence matrix at 1440×900, 1280×720, 768px, 390px, and 320px across light/dark and high-contrast modes.
  - *Actions:* Capture before/after evidence screenshots for authenticated admin console, article views, and all hub surfaces.

---

## 4. Cloud Operations, Scheduling & Data Hygiene

- [ ] **Retire Legacy Agent Search Queries in Production**
  - *Context:* 8 new `agent-search-*` sources were deployed in `server/modules/sources/catalog.ts`. Because catalog sync is create-only, the 8 legacy queries must be deactivated to avoid duplicate spend.
  - *Actions:* Open Admin Console / run script to set `active: false` on the 8 retired Agent Search sources.
  - *Doc Reference:* `server/modules/sources/catalog.ts` (catalog sync only creates; changed queries require a new slug).

- [ ] **Execute Three Consecutive Clean Production Runs**
  - *Context:* 1 full automated daily briefing run completed successfully on Production; 2 more consecutive clean daily runs are required to declare stabilization complete.

- [ ] **Database Restore Dry-Run in Isolated Environment**
  - *Context:* Disaster recovery policy requires verified restore of database snapshot in an isolated Neon branch without affecting live Production.

---

## 5. Verified Completed Foundations (Reference)

The following core modules are implemented, tested, and verified clean in code (`git HEAD`):
- [x] **Homepage Editorial Journey:** 6 distinct chapters server-rendered via `HomepageJourney.tsx`, responsive hero aspect-ratio in `HeroVideo.tsx`, and unified CSS tokens.
- [x] **Fault Isolation:** `lib/homepage.ts` uses `Promise.allSettled` across all sections; missing data displays honest designed `SectionState`.
- [x] **Editorial Contracts & Schemas:** `server/contracts/homepage.ts`, `server/contracts/editorial-media.ts`, `server/db/schema/homepage.ts` (`homepageEdition`).
- [x] **Geopolitical Brief Rebuild:** Direct RSS/Atom feeds, verified claim matrices, author analysis disclosures, quality checks gate, and retired `war_update`.
- [x] **Admin Operations Console:** Run tracking, publication management, and capability checks.
- [x] **Test Coverage:** All unit/composition/contract tests passing (Vitest 100% green on changed suites).
