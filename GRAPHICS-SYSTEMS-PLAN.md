# LIONS OF ZION — Graphics Systems Consolidation Plan

Date: 2026-09-04  
Status: Planning only. No graphics, SVGs, code, CSS, UI, routes, or implementation were created or changed.

## 1. Executive Summary

The Desktop and Mobile/Tablet audits contain **29 requirements (`G-001`–`G-029`)**, but they do not justify 29 separate assets or visual languages. They consolidate into **7 graphics systems**, **17 asset packages (`A-001`–`A-017`)**, and **10 UX/functional work items (`UX-001`–`UX-010`)**.

- **Final system count:** 7.
- **Final A-ID count:** 17.
- **Shared asset packages:** 14.
- **Bespoke asset packages:** 3.
- **Net-new asset packages:** 14.
- **Existing assets to normalize/derive:** 2.
- **Existing asset/template to validate only:** 1.
- **G-IDs reclassified as UX-only with no unique graphic:** 4 (`G-007`, `G-017`, `G-018`, `G-022`).
- **Priority changes:** 14 G-IDs.
- **Production implication:** Only 16 A-IDs need a production touch; `A-004` already exists and needs validation, not recreation.

The key consolidation is to make icons, record markers, provenance, states, safe-media frames, and process diagrams extensions of one visual grammar. Large bespoke work remains limited to:

1. Fake Resistance network visualization.
2. Israel’s Story map/timeline.
3. Information War conceptual hero.

### Existing asset correction

The browser audit reported visibility, not repository existence. Source inspection confirms that the repository already contains:

- app icons at `public/icon-192.png`, `public/icon-512.png`, and `app/apple-icon.png`;
- favicon/icon sources at `app/favicon.ico` and `app/icon.svg`;
- a generated OpenGraph image at `app/opengraph-image.tsx` and root metadata using `public/posters/particle-nav.webp`;
- brand masters and derivatives under `assets/brand/generated-2026-08-28/`;
- a live homepage lion asset and responsive composition;
- eight existing section emblems in `public/emblems/` and matching particle SDF icons in `public/icons/`;
- shared `StatusState` and `Badge` primitives with an existing state/evidence grammar.

Therefore `G-002` is **not “missing” as a whole**, and `G-003` does **not require a new hero illustration**. The remaining work is normalization, a compact vector master, crop/export rules, and consistent use.

## 2. Consolidated Graphics Systems

### SYS-01 — Brand Identity & Hero Family

- **Purpose:** Maintain one recognizable identity from favicon through mobile header, homepage hero, and social preview.
- **Visual Language:** Crowned/scan-line lion, cream wordmark, restrained gold axis/accent, black field, editorial serif plus data-monospace support.
- **Included G-IDs:** `G-001` (brand portion), `G-002`, `G-003`.
- **Required Assets:** `A-001`–`A-004`.
- **Variants:** Primary lockup; stacked lockup; compact lion mark; monochrome; dark/light; app/favicons; social/OG; hero desktop; hero portrait/mobile crop.
- **Desktop Behavior:** Full lockup and wide hero composition; hero remains the strongest visual asset.
- **Mobile Behavior:** Responsive composition, not a second art style. Use compact mark only when the text lockup and utility controls cannot coexist. Preserve lion eyes/face and reduce surrounding scan field before reducing the mark itself.
- **Reusable Components:** Header identity, social-card template, hero media frame, intro brand mark.
- **Production Format:** SVG master for the compact mark/lockups; existing PNG/WebP/AVIF for raster hero/social derivatives.
- **Priority:** P1.
- **Dependencies:** Brand master selection and legal/owner approval of the canonical lion/crown shape.

### SYS-02 — Core Icon & Action System

- **Purpose:** Replace mixed tiny icons, chevrons, and text glyphs with one functional family.
- **Visual Language:** Geometric outline icons with squared dossier character, open interiors, minimal detail, and no decorative fill.
- **Included G-IDs:** `G-005`, icon portions of `G-007`, `G-013`, `G-018`, `G-020`, `G-022`, `G-025`, `G-028`, `G-029`, plus process icons used by `G-010`/`G-026`.
- **Required Assets:** `A-005`, `A-006`, `A-013`.
- **Variants:** Utility, action, record-type, media/source, process; active/inactive/disabled; compact/default/mobile presentation sizes.
- **Desktop Behavior:** 16–20 px visual size in metadata and 20–24 px in controls; labels remain when meaning is not universally obvious.
- **Mobile Behavior:** Same vector assets; 20–24 px visual size inside minimum 44 × 44 px targets. Do not create larger duplicate SVGs. Icon-only controls require accessible names; ambiguous actions retain text.
- **Reusable Components:** Icon primitive, icon button, labeled action row, record marker, process step marker.
- **Production Format:** One SVG symbol/component set using currentColor; no per-page SVG forks.
- **Priority:** P1 foundation.
- **Dependencies:** Existing Button accessibility contract and final semantic naming list.

#### Icon design tokens

| Token | Specification |
|---|---|
| Canonical canvas | `24 × 24` units |
| Stroke width | `1.5` units default; `1.75` only for small optical correction |
| Line cap | Round for motion/direction strokes; square for dossier/frame edges |
| Line join | Round unless a deliberate document corner is required |
| Corner treatment | Small squared radius; never fully pill-like |
| Optical weight | Equal apparent darkness beside uppercase metadata at 12–13 px |
| Compact size | 16 px visual box |
| Default size | 20 px visual box |
| Mobile size | 20–24 px visual box inside a 44 px minimum target |
| Active state | Cream/gold foreground plus text/shape cue; not color alone |
| Inactive state | Neutral ink on transparent or quiet surface |
| Disabled state | Reduced contrast plus dashed/hollow state marker when relevant |

### SYS-03 — State, Absence & Recovery System

- **Purpose:** Give empty, loading, unavailable, and recovery states one visual grammar without hiding product-state ambiguity.
- **Visual Language:** Dossier/locator frame, status ring, scan line, document slot, and small signal marker. The existing `StatusState` status labels and cause mapping remain the semantic foundation.
- **Included G-IDs:** `G-001` (intro state), `G-006`, `G-014` (small evidence-state treatment), `G-015`, `G-016`, `G-017`, `G-019`, `G-024`.
- **Required Assets:** `A-008`, `A-009`.
- **Variants:** Idle, loading, processing, empty, no results, success, warning, error, unavailable, missing file, source unavailable, signed out.
- **Desktop Behavior:** Shared frame and marker at compact/standard sizes; product copy and recovery action determine meaning.
- **Mobile Behavior:** Same assets with simplified frame density and stacked copy/action. Animations are optional and never the only state cue.
- **Reusable Components:** State frame, state glyph, recovery action slot, status label, source/record recovery list.
- **Production Format:** Responsive SVG/CSS composition; glyphs as part of the shared icon/state registry.
- **Priority:** P1, with `G-019` functional logic remaining P0.
- **Dependencies:** `UX-001`, `UX-003`, `UX-005`, `UX-006`; no state asset is approved until the corresponding state has a defined trigger and exit.

### SYS-04 — Evidence, Provenance & Record System

- **Purpose:** Make record type, evidence status, source type, linkability, and recency scannable without turning the site into a thumbnail-heavy news portal.
- **Visual Language:** Small markers, rails, stamps, compact icons, and text labels. The existing `Badge` grammar is the starting point; color is never the only cue.
- **Included G-IDs:** `G-008`, `G-020`, `G-025`, `G-028`, `G-029`.
- **Required Assets:** `A-006`, `A-007`.
- **Variants:** Brief, testimony, documentation, War Update, Narrative Watch, source, actor, location, internal, external, legacy, unavailable, no public page, verified, updated.
- **Desktop Behavior:** Record marker in a leading rail or metadata row; no mandatory large thumbnail.
- **Mobile Behavior:** Same assets at 20–24 px; metadata stacks to two lines; status remains adjacent to text; no badge may force horizontal overflow.
- **Reusable Components:** Record rail, provenance badge, evidence stamp, metadata icon-label, external-link marker.
- **Production Format:** SVG icon/mark set plus component-level composition.
- **Priority:** P1 because provenance is trust-critical and high-use.
- **Dependencies:** Canonical vocabulary and mapping to existing `BadgeStatus`/record types.

### SYS-05 — Safe Media & Identity System

- **Purpose:** Represent people and media without fabricated faces, consent violations, or automatic exposure of graphic content.
- **Visual Language:** Neutral archival frame, silhouette/monogram, covered-media panel, explicit media-type mark, consent/source line, and on-request state.
- **Included G-IDs:** `G-011`, `G-021`, `G-023`.
- **Required Assets:** `A-010`, `A-011`; media-type glyphs come from `A-006`, not a new family.
- **Variants:** Approved portrait, no-consent identity, testimony, film, photograph, documentation, covered, available, on request.
- **Desktop Behavior:** Identity/media frame may sit beside metadata, but the boundary label remains visible.
- **Mobile Behavior:** Compact marker or stacked frame above metadata. No auto-loaded poster, blur that reveals content, or hidden warning.
- **Reusable Components:** Consent-safe identity frame, covered-media frame, media-type label, source/consent metadata slot.
- **Production Format:** SVG/CSS frame and icons; approved raster portrait only when supplied and consented.
- **Priority:** P1 trust/safety.
- **Dependencies:** Existing sensitive-media gate and consent/source metadata model.

### SYS-06 — Editorial Atmosphere & Background Tiers

- **Purpose:** Create hierarchy across hero, editorial, archive, utility, error, and long-form pages without adding unrelated illustrations.
- **Visual Language:** Existing black/cream/gold field, scan bands, dossier grids, registration marks, restrained redaction/signal motifs, and fewer/larger texture events.
- **Included G-IDs:** `G-004`, editorial portion of `G-008`, `G-026` (dividers), `G-027`.
- **Required Assets:** `A-012`, `A-017`.
- **Variants:** Hero, Editorial, Archive, Utility, Quiet Long-form; desktop and low-density mobile tiers.
- **Desktop Behavior:** Tiered density and section pacing; no repeated high-density texture behind every text block.
- **Mobile Behavior:** Same system with fewer marks, lower density, and protected text zones. Prefer CSS/viewBox changes over duplicate bitmap backgrounds.
- **Reusable Components:** Background tier, section divider, registration mark, signal band, long-form pacing rule.
- **Production Format:** CSS gradients/patterns and responsive SVG overlays; bespoke hero as responsive SVG/CSS composition.
- **Priority:** P2 overall; `A-017` is P3 polish.
- **Dependencies:** Final contrast checks and content-safe placement rules.

### SYS-07 — Process & Structural Visualization

- **Purpose:** Reuse a common structural grammar for processes while allowing data-specific bespoke views.
- **Visual Language:** Numbered nodes, thin paths, labeled steps, selected/current state, clear legends, and sparse gold/ember emphasis.
- **Included G-IDs:** `G-009`, `G-010`, `G-012`, `G-026`.
- **Required Assets:** `A-013`–`A-016`.
- **Variants:** Process sequence; network clusters; map/timeline chapters; desktop overview; mobile selected-item/detail composition.
- **Desktop Behavior:** We Are and Methodology reuse the same process icons/composition. Network and map use shared node/path/legend primitives but retain bespoke information architecture.
- **Mobile Behavior:** Process becomes vertical. Network becomes clusters/cards plus selected-node detail. Map/timeline becomes vertical chronology with map reveal or horizontal map pan. No direct shrink of desktop diagrams.
- **Reusable Components:** Node, path, chapter marker, legend, process step, selected detail panel.
- **Production Format:** Responsive SVG and component-driven data visualization; static raster only as a non-interactive fallback.
- **Priority:** P2 after foundations and trust systems.
- **Dependencies:** `UX-007`, `UX-008`, sourced data models, labeling rules, and interaction specification.

## 3. G-ID Classification and Mapping

| G-ID | Original Requirement | Category | Consolidated Into | Asset Needed? | UX Change? | Desktop | Mobile | Final Priority |
|---|---|---|---|---|---|---|---|---|
| G-001 | Intro illustration/state | B + D | SYS-01, SYS-03 | Shared state/brand assets only | Yes | Full intro state | Responsive composition, reduced motion | **P1** (was P0) |
| G-002 | Logo/app/OG | B | SYS-01 | Normalize existing + compact vector | No | Full lockup/social | Compact mark when constrained | P1 |
| G-003 | Hero lion | B | SYS-01 | Existing master; crop derivative only | No | Existing wide composition | Portrait crop/composition | P3 |
| G-004 | Background texture | A + E | SYS-06 | Yes, one tier pack | No | Tiered density | Simplified low-density tier | P2 |
| G-005 | Utility icon set | A | SYS-02 | Yes, shared family | Touch sizing | Default/compact | Same vectors in 44 px targets | **P1** (was P2) |
| G-006 | War Update state | A | SYS-03 | Shared frame/glyph | State cause must be explicit | Standard state | Compact stacked state | P1 |
| G-007 | Filter/status icons | D | SYS-02 | **No unique graphic** | Yes | Filter row/drawer | Stacked/drawer interaction | P2 |
| G-008 | Editorial thumbnails | A + E | SYS-04, SYS-06 | Marker, not thumbnail family | No | Rail/record marker | Compact leading marker | **P2** (was P1) |
| G-009 | Network diagram | C + D | SYS-07 | Bespoke | Yes | Graph overview | Different UX: clusters/cards/detail | **P2** (was P1) |
| G-010 | Process icons | A | SYS-02, SYS-07 | Shared process extension | Layout | Horizontal/vertical sequence | Vertical numbered sequence | **P2** (was P1) |
| G-011 | Safe portrait frame | A + B | SYS-05 | Shared safe identity frame | Consent rules | Frame beside metadata | Compact/stacked frame | P1 |
| G-012 | Map/timeline | C + D | SYS-07 | Bespoke | Yes | Map + chronology | Different UX: timeline + reveal/pan | **P2** (was P1) |
| G-013 | Support action icons | A | SYS-02 | Included in core icons | Touch sizing | Labeled actions | Same icons, full-row targets | **P3** (was P2) |
| G-014 | Ask evidence illustration | E | SYS-03, SYS-04 | Shared compact marker only | No | Small evidence marker | Simplified marker | **P3** (was P2) |
| G-015 | Ask async states | A + D | SYS-03 | Provisional shared state assets | Yes, test first | Defined state slots | Stacked states | P1 |
| G-016 | Empty corrections ledger | A | SYS-03 | Shared state frame/glyph | No | Standard state | Compact state | **P2** (was P1) |
| G-017 | Account/session graphic | D | SYS-03 | **No unique graphic** | Yes, timeout/error behavior | Text/state marker | Same behavior, stacked | P1 |
| G-018 | Search keyboard tokens | D | SYS-02 | **No unique mobile graphic** | Yes | Key hints allowed | Hide hints; touch controls | P2 |
| G-019 | Search no-results | A + D | SYS-03 | Shared no-results marker | Yes, state logic first | Explicit state | Explicit stacked state | P0 |
| G-020 | Result-type icons | A | SYS-02, SYS-04 | Shared record set | No | Marker + metadata | Compact marker + wrap | P2 |
| G-021 | Testimony placeholder | A + B | SYS-05 | Shared identity frame | Safe-media boundary | Standard card marker | Compact marker | P1 |
| G-022 | Language markers | D | SYS-02 | **No dedicated icon asset** | Yes | Text labels + selected state | Wrap/selector, labels retained | **P3** (was P1) |
| G-023 | Safe media placeholder | A + B | SYS-05 | Shared covered-media frame | Gate remains functional | Covered frame | Simplified stacked frame | P1 |
| G-024 | 404/missing file | A + B | SYS-03 | Shared recovery frame/glyph | Recovery paths | Standard recovery | Compact recovery | P1 |
| G-025 | Source/status icons | A | SYS-02, SYS-04 | Shared provenance set | No | Metadata row | Stacked metadata | **P1** (was P2) |
| G-026 | Methodology dividers | A + E | SYS-06, SYS-07 | Reuse process assets | Layout | Process composition | Vertical compact composition | P2 |
| G-027 | Information War hero | C + E | SYS-06 | Bespoke | No | Wide conceptual composition | Portrait/simplified composition | **P3** (was P2) |
| G-028 | Feed markers | A | SYS-04 | Shared record markers | Filter/layout | Timeline rail | Compact rail | **P2** (was P3) |
| G-029 | Provenance badges | A | SYS-04 | Shared badge/icon set | Wrap behavior | Compact badge | Wrap-safe icon + text | **P2** (was P3) |

### Category totals

- **A — Shared Graphic System:** 19 G-IDs have a shared-system component.
- **B — Shared Asset + Variants:** 8 G-IDs.
- **C — Bespoke Graphic:** 3 G-IDs.
- **D — UX / Functional Requirement:** 9 G-IDs include functional work; 4 require no unique graphic.
- **E — Optional / Polish:** 5 G-IDs include optional/polish scope.

Categories overlap where a requirement contains both product behavior and a graphic layer.

## 4. Asset Production List

| Asset ID | System | Asset | Variants | Used By | Format | Disposition | Priority |
|---|---|---|---|---|---|---|---|
| A-001 | SYS-01 | Canonical compact lion/crown vector master | Color, monochrome, dark/light | G-002, G-001 | SVG | New; derive from approved existing identity | P1 |
| A-002 | SYS-01 | Brand lockup export pack | Horizontal, stacked, compact, monochrome | G-002 | SVG + PNG exports | Normalize existing files | P1 |
| A-003 | SYS-01 | Hero lion responsive master/crops | Desktop wide, mobile portrait, fallback | G-003, G-001 | Existing raster/WebP/AVIF + crop spec | Derive from existing hero; no new illustration | P1 |
| A-004 | SYS-01 | Social/OG card template | Default, article/title variant | G-002 | Existing `next/og` template | Validate only; do not recreate | P2 |
| A-005 | SYS-02 | Utility and action icon set | Search, Ask, Menu, filter, calendar, clear, open, close, share, report, donate, volunteer, account | G-005, G-007, G-013, G-018 | SVG symbols/components | New shared set | P1 |
| A-006 | SYS-02/04/05 | Record and media type icon set | Brief, War Update, Narrative Watch, testimony, documentation, film, photo, source, actor, location | G-020, G-021, G-023, G-025, G-028 | SVG symbols/components | New shared subset | P1 |
| A-007 | SYS-04 | Evidence/provenance mark set | Verified, updated, internal, external, legacy, unavailable, no public page | G-008, G-020, G-025, G-028, G-029 | SVG marks + badge composition | New; align with existing Badge grammar | P1 |
| A-008 | SYS-03 | Shared state frame | Compact, standard, mobile simplified | G-001, G-006, G-014–G-019, G-024 | Responsive SVG/CSS composition | New shared frame | P1 |
| A-009 | SYS-03 | State glyph set | Idle, loading, empty, no results, success, warning, error, unavailable, missing file, signed out | G-006, G-015–G-019, G-024 | SVG/CSS | New; extends existing StatusState | P1 |
| A-010 | SYS-05 | Consent-safe identity frame | Monogram, silhouette, approved portrait, testimony | G-011, G-021 | SVG frame + optional approved raster slot | New shared system | P1 |
| A-011 | SYS-05 | Covered-media frame | Film/photo/document; covered/available/on request | G-023, G-021 | SVG/CSS | New shared system | P1 |
| A-012 | SYS-06 | Background/editorial motif tier pack | Hero, Editorial, Archive, Utility, Quiet; mobile low-density | G-004, G-008, G-026 | CSS + responsive SVG overlays | New/derive from existing texture | P2 |
| A-013 | SYS-02/07 | Process icon extension | Intake, check, source, label, publish, correct | G-010, G-026 | SVG symbols/components | New extension of core icons | P2 |
| A-014 | SYS-07 | Process composition template | Horizontal, vertical, numbered, current/completed | G-010, G-026 | Responsive SVG/component specification | New shared composition | P2 |
| A-015 | SYS-07 | Fake Resistance network visualization | Desktop graph; mobile clusters/cards/detail; static fallback | G-009 | Data-driven SVG/component | **Bespoke** | P2 |
| A-016 | SYS-07 | Israel’s Story map/timeline | Desktop map/chronology; mobile timeline/map reveal | G-012 | Data-driven SVG/component | **Bespoke** | P2 |
| A-017 | SYS-06 | Information War conceptual hero | Desktop wide, mobile portrait/simplified | G-027 | Responsive SVG/CSS composition | **Bespoke** | P3 |

### Asset count interpretation

- `A-001`–`A-014` are reusable/shared packages.
- `A-015`–`A-017` are bespoke.
- `A-004` already exists and needs only visual/metadata validation.
- `A-002` and `A-003` are normalization/derivative work from existing material.
- The remaining 14 packages are net-new production units, but several are icon subsets or responsive compositions rather than individual illustrations.

## 5. UX / Functional Work List

| UX ID | Related G-ID | Problem | Required Behavior | Graphic Dependency | Priority |
|---|---|---|---|---|---|
| UX-001 | G-001 | Intro can look like a broken black screen | Defined progress/reveal, prominent skip, session memory, reduced-motion immediate path | A-001, A-008 | P1 |
| UX-002 | G-007 | Desktop filter row is not a mobile interaction model | Stacked controls or one filter drawer; persistent selected/filter count state | A-005 optional | P1 |
| UX-003 | G-019 | Search conflates loading, no-results, fallback, and error | Explicit state machine and stable recovery action | A-008, A-009 | P0 |
| UX-004 | G-018 | Desktop keyboard hints are irrelevant on touch | Hide/collapse key hints on touch and expose clear/open actions | A-005 | P2 |
| UX-005 | G-015 | Ask loading/error/success behavior was not verified | Exercise state transitions without duplicate submit; define no-answer and source-bearing result behavior | A-008, A-009 after behavior is proven | P1 |
| UX-006 | G-017 | Session fetch can remain visually in checking while network behavior is unresolved | Add bounded checking behavior, explicit signed-out/unavailable/error outcome, and retry where appropriate | No unique graphic; shared state glyph optional | P1 |
| UX-007 | G-009 | Full network graph cannot be shrunk to mobile | Desktop overview; mobile cluster list/cards, selected-node detail, optional explicit pan/zoom view | A-015 | P2 |
| UX-008 | G-012 | Combined map/timeline cannot be directly resized | Desktop synchronized map/chronology; mobile vertical chapters with map reveal/pan | A-016 | P2 |
| UX-009 | G-022 | Language buttons become dense on mobile | Preserve text labels, selected state, counts, and 44 px targets via wrap or selector | No dedicated graphic | P2 |
| UX-010 | G-023 | Safe archive must not expose graphic media automatically | Covered default, explicit warning/request action, media-type label, no revealing poster before consent | A-006, A-011 | P0 safety |

### Functional-first gates

- **G-019:** `UX-003` must be implemented before the no-results illustration is treated as complete.
- **G-017:** “Checking your sign-in…” is a legitimate loading state, but the source uses an unbounded session fetch. The observed persistent state should be treated as a behavior/timeout issue to verify, not as evidence that an account illustration is missing.
- **G-015:** Ask state assets remain provisional until loading, error, no-answer, and successful sourced-answer transitions are observed and specified.

## 6. Bespoke Graphics

### A-015 — Fake Resistance network visualization

This is bespoke because its geometry and interactions depend on evidence-backed entities, relationships, cluster membership, confidence, and selection. It may reuse SYS-02 icons, SYS-04 provenance marks, and SYS-07 node/path/legend primitives, but the composition cannot be a generic background diagram.

- Desktop: overview graph, clusters, paths, selected node, source/provenance panel.
- Mobile: cluster summary, relationship cards, selected-node detail; optional explicit pan/zoom mode.
- Constraint: every visual relationship must map to a labeled record; no decorative or inferred connections.

### A-016 — Israel’s Story map/timeline

This is bespoke because geography, chapter chronology, boundaries, legends, and source context require a dedicated information model. It may reuse chapter markers and legend primitives, but not the network composition.

- Desktop: synchronized chronology, map, chapter markers, legend.
- Mobile: vertical timeline; selected chapter; map reveal or controlled horizontal pan.
- Constraint: avoid ambiguous territory fills; label scope/date and provide an explicit legend.

### A-017 — Information War conceptual hero

This is bespoke because it establishes one page’s narrative concept rather than a reusable functional state. It should still use SYS-06 signal/noise, redaction, typography, and color rules.

- Desktop: wide verified/unverified signal composition.
- Mobile: portrait crop or vertically stacked bands with reduced detail.
- Constraint: abstract and non-photographic; no fabricated screenshots, claims, headlines, or social proof.

## 7. Reuse Matrix

| Asset/System | Home | Brief | Search | Ask | Fake Resistance | October 7 | Articles | Updates | Other |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SYS-01 Brand Identity | High | Header | Header | Header | Header | Header | Social/header | Header | Account/404 |
| SYS-02 Core Icons | Header/nav | Filters | Controls | Composer | Navigation | Filters/media | Metadata | Filters | Support/process |
| SYS-03 State & Recovery | Intro/latest | Empty/error | All query states | Async states | Empty/error | Empty/error | Missing record | Empty/error | War, Corrections, Account, 404 |
| SYS-04 Evidence & Provenance | Latest record | Record rail | Result types | Sources | Evidence links | Record types | Metadata/sources | Feed markers | Corrections |
| SYS-05 Safe Media & Identity | — | — | Result marker | — | — | High | Consent metadata | — | Our Heroes |
| SYS-06 Editorial Atmosphere | Hero | Editorial tier | Utility tier | Utility tier | Editorial tier | Archive tier | Quiet long-form | Editorial tier | Methodology/Information War/404 |
| SYS-07 Structural Visualization | — | — | — | — | Network | — | — | — | We Are, Methodology, Israel’s Story |
| A-015 Network | — | — | — | — | High | — | — | — | — |
| A-016 Map/timeline | — | — | — | — | — | — | — | — | Israel’s Story |
| A-017 Concept hero | — | — | — | — | — | — | — | — | Information War |

## 8. Priority Review

### Priority principles

- **P0:** A user cannot reliably complete or safely understand the action/state.
- **P1:** Brand-, trust-, safety-, or high-frequency foundation.
- **P2:** Important comprehension/scanning improvement that does not block core use.
- **P3:** Optional polish or page-specific enhancement.

### Changed priorities

| G-ID | Change | Reason |
|---|---|---|
| G-001 | P0 → P1 | The intro clarity issue is serious, but the page remains escapable via Skip; product usability is not wholly blocked. |
| G-005 | P2 → P1 | A shared icon foundation affects navigation, Search, Ask, archives, metadata, and every later system. |
| G-008 | P1 → P2 | Large thumbnails are unnecessary; restrained record markers improve scanning but are not launch-critical. |
| G-009 | P1 → P2 | The network is high-value bespoke work, but the existing sourced long-form page remains usable without it. |
| G-010 | P1 → P2 | Process icons improve comprehension but prose already communicates the workflow. |
| G-012 | P1 → P2 | Map/timeline adds substantial orientation, but sourced chapters remain usable without it. |
| G-013 | P2 → P3 | Clear text labels already distinguish Support actions; icons are polish. |
| G-014 | P2 → P3 | The Evidence Boundary works in text; a small marker is optional. |
| G-016 | P1 → P2 | The empty Corrections ledger is understandable in text; a graphic improves finish, not function. |
| G-022 | P1 → P3 | Language names and selected states are sufficient; a dedicated language icon adds little and may increase ambiguity. |
| G-025 | P2 → P1 | Provenance is central to trust and should be solved with the shared evidence system. |
| G-027 | P2 → P3 | The page statement and structure work without a conceptual hero; this is bespoke polish. |
| G-028 | P3 → P2 | Shared feed markers improve a recurring high-density surface and cost little once SYS-04 exists. |
| G-029 | P3 → P2 | Internal/external/legacy/unavailable distinction prevents provenance confusion across many routes. |

No G-ID was raised to P0. The P0 work is functional: Search state separation (`UX-003`) and the safe-media gate (`UX-010`).

## 9. Desktop / Mobile Strategy

### Same asset

Use the identical vector/source asset with responsive sizing for:

- core utility/action icons;
- record/media type icons;
- provenance marks;
- state glyphs;
- safe identity/media symbols;
- process icons;
- compact lion mark.

### Responsive composition

Use the same visual concept and assets with layout/viewBox changes for:

- brand lockups and hero lion;
- state frame;
- safe identity/media frame;
- process sequence;
- background tiers;
- feed/record rails.

### Simplified variant

Reduce detail, not meaning, for:

- background textures;
- state frame decoration;
- safe-media frame;
- Information War hero;
- network/map static fallbacks.

### Different UX

Do not solve these by exporting a smaller image:

- Search keyboard hints and result state behavior;
- responsive filter controls;
- Ask async lifecycle;
- account checking/error behavior;
- network navigation on mobile;
- map/timeline navigation on mobile;
- language filter interaction;
- safe-media request/consent boundary.

### Mobile rules

1. Default to shared responsive SVG, CSS, viewBox, and component composition.
2. Create a mobile-specific asset only when information hierarchy changes, as in A-015/A-016/A-017.
3. Visual icon size is 20–24 px; touch target is at least 44 × 44 px.
4. Protect text zones from scan texture and decoration.
5. Never hide provenance, warning, consent, or state labels to save space.
6. No wide badge, diagram, or label may create document-level horizontal overflow.

## 10. Design-System Rules

### Line and shape

- Canonical icon canvas: 24 × 24.
- Default stroke: 1.5; use 1.75 only for optical correction at compact display sizes.
- Use thin structural rules consistent with the dossier interface.
- Corners are squared or slightly softened; avoid pills and fully rounded cards.
- Fill is reserved for selected/status emphasis, not default icon construction.

### Color roles

- **Black:** primary field and deep surfaces.
- **Cream:** primary readable foreground and identity lockup.
- **Gold:** selection, verified emphasis, current state, and primary brand axis; never ambient decoration everywhere.
- **Neutral gray/ink:** inactive controls, secondary metadata, empty/idle states.
- **Warning/ember:** disputed, caution, or content boundary.
- **Red/danger:** error or safety-critical warning only; never decorative drama.
- Color must always be paired with label, shape, pattern, or icon.

### Typography interaction

- Serif display typography remains dominant for page and state titles.
- Monospace metadata aligns with icons, rails, counts, and provenance.
- Icons must not replace necessary labels for evidence, language, consent, or unfamiliar actions.
- Avoid placing detailed graphics behind long-form copy.

### Illustration/detail

- Shared state and safe-media graphics use sparse geometry and one focal marker.
- Editorial graphics remain abstract and evidence-compatible; no stock photography.
- No generated people, reenactments, dramatic memorial scenes, fabricated documents, or unsourced social-media imagery.
- Bespoke visualization detail must be driven by sourced data, not decorative density.

### Animation

- Motion communicates loading, scanning, selection, causality, or transition only.
- Loading motion is subtle and bounded; a textual state always remains present.
- No perpetual decorative motion in long-form reading areas.
- Reduced-motion mode removes loops and provides immediate state/reveal changes without loss of meaning.

## 11. Recommended Production Order

### Phase 0 — Functional definitions

1. `UX-003` Search state machine.
2. `UX-010` safe-media boundary contract.
3. `UX-005` Ask state verification.
4. `UX-006` Account checking/error behavior.

These definitions prevent graphics from masking unresolved product behavior.

### Phase 1 — Brand and icon foundation

- `A-001` compact lion/crown vector master.
- `A-002` lockup export pack.
- `A-003` responsive hero crops.
- `A-005` utility/action icon set.

### Phase 2 — Trust and high-use shared systems

- `A-006` record/media type icons.
- `A-007` evidence/provenance marks.
- `A-008` shared state frame.
- `A-009` state glyphs.

### Phase 3 — Trust/safety assets

- `A-010` consent-safe identity frame.
- `A-011` covered-media frame.

### Phase 4 — Editorial and process systems

- `A-012` background tier pack.
- `A-013` process icon extension.
- `A-014` process composition template.

### Phase 5 — Bespoke visualizations

- `A-015` Fake Resistance network.
- `A-016` Israel’s Story map/timeline.

### Phase 6 — Optional polish

- Validate `A-004` social/OG template.
- `A-017` Information War conceptual hero.

## 12. Completion Summary

- **Original G-ID count:** 29.
- **Final system count:** 7.
- **Final A-ID count:** 17.
- **Shared asset count:** 14.
- **Bespoke asset count:** 3.
- **UX-only requirement count:** 4 G-IDs require no unique graphic; 10 UX work items were extracted across mixed requirements.
- **G-IDs merged:** All 29 are mapped into 7 systems; no G-ID remains a standalone visual language.
- **G-IDs requiring no unique graphic:** `G-007`, `G-017`, `G-018`, `G-022`.
- **Priority changes:** 14 (`G-001`, `G-005`, `G-008`, `G-009`, `G-010`, `G-012`, `G-013`, `G-014`, `G-016`, `G-022`, `G-025`, `G-027`, `G-028`, `G-029`).

### Top 10 production assets

1. `A-005` — Utility and action icon set.
2. `A-007` — Evidence/provenance mark set.
3. `A-006` — Record and media type icon set.
4. `A-008` — Shared state frame.
5. `A-009` — State glyph set.
6. `A-001` — Canonical compact lion/crown vector master.
7. `A-010` — Consent-safe identity frame.
8. `A-011` — Covered-media frame.
9. `A-002` — Brand lockup export pack.
10. `A-003` — Hero lion responsive master/crops.

### Recommended first production phase

Begin with **Phase 0 functional definitions**, then produce **SYS-01 Brand foundations** and **SYS-02 Core Icon & Action System**. Do not start page-specific illustrations before the state, provenance, safe-media, and icon grammars are locked.

## Stop Condition

Graphics systems consolidation is complete. No graphic, SVG, bitmap, code, CSS, UI, route, or implementation was created or changed. Await review and approval before Graphics Production.

## Phase 0 Functional Verification

Phase 0 has now been implemented and verified before graphics production:

- `UX-003`: Search exposes `idle`, `invalid-query`, `loading`, `results`, `no-results`, `fallback`, and `error`; fallback is a successful lexical-only result state, not an empty or error state. Search requests are bounded and retryable.
- `UX-010`: October 7 media remains covered by default; media children are not mounted/requested until the reader chooses `Show this material`; reveal is reversible and does not persist. Covered/revealed and on-request/warning-acknowledged boundaries are explicit in the component contract.
- `UX-005`: Ask exposes `idle`, `ready`, `submitting`, `loading`, `success-with-sources`, `insufficient-evidence`, `no-answer`, and `error`; retry/edit remain available after failure; duplicate submissions are locked synchronously; the request is bounded.
- `UX-006`: Account checking is bounded to ten seconds and distinguishes checking, signed out, unavailable, and error with a retry path. No account-specific illustration was added.

Evidence and exact file/state mapping: `GRAPHICS-PHASE-0-FUNCTIONAL-REPORT.md`. Graphics `A-008`/`A-009` remain dependent on the shared state contract, but no graphics were produced in Phase 0.
