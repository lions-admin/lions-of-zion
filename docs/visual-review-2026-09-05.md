# Public UI/UX review — 2026-09-05

## Scope and outcome

A broad public-interface refinement, not a claim that every page has been
individually redesigned or that authenticated administration is fully audited.
Changes are local; no commit, push or production deployment was performed.
The existing homepage background video, editorial content, authentication
providers and backend publication logic remain unchanged.

## Material changes

- Replaced global condensed uppercase reading text with the existing editorial
  serif/sans/mono font roles and authored sentence case.
- Quieted scan overlays and removed ruled wallpaper on public reading surfaces.
- Refined shared controls, fields, empty states and focus/border treatment.
- Rebalanced the news lead and feature layout; reduced long article headings.
- Opened up account and support layouts and prevented provider-label overflow.
- Added explicit search clearing, composition-aware fetching and stale-request
  protection through the existing abort mechanism.
- Fixed mobile architecture controls collapsing into single-letter columns.
- Increased information-war link targets and inactive graph-node contrast.
- Retained the compact circular Ask launcher instead of the rectangular dock.

## Rendered coverage

26 routes captured at 1440×1000 and 390×844, all returning HTTP 200 with no
document-width overflow or uncaught page errors:

`/`, `/geopolitical-brief`, `/fake-resistance`, its `/social-media`,
`/official-narrative`, `/playbook`, `/network`, `/watch` routes,
`/october-7`, `/october-7/documentation`, `/october-7/testimonies`,
`/information-war`, `/our-heroes`, `/israels-story`, `/we-are`, `/methodology`,
`/corrections`, `/updates`, `/search`, `/ask`, `/account`, `/support-us`,
`/fact-check`, `/admin`, `/admin/login`, `/pipeline`.

Admin redirected to login: it is not authenticated dashboard coverage.
Four real article/archive/case detail routes were also captured at 1440, 390
and 320 pixels. Representative captures and contact sheets were visually
reviewed, with targeted follow-up captures after fixes.

## Interaction checks

- At 1440, 729 and 390 pixels: Ask open/Escape/focus restoration; menu
  open/Escape; support report opening without submission.
- Search using mocked responses: composition suspension, clear and focus,
  query removal from URL, stale response exclusion, empty and error states.
- At 1440, 390 and 320 pixels: archive clear/focus; mobile filter opening
  and Escape; architecture control layout and overflow.
- Geometric audit covered home, news, search, account, support and
  information-war at desktop/mobile sizes. Small link targets and graph border
  contrast found on information-war were corrected and rechecked.

Local screenshots and machine-readable results are in
`/tmp/loz-design-review/`; these are temporary review artifacts, not deployed
site assets.

## Known limits and follow-up

- Real iPhone/Safari, external OAuth callbacks, paid services and AI answers
  were not exercised. No payment or public submission was made.
- Authenticated administration still needs a separate visual/interaction pass.
  The premium static audit flags nine admin forms relying on native validation
  and one admin textarea resize rule. Do not mechanically add `noValidate`
  without implementing equivalent accessible validation.
- The floating Ask launcher can overlap content at a given scroll position;
  this pass preserves its fixed-position behavior. A different placement
  pattern needs a deliberate follow-up, especially around mobile forms.
- This is not an editorial fact-check or approval of publication contents.
- Full tests initially found two scan-opacity baseline mismatches introduced
  by the quieter design; the expected baseline was updated without weakening
  the existing contrast thresholds. Final check results are appended below.

## Final technical results

- Production build and typecheck: passed.
- Focused lint of app/components/lib/tests: no errors; one existing unused
  `_id` warning in `components/ai-elements/prompt-input.tsx:865`.
- Full suite before baseline correction: 1101 passed, two baseline failures,
  one skipped. After correction: all 47 tests across the six affected UI and
  accessibility suites passed; the full suite was not needlessly repeated.
- Information-war geometric recheck: zero critical findings or warnings at
  both 390×844 and 1440×900. Detail-route checks passed again after title sizing.
- Premium static audit: ten outstanding admin-specific findings described
  above; not represented as a clean whole-project audit.
- `git diff --check`: passed.

## Approved follow-up: separate news and narrative journeys

News now leads with individual updates, then the daily briefing, a secondary
narrative-desk link, and a collapsed archive. Filtering reads archive results
separately and preserves the current edition. Queries retrieve up to 50 items
per news section; no invented story splits or editorial ranking are introduced.
The narrative hub leads with three monitoring records, using a shared component
that presents status before the claim. The monitoring archive groups its latest
25 records by Jerusalem publication date. Source/detail links and existing
article relationships are preserved; no inferred relationships are added.

Verified three routes at 1440, 877, 390 and 320 pixels: successful responses,
no horizontal overflow, native archive expansion, mobile filter drawer and GET
submission preserving the current news. All 39 focused tests passed, as did
focused lint, typecheck and production build. Final launcher CSS uses literal
attribute selectors (CSS Modules would scope bare IDs); its in-flow positioning
was rechecked on all three routes. Real iPhone testing and production deployment
remain outside this local verification.
