# T-7 / T-8 / T-9 / T-10 / T-13 — live browser verification

**Target:** Production, `https://lionsofzion.io`
**Date:** 2026-09-08
**Method:** Real Chromium (Playwright 1.62.1, bundled `chromium-1234`), driven headless
against the live production site. Every value below is a measured DOM/computed-style
reading or rendered text, not an inference from source.

> **Tooling note.** The `claude-in-chrome` extension was not connected
> (`tabs_context_mcp` failed three times; `list_connected_browsers` returned `[]`).
> Verification was done with the repository's own Playwright install instead, which
> gives real layout, computed styles, `document.getAnimations()` and true
> `prefers-reduced-motion` emulation.

| Item | Verdict |
| --- | --- |
| T-7 Article rendering | **PASS** |
| T-8 Homepage rendering | **PASS** |
| T-9 Search behaviour | **FAIL** — no-match state never renders; 10 dead fallback rows |
| T-10 Mobile navigation | **PASS** |
| T-13 Reduced motion | **PASS** |

---

## T-7 — Article rendering — PASS

Swept **all 73 published records** from `/api/v1/published-publications?limit=100`,
loading each at `/articles/<publicId>` at 1440×1000.

| Check | Result |
| --- | --- |
| HTTP status | 73/73 → `200` |
| `<h1>` headline present | 73/73 |
| Authorship line (VA-47) | 73/73 render `Researched, written and published by the Lions of Zion editorial system` |
| Raw `Sources:\n- https://…` dump in prose (VA-56) | **0 of 73** |
| Bare URL lines anywhere in body text | **0 of 73** |
| Structured source stack | 73/73, `section.article-module__…__sources`, 1–23 links each |
| Horizontal overflow (`scrollWidth − clientWidth`) | 0px on all 73 |
| "Continue the record" module (VA-50) | 73/73 render it |

**Provenance block**, measured on `reported-claim-us-ambassador-to-israel-says-ther-0k1g2`,
renders as a labelled stack:

```
AUTHORSHIP  Researched, written and published by the Lions of Zion editorial system
PUBLISHED   Sep 6, 2026, 7:09 AM
UPDATED     Sep 8, 2026, 12:20 PM
SOURCE STACK 4 sources
```

**Sources render as a structured stack**, not prose. `nova-location-file-…-mybn8`,
`section.article-module__skmPua__sources`, 9 `<li>`, 9 `http` links, each carrying
title + publisher:

> Public sources — "Detailed Commission report and location timelines ↗︎ United Nations",
> "Liraz U. survivor testimony ↗︎ October7.org", "Method and findings on the Hamas-led
> assault ↗︎ hrw.org", …

**Headline prefixer** behaves: `narrativeWatchTitle()` output renders once, never doubled —
`"Reported claim: Gaza displacement claim: ministerial proposals exist; …"`. No
`"Reported claim: Analysis: X"` seen on any of the 14 Fake Resistance records.

**Corrections** render where present — 40 of 73 carry a `Corrections and updates` /
`What changed:` section.

**Related module (VA-50) — within spec, including the fallback.**
Distribution of real `/articles/` destinations in "Continue the record":

| Article destinations | Count |
| --- | --- |
| 4 | 66 |
| 3 | 3 |
| 2 | 1 |
| 1 | 1 |
| 0 | 2 |

The 4 records under two destinations all fall back to their hub, which is the
specified behaviour:

- `servicenow-acquires-israeli-ai-startup-sweep-as--zk35j` → `/people-of-israel`
- `european-rabbis-urge-governments-to-confront-the-2igk8` → `/fake-resistance`
- `israel-launches-nis-22-million-tech-human-capita-794jg` → 1 article + `/people-of-israel`
- `ben-gurion-university-team-develops-aerogel-that-0y2we` → 2 articles + `/people-of-israel`

Related links are correctly labelled by relation — `ALSO ON THIS DESK`,
`MORE ON THIS TOPIC`, `MORE ON THIS ACTOR` — and every hub fallback reads
`Everything on <hub name>`.

**Not verifiable — no data in production.** All 73 live records have ≥1 source
(min 1, max 23). **Zero analysis-basis (`evidenceBasis === "analysis"`,
`evidenceIds.length === 0`) records are currently published**, so the
"may publish citing nothing, marked as this organisation's own analysis"
rendering path could not be exercised against production. Cover it with a unit
or fixture test rather than treating it as verified.

---

## T-8 — Homepage rendering — PASS

Loaded `/` at each viewport, `networkidle` + 600ms.

| Viewport | Overflow | Offenders | Lead story box | News | Fake Resistance | People | Empty states | Giant cards | Donation chips visible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | **0px** | 0 | 408×102 @ y512 | 4 | 4 | 2 | 0 | 0 | 4 |
| 1024×800 | **0px** | 0 | 408×84 @ y448 | 4 | 4 | 2 | 0 | 0 | 4 |
| 768×1024 | **0px** | 0 | 449×89 @ y563 | 4 | 4 | 2 | 0 | 0 | 4 |
| 390×844 | **0px** | 0 | 342×78 @ y952 | 4 | 4 | 2 | 0 | 0 | 3 |
| 360×780 | **0px** | 0 | 312×77 @ y901 | 4 | 4 | 2 | 0 | 0 | 3 |
| 812×375 landscape | **0px** | 0 | 374×84 @ y428 | 4 | 4 | 2 | 0 | 0 | 4 |

"Offenders" = every rendered element whose box crosses the viewport edge
(`right > clientWidth + 1` or `left < −1`), scanned across `body *`. Zero at every
width — no horizontal overflow anywhere.

**The lead story leads.** At all six viewports the first `/articles/` link in `<main>`
is *UK confirms settlement-goods trade ban is coming; legal scope awaits Commons
statement*, sitting directly under the "News & Analysis" band heading.

**Three bands render real records** at every width: News & Analysis (4 links),
Fake Resistance (4), The People of Israel (2) — 11 article links total on the page,
identical at every viewport, so nothing drops on mobile. Real headlines confirmed,
e.g. *"How the 'Israel killed Charlie Kirk' theory survived a year without evidence"*,
*"Licensed but waiting: Arab physicians and Israel's residency bottleneck"*.

**No empty or giant-card states.** Scan for placeholder copy
(`no stories|no records|coming soon|nothing here|check back`) in leaf nodes of `<main>`
returned 0 at every viewport. Scan for article cards taller than 1.4× the viewport
returned 0 at every viewport.

**Hero donation chips present (§9 must-not-change).** `Support Us` (header),
`Support the work`, and `Donate with PayPal — A one-off gift, taken…` all render with
non-zero height at every viewport, 3 visible at 360/390 and 4 at the wider sizes.

*Observation, not a defect:* the People band carries 2 article links where News and
Fake Resistance carry 4. Consistent across all six viewports, so it reads as
composition, not a responsive drop — flagging only so it is a deliberate choice.

---

## T-9 — Search behaviour — **FAIL**

### Keyboard and ARIA semantics — PASS (unchanged, nothing touched)

Measured on `/search` at 1440×900. The input is:

```html
<input id="_R_1nmlubrb_-query" type="search" role="combobox"
       aria-expanded="false" aria-controls="_R_1nmlubrb_-results"
       aria-autocomplete="list" autocomplete="off" spellcheck="false"
       enterkeyhint="search" placeholder="A claim, a name, a place">
```

| Check | Result |
| --- | --- |
| `aria-controls` resolves | **yes** → `#_R_1nmlubrb_-results` |
| That target's role | `listbox` |
| `aria-expanded` | `false` when empty → `true` once results exist |
| `aria-autocomplete` | `list` |
| `aria-activedescendant` resolves to a real option | **yes** |
| Live region | one `aria-live="polite"`, announces `25 results for lebanon.` |

Arrow-key traversal moves the selection correctly (query `lebanon`, 25 options):

| Action | `aria-activedescendant` | `aria-selected` index | Announced option |
| --- | --- | --- | --- |
| initial | `…-option-0` | 0 | "01 BRIEF Israel Ministry of Defense activities…" |
| ArrowDown | `…-option-1` | 1 | "02 BRIEF Israel security and diplomacy brief — September 3…" |
| ArrowDown | `…-option-2` | 2 | "03 BRIEF What changed since September 6…" |
| ArrowUp | `…-option-1` | 1 | "02 BRIEF Israel security and diplomacy brief — September 3…" |

`Escape` collapses the listbox and leaves focus on the search input (correct for a
page-level combobox — there is no dialog to dismiss). `Enter` submits to
`/search?q=lebanon`. All as-is; **nothing was changed or weakened.**

### The no-match state — FAIL

**A query that matches nothing renders 10 result rows and announces them as results.**

Query: `zzzqqxwvnothingmatchesthis`

- Live region announces: **`10 results for zzzqqxwvnothingmatchesthis.`**
- Listbox renders **10 `[role="option"]` rows**, section header `BRIEFS  10`
- **No empty state renders at all** — there is no "no results" copy anywhere on the page
- Every one of the 10 rows is a dead end: `aria-disabled="true"`, `<div>` not `<a>`,
  no `href`, badge text `Indexed · no public page`
- Row 01 is auto-highlighted (`aria-selected="true"`, `aria-activedescendant` →
  `…-option-0`), so a keyboard user's first ArrowDown/Enter lands on a disabled row

The 10 rows, in order:

```
01 War Update          06 Methodology
02 We Are              07 Corrections
03 Our Heroes          08 Geopolitical Brief
04 Support Us          09 Fake Resistance
05 October 7           10 Israel's Story
```

**Root cause is the API, not the component.** `GET /api/v1/search?q=zzzqqxwvnothingmatchesthis`
returns these same rows as `entityType: "brief"`, `publicId: "site-*"`, **`href: null`**,
with floor scores:

```json
{"publicId":"site-war-update","href":null,"title":"War Update","score":0.01639344262295082}
{"publicId":"site-we-are","href":null,"title":"We Are","score":0.016129032258064516}
{"publicId":"site-our-heroes","href":null,"title":"Our Heroes","score":0.015873015873015872}
{"publicId":"site-support-us","href":null,"title":"Support Us","score":0.015625}
```

Scores are 0.0156–0.0164 — a rank-floor artifact, not relevance. Because the API always
returns them, the client's empty state is unreachable.

**These rows also leak retired and non-public surfaces.** `site-war-update` is the
`war_update` section removed on 2026-09-05, whose route is a permanent redirect; every
row is a site chrome page indexed as a `brief` with no public destination.

**It contaminates matching queries too.** The `lebanon` query's 25 results include
`"08 BRIEF Israel's Story Indexed · no public page"` — a stray fallback row inside a
genuine result set.

**Suggested fix (not applied — read-only pass):** drop hits with `href === null` from the
search response, or apply a minimum-score threshold, so a genuine no-match returns `[]`
and the empty state renders. Do not fix it in the component by hiding rows — the live
region's "10 results" count comes from the same response.

**Evidence:**
`docs/reviews/production-ux-integrity/after/T9-search-no-match-renders-10-fallback-rows.png` (1440×900)
`docs/reviews/production-ux-integrity/after/T9-search-no-match-390.png` (390×844)

---

## T-10 — Mobile navigation — PASS

Measured at 390×844, 360×780 and 812×375 landscape, `isMobile: true, hasTouch: true`.
Trigger is `header button` "Menu", `aria-expanded="false"`, `aria-controls="_R_hbrbH1_"`,
44×44px (meets the 44px touch target).

The drawer is a **native `<dialog>`**, verified modal: `dialog.matches(':modal') === true`.
`aria-labelledby` resolves to **"Menu"**. `document.body` computed `overflow: hidden`
while open. Zero horizontal overflow at all three sizes.

**Every destination reachable** — identical 13 links at all three viewports:

| Label | href |
| --- | --- |
| News & Analysis | `/geopolitical-brief` |
| Fake Resistance | `/fake-resistance` |
| October 7 | `/october-7` |
| How it works | `/information-war` |
| We Are | `/we-are` |
| The People of Israel | `/people-of-israel` |
| Narratives & Fact Checks | `/fact-check` |
| Methodology | `/methodology` |
| Corrections | `/corrections` |
| Account | `/account` |
| Search | `/search` |
| Ask the desk | `/ask` |
| Support the work | `/support-us` |

All five editorial destinations present. **Canonical labels match the chrome exactly:
"Ask the desk" and "How it works"** — no drift.

**`aria-current` marks the active page**, measured by opening the drawer on each route:

| Route | `aria-current` in drawer |
| --- | --- |
| `/` | none (correct) |
| `/geopolitical-brief` | `/geopolitical-brief` = `page` |
| `/fake-resistance` | `/fake-resistance` = `page` |
| `/october-7` | `/october-7` = `page` |
| `/information-war` | `/information-war` = `page` |
| `/people-of-israel` | `/people-of-israel` = `page` |

The trigger additionally carries `data-here="true"` on a matching route.

**Focus trap holds.** 20 consecutive `Tab` presses on each of five routes: focus stays
inside the dialog on 19 of 20, with the single exception at the wrap point — normal
`showModal()` behaviour where focus passes through the UA dialog root and re-enters
immediately. Focus never reaches page content behind the drawer.

**Escape closes correctly** at all three viewports: `dialog[open]` gone, trigger
`aria-expanded` back to `"false"`, and **focus returns to the menu trigger button**.

**812×375 landscape** behaves identically — same 13 links, same modal, same trap, same
Escape behaviour, 0px overflow, body scroll locked.

---

## T-13 — Reduced-motion behaviour — PASS

Emulated with Playwright `reducedMotion: 'reduce'`, compared against `'no-preference'`
on the same build.

### October 7 rotation — PASS, including the VA-55 label

| | `reduce` | `no-preference` |
| --- | --- | --- |
| Control text | **`Rotation off`** | `Pause` |
| Control `aria-label` | — | `Pause automatic story rotation` |
| Auto-advance over 12s (7 samples @ 2s) | **1 distinct state** — stays `1 / 6` | rotates |

The control reads exactly **"Rotation off"** — **not "Manual"**, which is what VA-55
required. **The rotation does not auto-play under reduced motion:** sampling the
rotation region every 2 seconds for 12 seconds yielded a single distinct state,
`From the archive 1 / 6 Rotation off`.

**Previous/next arrows stay usable.** All four are visible and none disabled:
`Previous story`, `Next story`, `Previous record`, `Next record`. Clicking them under
`reduce` changes the index for real: **1 → Next → 2 → Previous → 1**, identical to the
`no-preference` result.

October 7's content warnings still render — the live region reads
`Content warning: graphic material.` (§9 gates intact).

### ScanBackdrop (VA-59) — PASS

`ScanBackdrop` renders as `[data-register]`, `aria-hidden="true"`, on `/israels-story`,
`/account`, `/search` and `/ask`. Same DOM in both modes — the rows are present and
composed either way; only the animation differs:

| Route | register / speed / density | Animated rows, `reduce` | Animated rows, `no-preference` | Running anims in backdrop, `reduce` | …`no-preference` |
| --- | --- | --- | --- | --- | --- |
| `/israels-story` | default / slow / medium | **0 of 17** | 16 of 17 | **0** | 13 |
| `/account` | default / slow / low | **0 of 17** | 16 of 17 | **0** | 6 |
| `/search` | muted / normal / medium | **0 of 10** | 9 of 10 | **0** | 8 |
| `/ask` | muted / normal / medium | **0 of 10** | 9 of 10 | **0** | 8 |

Under `no-preference` the rows run `driftRight` / `driftLeft` at
`animation-iteration-count: infinite` (142s–322s durations). Under `reduce` those same
rows compute `animation-name: none` and `document.getAnimations()` reports **zero running
animations** — the rows stand at their composed rest positions, which is the intended
"a frame, not a freeze". The preference is respected and the aesthetic is not deleted.

Site-wide confirmation under `reduce`: `/`, `/october-7`, `/fake-resistance`,
`/information-war` all report **0 infinite animations and 0 running animations**.

---

## Could not verify

1. **Zero-source "analysis" article rendering** (T-7) — no `evidenceBasis: "analysis"`
   record is published in production; all 73 live records cite ≥1 source.
2. **`viewport-fit=cover` safe-area behaviour on a physical device** (A11Y-2) — headless
   Chromium reports no notch insets. Unchanged from the open state of that step.
3. **Visible focus ring appearance** — measured programmatically (focus lands on the
   right elements) but ring contrast against the dark ground was not judged visually.
