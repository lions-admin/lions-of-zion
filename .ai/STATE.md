# State

Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`. The long backend phase narrative that used to live
here is in this file's git history and in
`~/.claude/plans/splendid-discovering-dawn.md`.

_Last updated: 2026-08-25 (end of session — a fifth same-day round: all seven
dossier pages got a distinct, subject-grounded composition instead of
sharing one generic template, via the `frontend-design` skill and seven
parallel forked agents merged back into `main`)_

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
  `Gate — human only`, `Module · Report`) with no error markers. **Not**
  independently browser-tested: how these seven compositions actually look
  and feel in real Chrome — this is the round most worth a real visual
  look before calling it done, since the whole point was visual
  differentiation and nothing here has been seen rendered outside curl'd
  HTML.

## Next (cold-start order)

1. **TODOS W4 is complete for all eight pages**, and so is the P1 item
   asking for a distinct composition per page family — nothing on the site
   still shares one generic body template, and the Brief is on the shared
   content library too. What's left is explicitly scoped-out follow-up: a
   family/witness consent-and-removal workflow (would let Our Heroes grow
   past its current three already-public figures, and let October 7 build
   real testimony/remembrance content instead of linking out); Israel's
   Story's remaining chapters (ancient period, 1973, Jordan 1994, Abraham
   Accords — each needs its own fetched sources, one at a time, same as the
   four chapters that exist); an active-conflict `SensitiveContent` gate
   for October 7 if more graphic material is added later (none was needed
   for what's there now).
2. Confirm the real `VOLUNTEER_INBOX` address in
   `components/support/VolunteerInterestForm.tsx` before this reaches
   production — `volunteers@lionsofzion.io` is a placeholder.
3. Two W1/W6 items are genuinely still open (not code, decisions):
   confirming `lib/site-config.ts`'s `SITE_URL` is actually the canonical
   production domain, and whether a sitewide footer (identity, Contact, a
   global chat entry) is wanted — if so it must be conditional on not
   being the home route, see `DECISIONS.md`.
4. The accessibility pass this round fixed what's fixable without a live
   browser; a real screen-reader/VoiceOver pass and the real-Chrome
   contrast/focus verification are still open, same workstation-only
   constraint as the visual capture below.
5. Workstation: real-Chrome capture pass over everything visual, including
   all four rounds shipped this day.
6. Backend picks unchanged: provisioning (pooled `-pooler` `DATABASE_URL`),
   real auth, brief-generation workflow.

## Blocked

Backend provisioning remains deferred by choice; the code needs no changes
when it happens. Nothing else blocked.
