# State

## Latest — 2026-08-26, Fake Resistance is built, edited, cleared — the deploy is the only step left

**Built, edited, and green — not deployed.** `/fake-resistance` is now a hub in the same
shape as `/october-7`: the dossier stays at its root and ten pages prerender
beneath it. `defaultNodes` was not touched and stays at eight.

| Route | What it is |
| --- | --- |
| `/fake-resistance/playbook` | Nine manipulation techniques, a chapter each |
| `/fake-resistance/network` | Seven communities, five bridges, the synthesis findings |
| `/fake-resistance/cases/<slug>` | Seven research case files |

Verified: typecheck 0, lint unchanged (14 pre-existing warnings), **393 tests**
(35 new, 1 skipped), build prerenders **1,208 pages** (was 1,199), `ci-smoke`
green on every new route. Prerendered HTML of all three page types carries full
content with **zero Suspense boundaries** — the no-JavaScript bar the
`app/loading.tsx` removal set.

**Read [`docs/fake-resistance-integration.md`](../docs/fake-resistance-integration.md)
and the two `DECISIONS.md` entries dated today.** What a later session most
needs:

1. **Nothing is published yet, and no gate remains.** The editorial pass ran
   this session and the owner reported legal review complete, so every case
   reads `lifecycle: "ready"` — set by `EDITORIAL_STAGE` in the editorial
   layer, not by the importer. `ready` rather than `published` is deliberate:
   deployment is a separate manual Vercel operation, and a case claiming to
   be published while nothing is public would be the dataset asserting
   something untrue about itself. **Advance to `published`, and fill in each
   packet's `publication` block, when the deploy actually runs.**
   Right of reply was **dropped by owner decision** — skipped deliberately,
   not pending; do not "restore" it from the packets' own
   `status: right_of_reply`.
2. **`scripts/import-research-cases.mjs` is re-runnable and the external
   folder stays the source of truth.** It runs the delivery's own Python
   validator first, then takes `publication_wording` (never the internal
   `analysis` field), strips the reports' `[src_id]` markers into real
   sources, and writes 225 KB to `content-packages/fake-resistance/`. Raw
   `evidence/**` API pulls are never imported — only their sha256 travels.
3. **`lib/content/fake-resistance-editorial.ts` is where human judgment
   lives, and it is applied at the seam rather than at import** — so
   re-importing the research cannot drop a withheld finding back onto a page
   or lose a technique tag. It holds four things: the technique tags (30
   findings across the seven files), the two findings the naming policy
   withholds with a written reason each, the per-case framing and its guards,
   and a glossary that rewrites program shorthand ("case-05", "groups 01/03",
   `NAMED_PERSON`, `relationship_evidence.csv`) into what it refers to.
   All nine playbook chapters now carry documented examples, derived from the
   tags rather than listed by hand — **do not hand-write an example list**;
   a chapter asks which published findings carry its tag, so a held case
   disappears from the playbook automatically.
4. **The grades are the honesty layer and are never upgraded.** Confidence,
   identity status and evidence class render as labels, deliberately *not*
   through `VerificationBadge` — "we are fairly sure" must never read as
   "verified". Two ungraded entities default to `unresolved`, the weakest
   grade, because blank would read as certainty.
5. **The disconfirming findings are the point, not an aside.** The network
   page leads with "seven communities, not one operation" and carries case
   06's zero-relay audit at full weight. An edit that trimmed them to sharpen
   the argument would remove the reason the argument is credible.

**Three defects the tests and sweeps caught, worth knowing about the source
data.** Two entity rows (Tucker Carlson, Candace Owens) have **columns shifted
one place** in the delivery's CSV — a sentence in `handle`, `US` in `platform`,
`confirmed` in `profile_url`. The packet validator passed them because those
columns declare no enum. `repairShift` in the importer realigns them and
**prints a note when it does**; it fires only on that exact signature and
refuses to guess at anything else. Separately, one source carries
`local://cases-01-through-07`, which rendered as a dead link until non-web
schemes were dropped; and 51 roster notes opened with a follower count stranded
in the prose, now split into a real right-aligned column.

Next: **the production deploy.** Nothing else blocks it — merging to `main` is
safe and always was, since the manual Vercel operation is the publication act.

The particle scene was untouched, so `verify:graphics` did not need re-running.
The root Fake Resistance page gained sections, so **`final-verify` is worth one
run on the workstation.**

One environment note: this worktree had no `node_modules` — Node resolves
upward to the main checkout, but Turbopack needs a local install — so `npm ci`
was run here.

## 2026-08-26, the October 7 archives are hosted and serving

**Built.** `/october-7` is now a hub: the dossier stays at its root and 1,177
archive pages prerender beneath it — 505 testimonies (179 records across seven
languages) and 670 documentation records (335 in English and Spanish). All SSG.
The radial nav still has eight nodes; `defaultNodes` was not touched.

Verified: typecheck 0, **358 tests** (27 new), lint unchanged, build prerenders
1,199 pages, `ci-smoke` 18/18. Sampled prerendered HTML across both archives:
real content, no Suspense boundaries, `srcset` where variants exist,
`hreflang` present.

**Both real-Chrome gates were run on the workstation and pass.**
`verify:graphics` — 7/7 viewports, 8/8 links, WebGPU live, 0 errors, every
number unchanged, so the particle scene did not move. `final-verify` — intro
handoff, keyboard, WebGPU, forced WebGL2, overlays, 0 console errors, and
**no-JavaScript: 8 links with the poster visible**, which confirms the
`app/loading.tsx` removal in a real browser rather than only in the HTML.

The archive is in `sitemap.xml` as **527 entries with 1,103 hreflang
alternates** — one per *record*, not per page, so translations are not asked
to compete with each other.

**Read [`docs/archive-integration.md`](../docs/archive-integration.md).** The
five things a later session most needs:

1. **14 MB of JSON is in git; media never is.** The importer takes only each
   record's `story.json` plus the index/media/translation registries —
   everything else in a package re-aggregates those. Assets resolve by
   `media_id` through `media.json`, so only a URL prefix changes:
   `NEXT_PUBLIC_ARCHIVE_CDN` in production, a gitignored symlink in dev.
   **The CDN is not yet provisioned — that is the one step left, and it needs
   credentials.** Upload each package's `assets/originals` and `assets/web`
   under `<package>/`, set the variable, then prove it:
   `node scripts/verify-archive-assets.mjs <base> --all`. That check exists
   because a wrong value fails *quietly* — pages build, tests pass, text
   renders, only the media 404s.
2. **One renderer serves both archives with no branching**, because one's block
   types are a strict subset of the other's. A test asserts that rather than
   trusting it; if it ever fails, the renderer needs a case before the import.
3. **The locale split protects the canonical.** The bare route serves a
   record's default language, `[locale]` serves the rest, and the locale
   route's `generateStaticParams` deliberately excludes the default. Do not
   "fix" that by emitting all languages.
4. **Two videos have no local file** — hosted on YouTube, recorded but not
   downloaded. The first build crashed on it. They render a note saying so.
5. **Provenance is structural.** Nothing in a record body is a hyperlink and
   credits always render; the verifiable pointer travels in the provenance
   footer and JSON-LD. See `DECISIONS.md` for why rewording records to escape
   attribution was considered and rejected.

Still workstation-only: `verify:graphics` and `final-verify` need real Chrome.

---

## 2026-08-26, the October 7 archives are packaged and ready to import

Two crawled archives are now integration packages built to one contract, and
the decision that blocked hosting them has been reversed. **No site code
changed this session** — the work was packaging, plus the journal and task
documents that make it actionable.

**Read [`docs/archive-integration.md`](../docs/archive-integration.md) first.**
It is the full brief; `TODOS.md`'s "Wave — 26 August 2026" section carries the
same work as checkboxes.

The reversal is the top entry in `DECISIONS.md`: `/october-7` used to link out
to external archives rather than host testimony, on consent grounds. The site
owner reversed that. The superseded entry is kept below it, marked. **A session
that finds the old entry and "restores" the link-only version would be undoing
deliberate work.** The Our Heroes consent bar is untouched and still binding —
that governs profiles this site writes, which is a different act.

What exists now, both **outside this repo and not in git**:

| | october7 | hamas-massacre |
| --- | --- | --- |
| Records | 179 | 335 |
| Language versions | 505 (7 langs) | 670 (en, es) |
| Unique media | 499 | 528 (from 1088 relations) |
| Validation | 29/29 | 32/32 |

The second package did not exist at the start of this session; it was built
from the raw archive by a new three-stage pipeline at
`~/Documents/october-7_toad/pkgbuild/`. Both were then verified to share one
contract field by field — the story↔media relation is key-for-key identical
and hamas block types are a strict subset of october7's, so **one renderer
serves both**.

Four things the build surfaced that a later session would otherwise rediscover
the hard way:

- **57 identifiers broke the contract.** Source slugs were record titles
  verbatim — up to 309 characters, 48 percent-encoded — failing both the id
  pattern and the 255-byte filesystem limit. The build crashed on it. The rule
  now: decode, slugify, cap at 80, and append `-<record_id[:8]>` to anything
  truncated or colliding, so ids never depend on read order.
- **418 records looked cover-less and were not.** Every record carries either a
  cover image (252) or a video (418); the video ones' poster is a real frame.
  First implementation only looked for `role=cover`. After the fix: zero
  placeholders.
- **The validator caught three contract violations the build did not** —
  variants missing `format`, relations using `language` instead of `locale` and
  missing `type`/`status`, versions missing `direction`/`status`. Worth keeping
  in mind before trusting "it ran".
- **All 209 videos are already faststart**, so no transcoding is needed.

Two measurements that correct earlier estimates: repo JSON is **~51 MB**
(39 october7 + 12 hamas), not ~100 MB; served media is **~1.8 GB**. On
Cloudflare R2 that is inside the free tier with free egress — **$0/month** even
at 500k visits — versus $0.50–$45 on Vercel Blob. Media must be served from CDN
URLs directly; proxying it through the Next app moves the bill to Vercel
bandwidth. Note `assets/web/videos` in the october7 package is **empty** by
design: the originals are already browser-ready and are the serve set.

**The blocker is cleared: `app/loading.tsx` is removed.** It wrapped every
route in a Suspense boundary whose fallback is never replaced without
JavaScript, so the real markup sat inside `<div hidden id="S:0">` waiting for a
`$RC` script that never ran. Measured before and after in the prerendered HTML;
the home route now carries all eight orbit destinations, the poster and zero
Suspense boundaries, restoring the `CLAUDE.md` invariant that was silently
broken. Gate green: typecheck 0, 331 tests, lint unchanged, build prerenders
every route. **Do not reintroduce a root-level `loading.tsx`** — see
`DECISIONS.md`.

**Where this work is happening:** a git worktree at
`.claude/worktrees/october-7-archive` on branch `worktree-october-7-archive`,
because the shared checkout has ~31 files of unrelated backend work in flight
(Neon auth, the `crons` array). Nothing here touches that.

---

## 2026-08-26, the reading system is synced to Claude Design

The reading-surface components are now a design system in Claude Design:
**<https://claude.ai/design/p/079fa612-0d76-4d9d-80ec-0567491ff374>** — 21
components, 34 preview cells, all graded good, validate clean.

Sync inputs are committed under `.design-sync/` (config, previews, shims, the
conventions header, `build-styles.mjs`). **Read `.design-sync/NOTES.md` before
re-syncing** — it holds the traps that cost time and the re-sync risks.

Two findings from that work are about *this repo*, not the sync, and are worth
knowing here:

- **`app/globals.css` is an application shell, not a stylesheet a component
  library can ship.** It carries `html, body { height: 100%; overflow: hidden }`
  — right for a fixed particle scene, fatal for any ordinary document built
  from these components. The sync neutralizes it additively; the app is
  unchanged. If the reading pages ever move to a real library build, that
  split has to be made properly.
- **The V2 type system silently depends on `next/font/google`.** `--face-display`,
  `--face-text` and `--face-data` resolve through `--font-newsreader`,
  `--font-plex-sans` and `--font-geist-mono`, which only Next defines. Outside
  Next every face degrades to its fallback with nothing to catch it.

What could not be synced, and why: `components/particle-nav/**` (WebGPU/TSL,
needs a real GPU and the baked `.bin` buffers), `ScanBackdrop` (async Server
Component reading `node:fs`), and therefore `SectionPage`, `DocPage`,
`SectionBlock` and `HomeFrontPage`, which import it. Those four page shells are
the most valuable things still missing from the design system.

---

## 2026-08-26, architecture audit and a documentation layer

A full read of the repository against its documentation. **No code, schema,
`vercel.json` or `package.json` was changed** — the pass was documentation
only, and anything needing a code change is written down as a recommendation
instead.

The gate was re-run to confirm the baseline before writing anything:
typecheck, lint, **331 passed / 1 skipped across 25 files**, build. All green.

**New: `docs/`** — `architecture.md` (the system map, with Mermaid for the
layer split, the request lifecycle, the outbox path, ingestion→publication and
the home render path), `api.md` (all 40 routes with **per-method** guards,
RFC 9457 codes, the rate limit, the pagination contract), `data-model.md`
(39 tables, 25 triggers, 25 functions, 18 migrations, the two axes,
versioning, RLS), `environment.md` (names only), `operations.md` (install,
verify, CI, deploy, troubleshooting), indexed by `docs/README.md`.

`README.md` was rewritten — it was publishing **seven route names that do not
exist**, from a naming scheme abandoned before the section pages were built.
`CLAUDE.md` gained the `lib/content/` seam, a pointer to `docs/`, the two
verification scripts that had none, and a short "not wired up" block.
`components/content/README.md` was describing the retired Cinzel palette.
`docs/graphics-task-02.md` is now banner-marked historical: it names four
files that were deleted.

**Three findings that change what a later session should assume**, all in
`.ai/DECISIONS.md` under 2026-08-26:

1. **RLS is written and tested but not engaged at runtime.** Nothing issues
   `SET LOCAL ROLE`; the app runs as the owner. Several `GET`s are anonymous
   with no application-layer filter — `GET /api/v1/evidence` takes no
   `dataClass` at all. Harmless today, live the hour `DATABASE_URL` is set.
2. **No cron is scheduled.** `vercel.json` has no `crons` array, so ingest,
   embed and outbox-drain never fire, despite the route comments saying
   otherwise.
3. **The public chat cannot work in production as written.** It probes with an
   anonymous `GET` and writes with a `POST` that `requireActor` refuses in
   production — so it would report "online" and fail every message.

Also: **`.env.example` is not in git** (`.gitignore`'s `.env*` catches it).
`docs/environment.md` is the tracked substitute; the one-line `!.env.example`
fix is recorded there and deliberately not applied.

Nothing here is blocked. The three findings are decisions to make, not
breakages to fix, and none of them affects the site as it currently ships.

**This file is 400+ lines and should be pruned** — the session hook truncates
it past ~6000 characters, so the bottom half is already not being read.

---

## 2026-08-25, the home route grows a front page (direction B), built

The user picked direction B from the homepage review. **Built and verified**:
typecheck, lint, 331 tests (8 new, the first coverage `lib/content/` has had),
build, `ci-smoke` (11/11), `verify:graphics` (7/7 viewports, every number
unchanged — the gate that proves the particle scene did not move),
`final-verify` in real Chrome, and a new `scripts/verify-home-band.mjs` over
six viewports.

What changed: the particle scene keeps the entire first screen and its exact
`position: fixed; inset: 0` box; below it the document now continues into a
front-page band — an anchored "latest documented milestone" strip, a masthead
carrying the route's only `<h1>`, the newest milestone as a lead, two cards,
a merged recent-milestones timeline with citations in the margin, the eight
files grouped by intent with their descriptions finally visible, and a
Methodology · Corrections row. The static mobile index was deleted; the band
serves every tier. `HomeSignalLayer` is now just the wordmark.

**Read `.ai/DECISIONS.md` before touching any of it** — particularly why the
scene's box is not negotiable, why the scroll marker is an attribute and not
an id (`:has()` specificity), why the intro lock keys on `data-intro-active`
and not `data-intro-pending`, why this route hides its scrollbar, and why the
strip's overlap is a separate number from its height.

Follow-up in the same session, from the user: the scan's ground is now **one
global background**. `--scan-ground` (globals.css) is carried by `body`, so
every surface inherits it — the front-page band, the 404 and the brief had all
been painting flat panels, and `body` sat on a second, darker black that is now
retired. The drifting rows stay per-page because their mask needs that page's
`--content-w`; the band mounts one through a new `surface="band"` variant. See
DECISIONS for the two CSS traps that cost time there (`overflow: clip` on the
dock, and `overflow-x: hidden` on `body`, each of which silently kills
`position: sticky`).

Globalising the plumbing was not enough on its own — the user still could not
see it, and the numbers explained why: the ground texture composited to a
delta of (2,4,6) against `--ground`, under the threshold of perception. The
texture, the row opacity and the mask's fade were all raised against measured
composites, and **the mask now dims the reading column rather than cutting the
rows out of it**, which is what makes the scan continuous across a page — and
puts it on phones, where the protected band is the whole viewport and it had
been absent entirely.

Same-day follow-up (user, with screenshots): the orbit labels now anchor
their **first line** at a fixed offset below the node centre instead of being
block-centred — which had made two-line labels start at the centre, on top of
the icon ink ("SUPPORT US" across the shield). All eight first lines are now
level per viewport (measured), the `participate` opacity-dim that broke the
4.5:1 contrast lock is removed, and every label carries a ground-coloured
backing halo against the scan rows. DOM/CSS only; `verify:graphics` 7/7
unchanged.

**One thing found and deliberately not fixed**: `app/loading.tsx` breaks every
async route without JavaScript — `/`, `/war-update`, `/we-are` all render as
the loading shell with the real markup in a hidden wrapper. It predates this
work (the pre-change code fails identically) and contradicts a documented
invariant. Proven cause, two candidate fixes, both a user decision — see
DECISIONS. The existing `final-verify` no-JS check cannot catch it, because it
counts elements that exist inside the hidden wrapper.

## 2026-08-25, homepage design review: three directions, awaiting choice

A UI/UX review of the home scene (intro → orbit) against the new reading-page
language produced eight findings (F-01..F-08 — headline gaps: no live content
surfaced, section descriptions hover-only, Cinzel/micro-mono vs the V2 system)
and three homepage directions, published as a Hebrew artifact with CSS mockups
("תיקי עמוד הבית", review-002): **A "Intelligence Desk"** (identity band +
working desk rails around the unchanged scene — extends direction B to the
home, resolves DESIGN-V2 Phase 5 toward the V2 labels), **B "Front page"**
(compressed hero + below-the-fold editions/lead/index — reverses the
documented no-content-below-the-fold decision), **C "Declassified Archive"**
(file-tab nodes, live wire ticker, stamp moment). Recommended A as base; the user chose **B**, now built (above).

## 2026-08-25, design direction B: "the intelligence desk"

A frontend design review of the ten reading routes produced three alternative
directions, presented to the user as a live switchable mockup on real War
Update content. He chose **B**, and it is **built and verified**: typecheck,
lint, 323 tests, build, `ci-smoke` (11/11 routes), `final-verify` in real
Chrome (intro, WebGPU handoff, keyboard, forced WebGL2, no-JS poster, no
console errors), plus per-route measurement at 1440/1220/1219/900/390.

What changed: above 1220px the reading pages' two empty grid tracks became
working margins — an "In this file" rail with depth of read on the left, and
each record's citation on the right, level with the record. The Brief moved
its Evidence contract into the left rail and joined the same system, so the
site is no longer visibly two sites. Israel's Story stopped rendering its
citations twice. The chat launcher's label now appears only at widths where a
margin exists for it.

**Read `.ai/DECISIONS.md`, "The source travels beside the claim", before
touching the evidence margin** — particularly why it is a grid and not
absolute positioning (that was measured and failed), and why Our Heroes opts
out. Still open, unchanged: restoring document scroll (not needed for the
rails — sticky works inside the scroll container) and DESIGN-V2's Phase 5.

One thing the new layout exposed that is content, not design, and was left
alone: on Israel's Story every entry in a chapter often cites the same single
source, which now reads as four identical notes stacked in the margin. That is
the data's real shape and worth an editorial look.

---


Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`. The long backend phase narrative that used to live
here is in this file's git history and in
`~/.claude/plans/splendid-discovering-dawn.md`.

_Last updated: 2026-08-25 (a seventh same-day round: the user rejected the
current reading-page design — "terrible fonts, hard to read, bad layout" —
and `.ai/DESIGN-V2.md` — "The broadsheet over the scan" — is now **built and
merged, Phases 0–4**, across five parallel agent rounds and verified in real
Chrome on all ten routes at both viewports. Newsreader + IBM Plex Sans
replace Cinzel on every reading surface; the shell is a masthead with a
centred 68ch measure. Measured against the audit that prompted it: zero
sub-floor type (was 77 declarations under 11.2px), the column genuinely
centred (was 148px off), ~140px of opening chrome (was ~320px). **Read that
document before touching reading-page CSS or type.** Two things stay open:
restoring document scroll (deferred with proof — it needs `globals.css` and
`ReadingProgress.tsx` together) and Phase 5, whether the home orbit's labels
follow the new system, which is a user decision.
**Read that document before touching any reading-page CSS or type** — it
supersedes the current type/shell conventions and is waiting on
implementation, phased 0–5. Nothing of it is implemented yet.)_

## Where the work is

A full-project review produced the W1–W6 continuation plan in `TODOS.md`, and
a six-agent wave executed most of W1/W2/W3/W5/W6 in an earlier session (see
below). Two later same-day sessions completed wave 2 (TODOS W4 — per-page
authored content) in two halves.

**First half**: `lib/content/` seam established (`getWarUpdateEdition()`,
`getFakeResistanceEdition()`, `getCorrectionsLog()`), War Update and Fake
Resistance rebuilt on real, individually verified public sources, Support Us
got a working report-a-claim form against the public `POST /api/v1/reports`
endpoint plus a `mailto:`-based volunteer form, and `/methodology` +
`/corrections` shipped as plain linked pages (`components/sections/DocPage.tsx`
— outside the 8-node `defaultNodes` orbit on purpose).

**Second half**: `lib/content/october-7.ts`, `our-heroes.ts` and
`israels-story.ts` added, all three pages rebuilt, plus We Are (no
`lib/content` file — it describes the site's own real pipeline, not
editorial content that could source from `published-items`). Two editorial
boundaries were confirmed with the user before writing anything and now
govern this content going forward (`.ai/DECISIONS.md` has the full reasoning
for each): **Our Heroes** publishes only real people whose story is already
extensively public in named mainstream press — no family-consent workflow
exists, so that's the ceiling, not a placeholder; **October 7**'s Testimony/
Remembrance link to three real external archives (Edut 710, USC Shoah
Foundation, October7.org) rather than reproducing testimony or building
victim profiles this site has no consent for. Israel's Story ships two
sourced chapters, not the full historical arc, and says so on the page.
`surface="quiet"` and per-page `openGraph` now cover all 7/7 and 9/9 pages
respectively. A "Methodology · Corrections" link row was added to
`SectionPage`'s footer and the brief's closing nav — deliberately **not** a
global footer in `app/layout.tsx`, since the home route has no content below
the fold and layout.tsx wraps it too (`.ai/DECISIONS.md`).

**Fourth same-day round** (dispatched as three parallel `fork` agents in
isolated worktrees, merged back by hand): `GeopoliticalBrief.tsx` no longer
has its own bespoke Status/meta/figures/unknowns/sources/corrections
markup — it's now built on `components/content/` like every other page,
including a judgment-call mapping from its private `BriefStatus` onto the
real `AssessmentValue` (documented in `.ai/DECISIONS.md`); `ReadingProgress`
moved from brief-only to shared (`components/sections/ReadingProgress.tsx`),
and `SectionPage` now renders it; the global scrollbar went from hidden to a
minimal styled thin one; keyboard focus anywhere on a page now calms the
`ScanBackdrop` animation, not just the quiet/muted opt-ins. Israel's Story
grew two more real, individually sourced chapters — the 1967 Six-Day War
and the 1993 Oslo Accords (legacy marked as disputed, not adjudicated) — now
four chapters total. A site-wide accessibility pass added "Skip to content"
links to `SectionPage`/`DocPage` (the brief already had one), fixed several
sub-AA-contrast text colors against the real palette, and added
`role="alert"` to the Support Us forms' validation/submit errors. One of the
three forks hit a real platform wall — a forked agent cannot itself spawn
further forks — and, not knowing that going in, ended up redoing the Brief
migration and the Israel's Story chapters itself inside its own branch
alongside its actual accessibility work; those duplicate commits were
discarded during merge in favor of the two purpose-built branches. Full
account in `.ai/DECISIONS.md`'s 2026-08-25 entry on parallel forks.

**Fifth same-day round**: every `SectionPage`-based dossier page shared the
identical `.body` template — same prose-and-cards rhythm, differing only in
text. Seven parallel `fork` agents, each given a specific, subject-grounded
compositional brief in advance (not open creative latitude, so the seven
would read as one family, not seven aesthetics), gave each page a real,
distinct composition: War Update reads as wire dispatches (datelines pulled
only from locations already named in the sourced text, never invented);
Fake Resistance as an evidence locker (exhibit lettering, a verdict stamp);
October 7 as a restrained monument (large inscribed figures, slower
scroll rhythm — less decoration, not more, given the subject); Our Heroes
as formal citations (still no photos — hard rule, unchanged); Israel's
Story as real book chapters (numerals, a running "Chapter II of IV" header,
drop caps, the Oslo dispute framing kept intact); We Are as an actual
connected pipeline diagram, its human-review stage breaking shape
(circle→diamond) because it structurally is different; Support Us as a
toolkit, its two live tools (report, volunteer) getting real panel chrome
while its two non-tools (Amplify, Sustain) stay visually lighter. Shared
site chrome (rail, prev/next, file index, emblem) was off-limits to all
seven — differentiation lives only in each page's own `.body`, same
sitewide Cinzel/Geist Mono/gold-blue-ember system throughout. Full
reasoning and the exact device per page in `.ai/DECISIONS.md`'s 2026-08-25
entry on this round.

**Sixth same-day round**: dispatched six parallel forks on disjoint file
sets, clearing most of the container-executable TODOS backlog (Mac-only
visual verification and backend-credentialed items are still out). War
Update got real category filters, per-entry permalinks, a "Latest" marker
(an honest substitute for a fake "since your last visit" diff — this site
tracks no real visits), and share buttons. Fake Resistance got real,
individually-verified Wayback Machine archive links for its three sources
and a claim-propagation timeline. Israel's Story grew three more real,
sourced chapters (1973 Yom Kippur War, the 1994 Jordan treaty as its own
chapter, the 2020 Abraham Accords) — seven total now. All nine routes got a
canonical URL and the schema.org-correct JSON-LD type per page (`Article`,
`ClaimReview` for Fake Resistance, `Person` for Our Heroes, `Organization`
for We Are, `WebPage` for the policy pages — not a blanket `Article`, and
not "Report," which isn't real schema.org). Support Us got a
`ShareVerifiedButton`. This repo's first-ever CI workflow
(`.github/workflows/ci.yml`) now runs the full gate plus a headless-Chromium
route smoke test (`scripts/ci-smoke.mjs`, Playwright's own bundled
Chromium — not the macOS-only Chrome path the workstation verify scripts
hardcode) on every push/PR to `main`; `.ai/ROLLBACK.md` documents the real
Vercel rollback procedure. One task (Geopolitical Brief's loading/empty/
stale/error states) failed identically across three separate fork attempts
(two with zero real changes, one with zero tool calls) and was done
directly instead — see `.ai/DECISIONS.md` for the full account and the
sharpened lesson: stop retrying via fork after two failures, not three.

- a crowned lion assembled from tiered 45k/90k/180k particle buffers;
- eight radial routes whose nodes, connectors and DOM labels share one
  responsive `OrbitLayout`;
- a blue particle network scan with readable misinformation-context labels and
  social-platform symbols; no stars and no photographic background;
- WebGPU/TSL first, WebGL2 fallback, and an SSR poster/no-JavaScript path;
- Cinzel labels, accessible 44px targets and visible keyboard focus;
- a skip control rendered as DOM type rather than particles — the one
  documented exception to the all-particles rule (see `DECISIONS.md`);
- the isolated `/particle-demo` tuning and fallback route.

`Experience.tsx` starts the new GPU engine only at the intro's outro. The new
lion assembles during the same 2.8 seconds in which the intro veil clears. The
DOM links and fallback poster are present in the initial HTML, but become inert
after hydration while the intro runs. Without JavaScript the intro enhancement
is hidden and the links remain usable.

All eight routes exist as real Next.js pages. Seven use the `SectionPage`
dossier shell; the Geopolitical Brief has its own reading layout. Their content
is authored, not yet fed by the publishing modules.

On 25 August the phone home was returned to the live orbit: `mobileStaticHome`
(which unmounted the canvas at the end of the intro on ≤719px and left the
static editorial index) is gone. The static index is now the mobile
no-JS/no-GPU tier, gated in CSS on `data-canvas`, and the chat launcher's
mobile dock is charged into the orbit's phone bottom reserve as
`CHAT_DOCK_PX` so the pill and the bottom node no longer share a band. See
`DECISIONS.md` for why. **The real-Chrome matrix must be re-captured on the
workstation**: the phone orbit now sits higher (reserve grew from 56px to
84px + safe-area) and no capture has seen the orbit and the launcher pill on
one phone screen.

A P0 pass on 25 August moved four things and each is covered by pure unit tests:

- The chat launcher is **absent** during the intro rather than hidden, so its
  second WebGPU renderer no longer runs behind it.
- `OrbitLayout` gained `nodeHaloRadius` (what is actually drawn, as against the
  DOM box) and `centerY`, and solves each vertical edge separately with a
  phone-only reserve for the browser's own bottom chrome.
- The intro's viewport math has one owner in `components/intro/introLayout.ts`:
  an 86vw line cap, one shared type size per layout, and entry/exit travel
  scaled to the frame on mobile only.
- This found a live bug nothing had seen: at 768×1024 a portrait tablet takes
  the desktop line breaks, and the widest line was rendering at 170vw.

A parallel full-project-review branch (merged the same day, based on a
commit before the mobile-orbit fix above) shipped a separate wave 1:
`not-found`/`error`/`loading` in the site language; intro session memory
(`loz-intro-seen`, now checked alongside `!introSeen` in `introRunning` and
set from the skip/Escape/complete paths — kept independent of the
mobile-orbit fix above, which touched the same file); SectionPage grew a
prev/next + destinations footer with `aria-current`, SVG emblems (SDF stays
GPU-only — see `DECISIONS.md`), rail/H1 scrims, block anchors, and new opt-in
props `surface="quiet"` and `aside`; `Monitoring · active` became `Reference
edition`; the brief got a closing band, corrections consistency and an opaque
mobile header; the chat got offline mode keyed on `error.code`, a one-shot
capability probe, per-route starter chips and labels, typed citation
rendering, auto-scroll and thread management; metadata got real icons, a
1200×630 OG image, sitemap/robots/manifest, themeColor, and `noindex` on
`/particle-demo`; `components/content/` now holds ten documented content
components (see its README), and `PublishedItemView` lives in
`server/contracts/item.ts` with the repo importing it.

**Because the wave-1 branch predates the mobile-orbit fix, its copy of
`CanvasMount.tsx` still carried `mobileStaticHome`/`useMobileHome`; the merge
resolution kept the fix (no mobile-only canvas unmount) and layered the
intro-session-memory feature on top of it.** Re-verify `loz-intro-seen`
behaves on phone widths as part of the re-capture pass below.

The wave-2 session also touched shared infrastructure, not just the three
pages: a `ChatOpenProvider` (`components/chat/chat-open-context.tsx`) now
wraps both `{children}` and `ParticleChatLauncher` in `app/layout.tsx` — the
first shared client context in this codebase, needed so a "Ask the Lion
about this file" button rendered inside `SectionPage`'s footer can open the
chat mounted as its sibling in the root layout; `:root` color tokens landed
in `app/globals.css` with `sections.module.css`/`geopolitical-brief.module.css`
aliasing them (identical fallback values, no visual change); and
`sections.module.css`'s generic prose selectors were rewritten with
`:where(.body)` after `components/content/*` was mounted inside a
`SectionPage` body for the first time and its own styling lost CSS
specificity ties to the generic rules (see `DECISIONS.md` — do not revert
that wrapper).

## Verification

- Full gate green at the end of both wave-2 sessions: typecheck, lint, 323
  tests (1 pgvector skip), production build — 22 routes, all eight
  destination pages plus `/methodology` and `/corrections` static. Dev
  server smoke checks confirmed real content renders (e.g. `Nahal Oz`,
  `Aner Elyakim Shapira`, `Rami Davidian`, `Noam Tibon`, `1948`, `1979`,
  `Ben-Gurion`, `Investigators`, `Human review`) with no error markers on
  every touched route across both sessions.
- **The real-Chrome matrix has not been recaptured** — it predates the P0
  composition changes and all visual work across all three sessions this
  day. Mac-gated tasks (poster rebalance, intro overlap, SDF re-bake,
  capture) are listed under TODOS W2.
- Not independently browser-tested (container has no real Chrome): the
  `ChatOpenProvider` wiring end to end, the `ReportClaimForm`/
  `VolunteerInterestForm` submit flows, Our Heroes and October 7, and —
  new this round — the migrated brief's visual parity with its previous
  bespoke layout (structurally different in two sections by deliberate
  choice, see `DECISIONS.md`) and the new skip links/contrast fixes.
- Fourth-round gate: typecheck, lint, 323 tests, build — 22 routes, all
  green after merging all three forks. Dev-server smoke checks confirmed
  the brief still shows real `VerificationBadge`s, War Update's coverage
  window now renders (previously computed but never displayed), the two
  new Israel's Story chapters render (`Six-Day War`, `Oslo`, `Nasser`,
  `1967`, `1993`), and skip links are present on `SectionPage`/`DocPage`
  routes — no error markers anywhere.
- Fifth-round gate: typecheck, lint, 323 tests, build — all green after
  merging all seven design forks (5 committed cleanly; 2 — Our Heroes,
  Support Us — left real, correct changes uncommitted in their worktrees,
  applied as patches; 1 — Our Heroes — was re-verified by hand,
  `typecheck`/`lint`/`test`/`build`, after its fork's own report was cut
  short mid-sentence, see `.ai/DECISIONS.md`). Dev-server smoke checks on
  all seven redesigned routes confirmed each page's signature device
  renders (`SHARM EL-SHEIKH`, `Exhibit`, `In recognition`, `Chapter`,
  `Gate — human only`, `Module · Report`) with no error markers.
- **Correction, same day**: every "Mac-gated, can't verify in container"
  claim above and in earlier `TODOS.md` rounds was wrong. This session runs
  on the real workstation (`darwin`, Chrome installed at the path
  `scripts/final-verify.mjs` already hardcodes, `playwright-core` a real
  dependency) — the user caught this mid-session. A real-Chrome pass over
  the seven fifth-round compositions found one real bug (October 7's
  "1,200+" figure wrapping onto two lines at the old 4.25rem clamp max) and
  it's fixed (`50aeb48`). The rest of the seven read as intended. **Actually
  Mac-gated** (not a container limitation, a tooling-scope one): the asset
  *bake* pipeline (`bake:nav-icons`, SDF re-bakes) and anything needing a
  real screen reader (VoiceOver) rather than just a real browser.
- Sixth-round gate: typecheck, lint, 323 tests, build — green after merging
  five successful forks (War Update, Fake Resistance, Israel's Story, the
  six-page SEO pass, CI/rollback) plus the Brief states work done directly
  after three identical fork failures. `node scripts/ci-smoke.mjs` — the
  round's own new tool — confirmed all 11 real routes render with zero
  console errors, the cleanest verification signal this session has had.

## Next (cold-start order)

1. **TODOS W4, the P1 unique-composition item, and most of the P3/P6/P7
   backlog are done.** Israel's Story now has seven chapters (only the
   ancient/biblical period is a real remaining gap, deliberately — see
   `.ai/DECISIONS.md`). What's left is explicitly scoped-out follow-up, not
   forgotten work: a family/witness consent-and-removal workflow (would let
   Our Heroes grow past its current three already-public figures, and let
   October 7 build real testimony/remembrance content instead of linking
   out); an active-conflict `SensitiveContent` gate for October 7 if more
   graphic material is added later; a shareable "evidence pack" and a
   documented account-network view for Fake Resistance (both need real data
   this session doesn't have); unique Open Graph images per content type
   (one shared crest image covers all routes today).
2. Confirm the real `VOLUNTEER_INBOX` address in
   `components/support/VolunteerInterestForm.tsx` before this reaches
   production — `volunteers@lionsofzion.io` is a placeholder.
3. Two decisions, not code, still open: confirming `lib/site-config.ts`'s
   `SITE_URL` is actually the canonical production domain, and whether a
   sitewide footer (identity, Contact, a global chat entry) is wanted — if
   so it must be conditional on not being the home route, see
   `DECISIONS.md`.
4. Hebrew/RTL (TODOS P6) hasn't been started — real scope, deserves its own
   round rather than being folded into a backlog batch.
5. Workstation, now confirmed actually reachable this session (see the
   Verification correction above): a fuller real-Chrome pass over
   everything shipped today beyond the one spot-check already done — plus
   VoiceOver specifically (still genuinely out of reach — playwright drives
   a real browser, not the OS screen reader) and the icon SDF re-bake
   (`bake:nav-icons`, a real asset-pipeline tool, not just a browser check).
6. Backend picks unchanged: provisioning (pooled `-pooler` `DATABASE_URL`),
   real auth, brief-generation workflow, wiring `lib/content/*` to
   `GET /api/v1/published-items` for real (blocked on designing the filter
   contract that maps a published item to its target page).

## Blocked

Backend provisioning remains deferred by choice; the code needs no changes
when it happens. Nothing else blocked.
