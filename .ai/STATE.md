# State

Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`. The long backend phase narrative that used to live
here is in this file's git history and in
`~/.claude/plans/splendid-discovering-dawn.md`.

_Last updated: 2026-08-25 (end of session — TODOS W4 is now complete for all
eight destination pages: War Update, Fake Resistance, Support Us,
Methodology/Corrections shipped in an earlier same-day session; October 7,
Our Heroes, Israel's Story and We Are shipped in this one)_

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
  `VolunteerInterestForm` submit flows, and — new this session, and worth
  a deliberate look given the subject matter — Our Heroes and October 7 in
  a real browser before calling either "done."

## Next (cold-start order)

1. **TODOS W4 is now complete for all eight pages.** What's left there is
   explicitly scoped-out follow-up, not unfinished work: a family/witness
   consent-and-removal workflow (would let Our Heroes grow past its
   current three already-public figures, and let October 7 build real
   testimony/remembrance content instead of linking out); Israel's Story's
   remaining chapters (ancient period, 1967, 1973, Oslo, Jordan 1994,
   Abraham Accords — each needs its own fetched sources, one at a time,
   same as the two chapters that exist); an active-conflict
   `SensitiveContent` gate for October 7 if more graphic material is added
   later (none was needed for what's there now).
2. Confirm the real `VOLUNTEER_INBOX` address in
   `components/support/VolunteerInterestForm.tsx` before this reaches
   production — `volunteers@lionsofzion.io` is a placeholder.
3. Two W1/W6 items are genuinely still open (not code, decisions):
   confirming `lib/site-config.ts`'s `SITE_URL` is actually the canonical
   production domain, and whether a sitewide footer (identity, Contact, a
   global chat entry) is wanted — if so it must be conditional on not
   being the home route, see `DECISIONS.md`.
4. Workstation: real-Chrome capture pass over everything visual, including
   this session's four rebuilt pages and the CTA/forms from the session
   before it.
5. Backend picks unchanged: provisioning (pooled `-pooler` `DATABASE_URL`),
   real auth, brief-generation workflow.

## Blocked

Backend provisioning remains deferred by choice; the code needs no changes
when it happens. Nothing else blocked.
