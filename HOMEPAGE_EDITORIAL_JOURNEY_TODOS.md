# Homepage editorial journey — implementation TODOs

**Status:** local implementation in progress; the implementation and evidence report are maintained separately below.
**Repository:** `/Users/danielsmac/Documents/lions-of-zion`
**Code inspection date:** 2026-09-05, against the current working tree, including uncommitted changes.
**Scope of the original brief:** specification first. The owner later authorized implementation locally; no production migration, provider-side write or deployment is included.

**Implementation evidence:** `docs/reviews/homepage-editorial-journey/REPORT.md`
**Latest local media curation:** `content-packages/homepage/imagegen-manifest.json`

All project-relative paths below resolve from the repository root above. Paths labelled **new** are proposed implementation locations, not existing files. Recheck mutable implementation details before coding; do not revert unrelated work.

## 1. Outcome and non-goals

Rebuild `/` as one guided editorial journey through the Lions of Zion ecosystem:

**What is happening now → what claims are being challenged → what evidence is preserved → who the people are → what historical context matters → how the system works → why the information war matters.**

The homepage is an edited introduction, not a second copy of each destination. It must offer meaningful context before a click while leaving investigations, full reporting, testimony, documentation and long-form explanation at their canonical destinations.

Preserve the cinematic lion opening and the existing editorial identity. Continue below the hero with real content. Do not build a news portal, dashboard, uniform card grid or generic marketing landing page.

### Boundaries

- Local implementation and local verification first. No commit, push, production migration or deployment without a separate owner instruction.
- Preserve the current lion video sources, poster fallback, playback controls, reduced-motion behavior and brand typography.
- Preserve destination URLs, existing article content, publication permissions, lifecycle states, evidence classifications and sensitive-media boundaries.
- No generated news, fabricated findings, invented source counts, fake review claims, AI-generated documentary imagery or invented source relationships.
- Do not expand this into a new CMS, portrait-submission service, archive redesign, authentication redesign or general site refactor.
- A new homepage edition store is distinct from the publication lifecycle. It must not alter publication eligibility or quality gates.
- `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `eslint.config.mjs`, `DESIGN.md` and `UX-CONTRACT.md` are implementation references. The current owner brief defines the requested change; older single-viewport homepage decisions must be explicitly superseded, not silently retained.

## 2. Verified repository map

### 2.1 Homepage and shared UI

| Existing path | Actual role / implementation implication |
| --- | --- |
| `app/page.tsx` | Async homepage; reads `featuredPublications()`, renders `SiteHeader`, lion hero, introduction trigger and rotating signal rail. It does not currently compose the proposed ecosystem journey. |
| `app/home.module.css` | Homepage layout, hero composition, action treatment, rail and mobile overrides. Keep hero-scoped media behavior; do not stretch its absolute video layer across the new long page. |
| `components/sections/HeroVideo.tsx` | Existing lion playback owner. Preserve rather than replacing it with a second video system. |
| `components/home/EditorialIntro.tsx` and `components/home/editorial-intro.module.css` | Optional introduction dialog and replay trigger. Preserve dialog accessibility and existing copy; move the replay invitation out of the first viewport for this brief. |
| `components/home/SignalRotator.tsx` and `components/home/signal-rotator.module.css` | Client-driven headline replacement. Remove its use from the new homepage; do not reinterpret a daily edition as this timer. Remove implementation files only after checking all consumers/tests. |
| `lib/content/home.ts` | Legacy milestone aggregation over static editions, not the current live-publication source and not a daily selection engine. Do not revive its milestones as latest news. |
| `components/site/SiteHeader.tsx`, `components/site/SiteFooter.tsx`, `components/site/EditorialShell.tsx` | Shared chrome. The reading shell also owns backdrop/progress conventions; do not wrap the existing homepage in it blindly or create nested main/header landmarks. |
| `app/layout.tsx`, `app/globals.css` | Font loading, session/Ask mounting, canonical design tokens. Reuse typography, ink, gold, spacing and control tokens. Do not create a second font or theme system. |
| `components/ask/PublicAskDock.tsx`, `components/ask/ask.module.css` | Persistent Ask entry. New sections must remain readable and actionable without this control obscuring them. |
| `components/ui/Button.tsx`, `components/live/publication-labels.ts`, `components/live/feed-time.ts` | Existing actions, section/verdict labels and time presentation. Reuse semantics rather than inventing parallel labels. |

### 2.2 Canonical content access and destinations

| Section | Existing content seam | Destination and stable identity |
| --- | --- | --- |
| News & Analysis | `lib/publications.ts`: `listBriefingPublications()`, `getPublicPublication()`; `server/contracts/publication.ts`: `PublicPublication`, `PublicPublicationDetail` | `/geopolitical-brief`; articles at `/articles/{publicId}`. Use `publicId`, not headline or array position. |
| Narrative Watch | `lib/content/fake-resistance-watch.ts`: `getNarrativeWatchFeed()` | `/fake-resistance/watch`; individual publications at `/articles/{publicId}`. Current feed window is 25 records. |
| Investigations | `lib/content/fake-resistance-cases.ts`: `getCaseIndex()`, `getCase(slug)`; package at `content-packages/fake-resistance/` | `/fake-resistance/cases/{slug}`; retain `caseId` and `slug`, respect the loader's lifecycle/suppression rules. |
| Narrative depth | `lib/content/fake-resistance.ts`, `lib/content/fake-resistance-editorial.ts`, `lib/content/fake-resistance-playbook.ts` | `/fake-resistance/official-narrative`, `/fake-resistance/social-media`, `/fake-resistance/network`, `/fake-resistance/playbook`. Do not copy these bodies into `/`. |
| Testimony | `lib/content/testimonies.ts`: `getTestimonyIndex()`, `getTestimony()`; package `october7` | `/october-7/testimonies/{slug}`; index `id` resolves through the existing loader. |
| Documentation | `lib/content/documentation.ts`: `getDocumentationIndex()`, `getDocumentationRecord()`, `categorySlug()`; package `hamas-massacre` | `/october-7/documentation/{categorySlug(category)}/{id}`. Do not invent categories or omit this URL segment. |
| Archive media | `lib/content/archive.ts`: `getMediaRegistry()`, `withCoverThumbs()`, `pickVersion()`, `assetUrl()`, `assetSrcSet()`; `lib/content/archive-display.ts` | Package-scoped media IDs and `canonical_story_id`. Use display-title helpers and language fallbacks, not raw imported breadcrumbs. |
| Our Heroes | `lib/content/our-heroes.ts`: `getOurHeroesEdition()`, `HeroProfile` | `/our-heroes#{id}`. Profiles are anchored within `app/our-heroes/page.tsx`; there is no current `/our-heroes/{id}` detail route. |
| Israel’s Story | `lib/content/israels-story.ts`: `getIsraelsStoryEdition()`, `StoryChapter` | `/israels-story#{id}`. Chapters are anchored in `app/israels-story/page.tsx`, not standalone chapter routes. |
| System and purpose | `app/information-war/page.tsx`, `components/briefs/InformationWarSystem.tsx`, `components/briefs/information-war/pipeline-data.ts` | `/information-war#system` explains architecture; `/information-war#problem` introduces the problem. |

The news hub implementation to match is `components/briefs/LiveBriefHub.tsx`. It currently reads `daily_brief` and `israel_update` separately, at up to 50 each; Narrative Watch must not enter the news pair. `app/geopolitical-brief/page.tsx` owns its route. Do not split a daily briefing's aggregate headline into fictitious standalone articles.

The narrative hub is now `app/fake-resistance/page.tsx`, a wide investigation/monitoring entrance. `components/briefs/NarrativeRecord.tsx` owns current status-before-claim presentation. Preserve its existing destination behavior if introducing a homepage variant.

### 2.3 Corrections to the supplied direction

1. **Two is the target, not a license to fabricate.** Each content section selects at most two eligible records. Normal acceptance expects two; one/zero valid records must have honest designed states. A missing image or permission is a content gap, not an invitation to scrape a substitute.
2. **Existing pins are not a daily edition.** `homepage_feature` has three slots, accepting eligible `israel_update` and `narrative_watch` publications. It does not pin heroes, chapters or archives and does not record a seven-day display history.
3. **The public featured feed loses pin provenance.** `featuredPublications()` may return explicit pins or newest fallback records. A caller cannot infer which from the returned `PublicPublication[]` alone.
4. **Current pin lookup is windowed.** `server/modules/publications/service.ts::featured()` resolves pins against a latest-100 public list. A valid older pin can disappear from that window. The new selector must resolve explicit pin IDs directly and verify public eligibility, not rely on this search window.
5. **Media is missing from several contracts.** Publications have no cover field; hero profiles have no portrait field; historical chapters have no visual field. Archive media exists but does not provide a blanket rights/sensitivity clearance for homepage reuse.
6. **“Finding” is not universally available.** Narrative Watch carries `exactClaim`, `verificationState`, evidence IDs and context, but no dedicated public finding-summary field. Do not relabel `summary` or `israeliPosition` as a finding. Case index summaries lack `bottomLine`; load the selected case detail when a finding is needed.
7. **Research confidence is not a verdict.** `ResearchConfidence` and `CaseExhibit.verdict` are distinct. Do not map a case's high confidence or its source count to “Verified”, or assign one exhibit's verdict to an entire case.
8. **Review is path-specific.** The backend includes a human assessment path, an automated internal briefing path and external/direct import paths with different checks. Not every publication receives human review or the same deterministic checks. Some explanatory comments/data are stale; implementation takes precedence.
9. **“Why it matters” is not a universal field.** It requires an existing attributed passage or a reviewed, source-linked excerpt manifest. It must not be inferred from the title at render time.
10. **A daily seed over a changing feed is not stable.** A new candidate, cache eviction, deploy, content edit or concurrent process can change the selected pair. Persist the selected membership of each edition.

## 3. Cognitive and editorial experience contract

Use `/Users/danielsmac/.codex/skills/cognitive-psychology-ux/SKILL.md` as design rationale, not as permission to claim measured outcomes. No scientific law proves that exactly two choices is optimal for this audience; two is the owner's editorial constraint to test.

| Principle | Concrete implementation decision | Acceptance observation |
| --- | --- | --- |
| Progressive disclosure / bounded choice | Two visible examples per content domain; one section-level destination action. Keep exhaustive browsing at destinations. | A visitor can identify an entry point without opening navigation or learning the full taxonomy. |
| Recognition rather than recall | Each preview exposes its subject, medium, status and destination. Keep both items visible. | Returning from an article does not reveal a different carousel slide or a freshly randomized page. |
| Proximity and grouping | Place a claim beside its status, its finding and evidence qualifier; place credit beside its image. | The qualifier is not detached in a remote footer or hidden tooltip. |
| Reduce split attention | Remove repeating headline timers and competing autoplay below the hero. No automatic chatbot opening. | Reading is not interrupted by content replacement, scanner effects or unsolicited overlays. |
| Stable mental models | Distinguish report, monitored claim, research, testimony, documentation and historical context. | A visitor does not read “Unresolved” as “False” or an archive photo as a verified new report. |
| Ethical emotional pacing | Move from current reporting through evidence and memory to people/context, then explanation. No graphic surprise, spectacle or fear-based urgency. | Users can bypass any section and choose when to enter sensitive material. |
| Predictable interactions | Familiar links, visible focus, sufficient contrast, at least 44×44 CSS-pixel touch targets as the project's implementation target. | Keyboard/touch actions are discoverable without hover and not covered by Ask. |
| Coherent ending | End with a concise explanation and clear next step, not another inventory of ten stories. | After the journey, visitors can explain what distinguishes this site from a news feed. |

Do not promise universal recovery times, conversion gains or attention-span numbers from the skill. Evaluate comprehension and behavior with real users; do not optimize outrage or raw scroll depth at the expense of understanding.

## 4. Page structure and content anatomy

### HJ-01 — Preserve the opening signature

- [ ] Keep the lion video/poster and two-line wordmark; retain these exact words:

  ```text
  LIONS OF ZION
  Powered by evidence, not narratives.
  Read the latest
  Why this work matters
  ```

- [ ] Primary link continues to `/geopolitical-brief`; secondary link continues to `/information-war`.
- [ ] Keep this first viewport free of cards, statistics, taxonomy grids and competing editorial actions. Normal header/account/menu utilities remain.
- [ ] Move the introduction replay trigger to the closing system/purpose section. Preserve the existing dialog, keyboard support and no-JS behavior; do not force it to autoplay on first visit.
- [ ] Remove the current rotating rail from the homepage composition. Let the first stable news pair be the transition from brand to content; do not leave both a ticker and duplicated news previews.
- [ ] Retain necessary no-JS navigation currently authored in `app/page.tsx`; removing the rail must not remove its adjacent fallback navigation accidentally.
- [ ] Keep the hero's background confined to the hero. Add the journey as following sibling sections, not descendants of the absolute media layer.
- [ ] Correct homepage landmarks within scope: one main, site header/footer outside it, a skip link to meaningful page content. Reuse shared chrome without introducing a second header or an ambient scan backdrop below the lion.

### HJ-02 — News & Analysis: what is happening now?

- [ ] Two selected, separately published records, using `israel_update` and/or `daily_brief` only. Prefer current independent reporting; identify any selected daily brief as a briefing, not a single event.
- [ ] One large editorial feature and one smaller secondary feature. Both show approved, relevant images. Selection determines placement; do not label a story “most important” without an editorial decision.
- [ ] Each has image/credit, category, full headline, short summary, brief “Why it matters”, publication time and article link.
- [ ] Use approximately 30–55 words of summary and 15–30 words of significance as editing budgets, not blind substring truncation. Preserve qualifications. Never create significance text at request time with a model.
- [ ] If significance has no grounded excerpt, omit that labelled sub-block and record the gap in the curation report. Do not duplicate the summary under a new heading.
- [ ] Load `getPublicPublication(publicId)` for selected records when source attribution is needed; the list projection alone has no public source list. Count actual public references, not internal evidence IDs that cannot be inspected by the reader.
- [ ] Do not borrow Narrative Watch's verification badge for ordinary news with no equivalent field.
- [ ] Section action: **View all News & Analysis** → `/geopolitical-brief`.

### HJ-03 — Narratives & fact checks: what is circulating, and what is known?

- [ ] Two records selected from eligible Narrative Watch publications and/or case files, each with its own approved visual treatment. Use the current public section name from `lib/site-navigation.ts`; preserve `/fake-resistance` as its URL rather than reverting the navigation's newer wording.
- [ ] Prefer one current monitoring record and one investigation when both inventories support it. Otherwise two eligible records of one type are allowed, with their types explicitly labelled.
- [ ] Narrative Watch anatomy: **Claim → Finding/assessment availability → Verification → Evidence basis → Read**. Use `narrativeWatchDetails.exactClaim`, not a heuristically stripped headline when structured claim text exists.
- [ ] Keep `verified`, `refuted`, `misleading`, `unsupported`, `disputed`, `unresolved` mapped through the existing labels. Colour never replaces the word or its meaning.
- [ ] For missing finding text: explicitly state that the preview has no separate finding available. For unresolved status: state that no conclusion has been reached. Do not imply a verdict from a summary.
- [ ] Preserve `isAnalysisBasis(details)` and the exact-analysis check. Label unsourced work as the organisation's editorial analysis, not evidence-backed verification. Use an analysis action label where appropriate.
- [ ] Case-file anatomy: research question, a selected attributable `bottomLine` point or exhibit, its source links and limitations. Preserve exhibit-level verdict/confidence; where no single claim/verdict exists, label the item **Investigation**, not a fictitious fact check.
- [ ] Any screenshot of a circulating claim must be clearly labelled as a claim, preserve enough context and have approved reuse/redaction. No invented network graphics presented as findings.
- [ ] Section action: **Explore narratives & fact checks** → `/fake-resistance`. This is the current-label equivalent of the brief's “Explore Fake Resistance”.

### HJ-04 — October 7: what does the record preserve?

- [ ] Two records, preferably one testimony and one documentation record. Show different compositions: an account-led testimony and a restrained archival documentation window.
- [ ] Testimony uses existing display title/witness, excerpt, language and source context. Do not turn it into an analytical verdict or invent a quotation.
- [ ] Documentation shows record identity, category, medium, date when held, warning and a safe cover treatment. Link directly to the existing record route.
- [ ] Reuse archive media resolution rather than hand-building local/CDN paths. Resolve only the selected records' detail and media data; never send whole registries to the client.
- [ ] Preserve rules in `components/archive/ArchiveRecordPage.tsx`, `components/archive/ArchiveBlocks.tsx` and `components/content/SensitiveContent.tsx`: documentation is gated as a whole; testimony-associated video is gated. Do not infer “safe” merely from a package cover being present.
- [ ] Default homepage documentation treatment is a designed, non-graphic cover plus warning and **Open the documentation** link. It must not load graphic source media behind CSS blur or concealment. A source image may appear only when an independently cleared safe derivative is explicitly mapped.
- [ ] No autoplay, embedded player, video preload or consent inherited from another record. No sensitive content in alt text, preload tags, share previews or hidden client payloads.
- [ ] Section action: **Explore the October 7 Archive** → `/october-7`.

### HJ-05 — Our Heroes: who are the people?

- [ ] Flatten and deduplicate `[edition.featured, ...edition.profiles]` by `HeroProfile.id`; select two. The inspected edition has three profiles, so a strict seven-day exclusion is impossible with a two-per-day target.
- [ ] Use a portrait-led human composition: name, existing role, short sourced story, source attribution and full-context link. No numbered dossier tiles, counts of lives or recycled news-analysis anatomy.
- [ ] Link to `/our-heroes#{id}` using anchors already rendered by the destination.
- [ ] Do not infer portrait reuse rights from the profile being widely reported. Track image permission separately. Never invent a face or treat a generic person image as the subject.
- [ ] Preserve the content seam's public-reporting boundary and its disclosure that a family-consent submission workflow does not exist. Do not describe these as family-authorized memorials.
- [ ] Section action: **Read Our Heroes** → `/our-heroes`.

### HJ-06 — Israel’s Story: what context is missing?

- [ ] Two existing `StoryChapter` records. Present an archival composition with dates and a restrained timeline relationship, not another equal-card pair.
- [ ] Show approved historical image/credit, chapter era, title, concise introduction, grounded significance excerpt and sources.
- [ ] Derive dates from the actual chapter/timeline content. The edition publication date is not the historical event date or a review timestamp.
- [ ] Preserve `chapter.contested === true` as a visible **Contested** marker with a short explanation; do not derive it from an ID or erase it in the preview.
- [ ] Link to `/israels-story#{id}`. Keep the destination's acknowledged research gaps; do not add unresearched chapters to fill a visual period.
- [ ] Section action: **Explore Israel’s Story** → `/israels-story`.

### HJ-07 — System and purpose: how does the work become a public record?

- [ ] Switch the visual rhythm to a full-width explanatory diagram with readable text; do not show another pair of content cards.
- [ ] Explain the conceptual vocabulary: **Source → Evidence → Claim / Information item → Assessment → Review → Publication → Search / public access**.
- [ ] Do not draw that as a universal executed chain. Show a small, explicit branch/qualifier for path-specific review and a separate archive path. Search availability is limited to indexed material, not a claim that every archive asset is retrievable by Ask.
- [ ] Confirm wording against `docs/architecture.md`, `CLAUDE.md`, `server/modules/briefing/`, `server/modules/publications/` and the current import paths. `pipeline-data.ts` is useful UI data but its internal-quality wording must be reconciled before reuse.
- [ ] Reuse or extract explanatory data, not the whole `InformationWarSystem` page, `RecentActivity` panels or the autoplaying `PipelineTrace` widget. Homepage enhancement starts paused/user-controlled; complete static ordered text remains readable without scripting.
- [ ] Explain a **possible mechanism**, not a measured universal law: a narrative starts → amplification spreads it → repetition can feel like consensus → checking may take longer → the desk preserves, examines and publishes available material.
- [ ] Label any diagram as explanatory, not live telemetry. No fake scan logs, “AI processing now”, fabricated source totals or claims that all output is verified.
- [ ] Primary action: **Explore how the system works** → `/information-war#system`.
- [ ] Secondary: **Why this work matters** → `/information-war#problem`; optional relocated **Watch introduction** invokes the existing dialog.
- [ ] Close with shared footer navigation. The journey demonstrates breadth through real examples; do not add another oversized sitemap before the footer.

## 5. Media and grounded excerpt workstream

### HJ-08 — One reusable media contract, curated mapping first

**New:** `server/contracts/editorial-media.ts` — a Zod-only shared vocabulary.
**New:** `lib/content/homepage-media.ts` — server-only registry loader/validation.
**New:** `content-packages/homepage/media.json` — curated mappings, no secrets.
**New:** `content-packages/homepage/excerpts.json` — optional reviewed display excerpts with provenance.
**New:** `public/images/homepage/` — only approved, optimized local media/derivatives when local hosting is permitted.

- [ ] Use namespaced stable keys, for example `publication:{publicId}`, `case:{caseId}`, `archive:october7:{id}`, `archive:hamas-massacre:{id}`, `hero:{id}`, `chapter:{id}`. The case mapping retains its route slug separately.
- [ ] Each media entry contains `src` or package/media reference, media type, width, height, alt, credit, original source URL where applicable, caption, focal point/crop variants, sensitivity and usage authorization/provenance.
- [ ] Define source URL separately from the render URL. Include rights status, rights basis/reference, clearance date and approved surfaces. Unknown authorization means ineligible, not assumed permission.
- [ ] Media role distinguishes source documentation, portrait, archival context and explicitly labelled editorial illustration. Do not imply that contextual imagery depicts the specific event in the story.
- [ ] Sensitivity defaults to unknown. Only cleared safe media or a non-graphic designed cover is renderable on `/`; never downgrade archive policy through a registry override.
- [ ] Missing caption/alt/credit is a curation task, not a reason to copy arbitrary source-page prose. Credit remains visible near the image and survives loading failures.
- [ ] Excerpts record their content key, text, role (`summary`, `whyItMatters`, `finding`), exact source field/passage/reference and reviewed content version/date. They are view excerpts, not new homepage-only factual stories.
- [ ] Publication/source edits that invalidate an excerpt require re-curation; do not let an old finding survive a correction. Do not silently carry captions across a changed image.
- [ ] Never scrape images at request time, hotlink unapproved publisher media or substitute generated documentary evidence.
- [ ] Provide a gap report per selected item: unavailable image, rights unknown, safe derivative missing, excerpt not grounded or content withdrawn. Normal visual completion needs ten valid content entries with appropriate visuals, subject to the explicitly reported inventory exception.

### HJ-09 — Canonical content-media adoption, separate from the initial bridge

The registry is the initial source of curated assets; the shared contract is canonical from the start. Full database adoption is a separate deliverable, not a hidden prerequisite for rendering the first local design.

- [ ] Add optional shared-contract media references to `HeroProfile` in `lib/content/our-heroes.ts` and `StoryChapter` in `lib/content/israels-story.ts` after assets are cleared. Do not duplicate media definitions per page.
- [ ] Plan publication cover persistence through `server/contracts/publication.ts`, `server/db/schema/publications.ts`, `server/modules/publications/{service,repo}.ts` and the public projection/detail serializer. Preserve backwards compatibility for publications without media.
- [ ] If this phase is implemented, add a new numbered migration and appropriate versioning/edit provenance. Never edit a previously applied migration or bypass `recordVersion()` for publication changes.
- [ ] Explicit media reference on canonical content wins over the transitional registry. Emit a conflict report; do not silently select between differing credit/permission records.
- [ ] Keep archive media as the existing package model, adapted to the shared display vocabulary. Do not migrate entire archive packages into publication rows.
- [ ] Mark canonical database adoption as pending if only the registry bridge is delivered. Do not claim the media-model gap is fully closed.

## 6. Daily selection: stable edition, deliberate exceptions

### HJ-10 — Selection policy

- [ ] Edition key is the Gregorian date in `Asia/Jerusalem`, calculated on the server. Do not use UTC date truncation, visitor timezone, a fixed UTC+2 offset or a fixed 24-hour TTL as the calendar boundary.
- [ ] Every visitor receives the same active edition/revision. No random client selection, session-based variants, per-region candidate order or personalization.
- [ ] Select and persist membership once per local day from an explicitly captured eligible candidate set. A late ordinary publication does not replace the pair during the day.
- [ ] Eligibility is evaluated before ordering: published/visible canonical content, valid destination, appropriate cleared media, applicable source/status disclosures. Pinned invalid/withdrawn content never bypasses these rules; report why it was excluded.
- [ ] Explicit editorial pin overrides automatic selection. Major breaking-news replacement is an explicit editor action with reason, not inferred automatically from dramatic wording. It affects the news pair only unless the editor separately changes another section's pin.
- [ ] Keep both records in the DOM and visible while reading. A newly activated revision affects subsequent visits/reloads, not automatic swaps under the current reader.
- [ ] For evergreen sections use approximately seven local calendar days of persisted display history. Relax the cooldown progressively, oldest-shown first, when inventory is too small. Pins override cooldown; identity deduplication never relaxes.
- [ ] Separate recency of publication, research update date, historical event date and homepage selection date. Never label an old case “today's finding” because selected today.
- [ ] Use deterministic tie-breaking by stable content key. Exclude duplicate IDs across a pair and avoid duplicating the same canonical record across sections.
- [ ] Zero/one records produce designed honest states. Never clone one item, fabricate another or leave a blank half-width frame. Ordinary same-day additions must not fill a frozen short edition silently; an editor can publish an explicit revision.

### HJ-11 — Preserve and extend existing pins deliberately

Existing owners:

```text
server/db/schema/publications.ts                      homepageFeature (slots 1–3)
server/modules/publications/service.ts                featured(), setHomepageFeature()
server/modules/publications/repo.ts                   homepageFeatures(), setHomepageFeature()
app/api/v1/admin/homepage-features/route.ts             authenticated GET / PUT
app/admin/EditorialDesk.tsx                           current editing UI
server/core/publication-cache.ts                      expirePublicPublicationCache()
```

- [ ] Add a typed public/server composition read that preserves explicit pin metadata. Do not call the authenticated admin endpoint from the homepage or treat the public fallback list as pins.
- [ ] Resolve explicit publication IDs directly, with current public eligibility. Convert internal UUIDs to public IDs only at the server boundary.
- [ ] Partition existing pins by section: news pins go to news, Narrative Watch pins to narratives. Respect slot order within each destination pair, up to two. Keep all three existing stored slots; surface surplus pins as not displayed rather than deleting them.
- [ ] Add section-scoped evergreen pins through a reviewed manifest initially: **new** `content-packages/homepage/overrides.json`. It references content keys, ordering, optional expiry and reason; it is not a duplicate publication database.
- [ ] If a future consolidated pin UI replaces the legacy slots, specify migration, existing admin compatibility and rollback before implementing it. No silent loss of the current editorial control.

### HJ-12 — Durable edition storage and scheduling

This workstream is necessary for real daily stability, shared membership and a genuine cooldown. An in-memory Map, random seed or five-minute publication cache is insufficient.

Recommended bounded architecture:

```text
NEW server/contracts/homepage.ts
NEW server/modules/homepage/index.ts
NEW server/modules/homepage/service.ts
NEW server/modules/homepage/repo.ts
NEW server/modules/homepage/selection.ts
NEW server/db/schema/homepage.ts
NEW server/db/migrations/<next-number>_homepage_editions.sql
NEW app/api/internal/cron/homepage/route.ts
NEW scripts/homepage/build-catalog.ts
NEW content-packages/homepage/catalog.json
```

- [ ] Store immutable edition revisions with local `editionDate`, `revision`, activation time, selection reason, source catalogue revision, selected keys/order and display-history information. Enforce unique edition/revision and one active revision per date transactionally.
- [ ] Store selection references and necessary reviewed preview/version data, not copies of entire articles or sensitive media. Keep edition membership separate from the latest correction/withdrawal eligibility of the source record.
- [ ] The static catalogue generator imports existing content seams to produce a validated, reference-only eligibility catalogue for server scheduling. It must not create an alternative authored news/archive corpus. Backend modules must not import frontend components or `lib/content` modules that depend on frontend types.
- [ ] The backend edition service reads live publications through the publications module and the generated static catalogue for evergreen candidates. It owns selection/history/persistence, not JSX. The generator is run when static content/media/overrides change; catalogue staleness is detected and reported.
- [ ] The internal route follows `requireCron` from `server/http/internal-guard.ts`, calls the module's `index.ts`, and serializes. No database/business policy in route handlers, no unauthenticated edition mutation endpoint.
- [ ] A UTC scheduler invokes an idempotent `ensureEdition` frequently enough to cross Israel-local midnight correctly, including DST. Proposed cadence: every 15 minutes, with no rebuild if the date/revision is already active. Document the rollover window; do not promise exact midnight activation with this cadence.
- [ ] Update `vercel.json` only during an explicitly approved deployment step. Local work supplies the route, tests and scheduling instructions but does not activate a cloud job.
- [ ] At the first request after midnight before the new snapshot exists, serve the previous edition with its actual edition date and a brief delayed-edition state; never relabel yesterday's data as a completed new edition. Require a stricter schedule if exact midnight activation becomes a product requirement.
- [ ] Concurrent cron calls converge on one snapshot. Retry failure is idempotent. Build/database migration must not generate or publish editions as a side effect.
- [ ] Pin/breaking overrides activate an auditable new revision after commit and invalidate homepage selection caches. Existing article corrections/withdrawals invalidate relevant data immediately as they already do; daily membership must not preserve a withdrawn story.
- [ ] Withdrawal/invalid rights may remove an item immediately without silently replacing it. Reflect the reduced section honestly until an explicit revision. Rights/safety corrections are exceptions to visual stability, not suppressed until tomorrow.
- [ ] On database/selector failure, use a previously persisted public snapshot when available, retaining its date. With no snapshot, render the hero and explicit per-section unavailability/destination links, not a visitor-specific live selection fallback.

Do not add a second general scheduler, new provider, new queue topic or public editing UI unless required by this bounded flow. If queueing is introduced, follow existing transactional outbox rules. Read the relevant local Next caching guide before selecting cache APIs; expiry cannot merely be “86400 seconds after whichever request came first”.

## 7. Composition boundary and component ownership

### HJ-13 — Keep data access out of the React page

**New:** `lib/homepage.ts`, server-only composition entry, exporting `getHomepageEdition()`.
**New:** `lib/content/homepage-adapters.ts`, server-only canonical-reference resolution.
**New contract:** `server/contracts/homepage.ts`, Zod only, no database, `next/*`, filesystem or React imports.

Suggested output vocabulary, not a demand for one generic card shape:

```ts
type HomepageEdition = {
  editionDate: string; // YYYY-MM-DD in Asia/Jerusalem
  revision: number;
  generatedAt: string;
  state: "current" | "previous-edition" | "unavailable";
  news: HomepageSection<NewsPreview>;
  fakeResistance: HomepageSection<WatchPreview | CasePreview>;
  october7: HomepageSection<TestimonyPreview | DocumentationPreview>;
  heroes: HomepageSection<HeroPreview>;
  israelsStory: HomepageSection<HistoryPreview>;
};

type HomepageSection<T> = {
  state: "ready" | "partial" | "empty" | "unavailable";
  items: T[]; // runtime schema: maximum 2, unique content keys
};
```

- [ ] Use discriminated preview types for the distinct anatomy. Do not force a person's story into claim/finding/verdict fields.
- [ ] The composition function reads an edition, resolves selected references through canonical seams, joins approved media/excerpts, preserves source/status provenance and returns a small serializable view model.
- [ ] Resolve each section independently, using bounded reads and per-section error handling. One broken archive package or watch service must not discard all other sections or the hero.
- [ ] Fetch full detail only for selected items where needed. Do not resolve hundreds of archive records or every research case on each homepage request.
- [ ] `lib/publications.ts` is the existing, explicitly exempt server-only public-data boundary. Add narrowly named homepage snapshot/pin read accessors there to delegate to `server/modules/homepage/index.ts` if needed; keep reads under the appropriate public database role. Do not duplicate its lint exemption in `lib/homepage.ts`.
- [ ] No homepage GET writes, database self-fetch through the site's HTTP API, authenticated browser reads or database/provider clients in page/client components.
- [ ] Keep persistent edition creation in the protected backend job, and static catalogue creation in the generator; page composition only resolves/reads.
- [ ] Dates and labels use the site's English public locale. Edition timezone remains Israel-local independent of the viewer's location.

### HJ-14 — Distinct compositions, shared primitives

Proposed **new** component boundaries:

```text
components/home/HomepageJourney.tsx          server-rendered section sequence
components/home/HomeNewsSection.tsx         large/small editorial spread
components/home/HomeNarrativesSection.tsx   claim/finding or research evidence layout
components/home/HomeArchiveSection.tsx      testimony and safe documentation window
components/home/HomeHeroesSection.tsx       human/portrait composition
components/home/HomeHistorySection.tsx      archival chronology composition
components/home/HomeSystemSection.tsx       static-first explanation and final actions
components/home/homepage-journey.module.css journey grid and scoped section variants
```

- [ ] Keep `app/page.tsx` as composition/render orchestration. Reuse existing `ButtonLink`, source links, date/status vocabulary and sensitive-content handling; introduce a homepage-specific variant only where its semantic job differs.
- [ ] Use up to 1600px of content width, approximately 40px desktop/20px mobile gutters and a coherent grid. At wide sizes news may use an 8/4 split; the other sections must not mechanically repeat it.
- [ ] Keep prose about 60–70 characters wide even inside a wide spread. Use existing serif display, sans body and restrained mono metadata. Main body 16–18px, supporting information at least 12px.
- [ ] At mobile widths, order by meaning rather than CSS rearrangement: feature before secondary, claim before finding, witness before context. No horizontal overflow or hidden second item.
- [ ] Natural document scroll, content-driven heights, no scroll hijack, hard snapping, forced viewport-height chapters, sticky panels that trap reading or nested long scrolling boxes.
- [ ] Prefer image proportions, hierarchy, whitespace and meaningful separators to grey containers, decorative borders, glow, badges and repeated rounded cards.
- [ ] Keep all meaningful content server-rendered and visible without animation. Small client enhancements must not start with important sections hidden at opacity zero.
- [ ] Ensure Ask cannot cover article links, media credits, warnings or final CTAs at mobile safe areas or 200% zoom. Do not redesign the Ask conversation itself.
- [ ] Update `DESIGN.md` with the approved journey, component ownership and removal of rotating-rail/single-viewport intent; update only relevant entries of `UX-CONTRACT.md`. Do not rewrite unrelated standards.

## 8. Performance, accessibility and return behavior

### HJ-15 — Asset and rendering budget

- [ ] Lion remains the only major autoplay asset. Do not change its source/preload policy merely because new content exists.
- [ ] Use responsive image sizes and intrinsic dimensions/aspect ratios. Lazy-load below-fold media, but do not blindly lazy-load whichever image becomes the actual LCP element in a short/landscape viewport.
- [ ] Use the existing archive derivatives and URL helpers for archive imagery; use `next/image` or an equivalent justified existing path for new approved stills. Do not re-optimize the entire archive for a handful of previews.
- [ ] Avoid additional animation engines, large image registries in client props, needless client boundaries or two copies of every image for breakpoints.
- [ ] Read `docs/performance-budgets.md`, `scripts/perf-budgets.json`, and the installed Next image/caching guides before implementation. Capture baseline versus new image bytes, JS, CLS and LCP on the same local setup; no invented improvement percentages.
- [ ] Reserve dimensions even on load failure. Keep title, credit and destination usable if a media request fails.

### HJ-16 — Complete non-mouse experience

- [ ] Semantic heading order: one page H1, section H2s, preview H3s; figure/figcaption, real links and machine-readable times.
- [ ] Focus-visible treatment and no obscured target; keyboard order follows reading order. No whole-card links wrapping other source/action links.
- [ ] Reduced motion yields a complete static journey and the existing hero fallback. No-JS users can read previews and follow destination/anchor links.
- [ ] Preserve ordinary browser back/scroll restoration. Daily membership is not re-randomized on return. Returning across a day/revision change may show the new labelled edition; do not pretend the same snapshot survives indefinitely.
- [ ] Do not globally remember graphic-media consent. Back navigation must not silently reveal a different record.
- [ ] Validate short screens, long titles, enlarged text, high contrast/forced colours where available and touch targets—not only aesthetically convenient screenshots.

## 9. Execution order and acceptance

### HJ-17 — Delivery sequence

1. **Baseline and inventory:** capture the current homepage; map eligible keys, links, excerpts, media/rights and shortages for all five content domains.
2. **Contracts and curated media:** define the shared media/preview vocabulary, approved mapping and safe archive treatment. Flag missing material early.
3. **Local edition fixture and design:** create a clearly marked test fixture from real eligible records to develop all six section compositions. A fixture is not the production daily selector.
4. **Canonical adapters and persistent editions:** implement composition, stable selection/history, pin compatibility, schema and protected job. Test idempotency and day boundaries before wiring live rendering.
5. **Homepage integration:** preserve hero, remove rotating rail, add full journey, scoped shared-chrome changes and closing explanation.
6. **Verification and editorial sign-off:** run the focused tests and visual/interaction matrix below, report unresolved media/content gaps.
7. **Optional later rollout:** production migration/scheduling/deployment only after separate approval. Canonical publication-media persistence has its own completion status.

No task is complete because the build passed. The owner must be able to inspect the actual desktop and mobile composition and the represented editorial meanings.

### HJ-18 — Automated checks

Proposed **new** focused tests:

```text
tests/homepage-edition.test.ts              deterministic pairs, dates, overrides, cooldown
tests/homepage-composition.test.tsx         section order, distinct types, failure isolation
tests/homepage-media.test.ts               media validity, rights/safety defaults, dimensions
tests/homepage-edition-storage.test.ts      concurrent activation, revisions, read-only public access
```

- [ ] Selection tests cover Jerusalem midnight, both DST transitions, concurrent creation, reload/deploy stability, candidate arrival mid-day, unknown/expired pins, old pins beyond the latest-100 window, breaking revision, corrections and withdrawal.
- [ ] Inventory tests cover zero/one/two records, heroes' small pool, cooldown relaxation, duplicate featured/profile IDs, duplicate records across domains and invalid media permissions.
- [ ] Editorial tests cover every Watch verdict, sourced versus analysis, missing details/finding, case confidence versus verdict, contested chapters and source-linked significance excerpts.
- [ ] Isolation tests cover publication failure with available archives, archive failure with available news, broken case package, absent edition and last-good dated snapshot.
- [ ] Safety tests verify no sensitive media URL is requested/rendered before consent, no autoplay below the hero and no hidden graphic preview.
- [ ] Reuse and update existing tests by responsibility, not by deleting failing expectations wholesale:

  ```text
  tests/homepage-features.test.ts
  tests/home-content.test.ts
  tests/home-direct-entry.test.tsx
  tests/no-js-invariant.test.ts
  tests/intro-accessibility.test.ts
  tests/intro-fallbacks.test.ts
  tests/archive-content.test.ts
  tests/news-narrative-separation.test.tsx
  tests/narrative-hub-layout.test.tsx
  ```

- [ ] Preserve the configured Vitest worker limit. Backend storage tests use the project's migrated test database and proper roles, not mocks alone.
- [ ] Run targeted Vitest files, then `npm run typecheck`, `npm run lint`, `npm run build`. Run `npm run perf:report` after building when evaluating the changed homepage budgets. Record exact results and distinguish pre-existing failures.
- [ ] No build/migration/test makes provider calls, publishes a new edition or spends money as a hidden side effect.

### HJ-19 — Browser evidence and visual acceptance

- [ ] Before/after full-page and section screenshots at widths **390, 768, 1024, 1440, 1920** with fixed viewport heights recorded alongside them.
- [ ] Real browser checks include Chromium and Safari if available. Emulated widths are not a real-phone test. Record unavailable browsers/devices honestly.
- [ ] Check 200% zoom, keyboard traversal, intro open/close/focus return, section and article links, source links, browser back, no-JS and reduced motion.
- [ ] The first viewport remains identity/purpose, not the whole sitemap. A normal scroll reveals actual news immediately after the hero rather than another long introduction.
- [ ] Five content sections contain two visible items each when eligible inventory permits; six different compositions still feel like one publication.
- [ ] No wide unused reserved column, fixed-height filler card, line-clamped crucial claim qualifier, masked source status, surprise graphic content or Ask overlap.
- [ ] Diagram review explicitly confirms that review/checks are not shown as universal guarantees and that the archive is separate from automatic briefing production.
- [ ] Save artifacts under **new** `docs/reviews/homepage-editorial-journey/` with `before/`, `after/` and a findings report. Link actual existing screenshot files in the handoff, not only temporary paths or filenames that were never created. Do not capture private admin content or credentials.

### HJ-20 — Measurement and user comprehension

No dedicated homepage funnel instrumentation was identified in the inspected layout/package/component entry points. Confirm the existing analytics owner before adding one. This is a measurement plan, not a claim that tracking is installed or that a local test measures real conversion.

- [ ] Define optional events: `homepage_section_view`, `homepage_destination_open`, `homepage_record_open`, `homepage_first_action`; include section, content key, edition date/revision and elapsed time where necessary.
- [ ] Record a section view once after a defined visibility threshold (proposed: 50% of a section heading/entry region visible for one second). Do not require half of an entire long section to fit on a phone screen.
- [ ] Measure time to first meaningful action, section destination click-through, record-open rate, reach by section, return navigation, mobile task completion and asset performance. Report denominators and date range.
- [ ] Never transmit sensitive claims, testimony text, user questions, consent decisions, precise personal identifiers or private paths as event properties. New analytics provider/production activation requires separate approval and applicable privacy handling.
- [ ] Run first-click tasks: find current reporting; find the status of a monitored claim; locate testimony without viewing graphic media; reach a person's full story; find historical context; understand how publication happens.
- [ ] Conduct a short first-time-user test after the first two to three sections: “What does this site do?”, “Is this claim proved false or still unresolved?”, “What would you open next, and why?” Observe rather than prompt the desired answer.
- [ ] Treat two-item choice limits, section order and visual rhythm as hypotheses. Do not claim Hick's Law, peak-end effects or a performance threshold have validated the design without observing it.

## 10. Required handoff

- [ ] List implemented files and a concise description of their ownership.
- [ ] Provide usable before/after screenshots for desktop and mobile, plus full-page evidence of the continuous journey.
- [ ] Report selection stability, active edition/date/revision and how editorial exceptions operate.
- [ ] Report tests/build/browser results; distinguish local fixture, local database, production configuration and real-device testing.
- [ ] Attach the media/rights and excerpt-provenance inventory, including unresolved shortages and deliberate one-item sections.
- [ ] State separately: registry bridge complete/pending; durable edition storage complete/pending; canonical publication-media persistence complete/pending; cloud scheduling inactive/active.
- [ ] State that no production deployment was made unless separately authorized and actually performed.

**Success:** a first-time visitor can perceive that Lions of Zion combines current reporting, examination of claims, preserved documentation, human stories, historical context and an understandable method—without being forced to read everything, surrender control of attention or mistake presentation for proof.
