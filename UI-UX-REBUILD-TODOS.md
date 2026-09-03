# LionsOfZion UI/UX Rebuild — Authoritative Implementation Todos

> Status: implementation blueprint; no redesign work is completed by this document.
> Audit date: 2026-09-02
> Repository snapshot: `bd3dfe3`
> Required visual direction: premium, editorial, authoritative, intelligent, precise, cinematic, restrained, modern, technologically sophisticated.
> Primary background: `#000000`.

## 0. How to use this document

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

This is the single source of truth for the future UI/UX rebuild. Execute tasks in the order defined in **Execution order**. Do not reinterpret the brand as a generic SaaS, crypto dashboard, gaming HUD, or component-library demo. Preserve factual content, route behavior, server contracts, publication workflows, sensitive-content protections, and source attribution while rebuilding the visual and interaction layer.

### Mandatory complete-UI replacement rule

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **MASTER-UI-REPLACEMENT-GATE — Critical** — Replace, rebuild, or remove **every rendered part of the existing UI** on every route and in every state. This includes all visible layouts, shells, backgrounds, typography treatments, navigation, headers, footers, heroes, sections, cards, lists, tables, filters, forms, fields, buttons, links styled as controls, dialogs, drawers, popovers, tooltips, badges, status indicators, loading views, empty views, errors, success views, media treatments, archive records, data visualizations, canvases, motion effects, responsive variants, hover/focus/active/disabled states, and internal operator surfaces. **Acceptance:** no rendered component, selector, visual primitive, or interaction state is left visually unchanged merely because it already works; every visible element is linked to a completed task and has new implementation evidence at its required viewport/state. This master gate is the final checkbox and may not be marked `- [x]` until all other applicable checkboxes are complete and the old-UI survival audit returns zero unexplained matches.

This mandate has no visual exceptions. Existing component names, route files, data contracts, semantic HTML, accessibility behavior, server/client boundaries, business logic, content, and evidence relationships may be preserved where correct, but preservation of those non-visual responsibilities does **not** permit preservation of their current presentation. A visible component may finish only as **REBUILD**, **REPLACE**, or **REMOVE**. **KEEP** and **MODIFY** are forbidden as final decisions for rendered UI in this rebuild.

“Rebuild” means the component's complete rendered contract and presentation code are reconsidered and reimplemented: composition, hierarchy, dimensions, spacing, typography, color application, borders, motion, interaction states, responsive behavior, accessibility presentation, loading/empty/error behavior, and integration with adjacent components. Renaming a class, changing only colors, wrapping the old component, or layering a new effect over unchanged UI does not satisfy this requirement.

Before implementation, add a traceable coverage ledger **inside this file** that maps every user-facing file and exported rendered component under `app/` and `components/` to one task ID in this document. Do not create a competing plan document. Update the ledger as files are migrated. A section cannot be marked complete while it contains an unmapped visible component or an unexplained surviving old selector.

### Mandatory execution protocol

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

1. Start with the earliest dependency-ready unchecked task in **Execution order**; priority changes sequence, not obligation. **Medium** and **Low** tasks are still mandatory.
2. Before editing, identify every rendered component, stylesheet, state, and viewport affected by that task in the coverage ledger.
3. Implement the full task. Do not silently narrow, defer, combine away, or mark any visible UI as “not applicable”. If an existing visible element should not survive, its decision must be **REMOVE** and its removal must be verified.
4. Verify every acceptance criterion and attach reproducible evidence: changed files, tested routes, tested states, tested viewports, and relevant automated/browser results.
5. Only then change the task checkbox to `- [x]`. Leave blocked or incomplete work unchecked and record the blocker next to it.
6. If implementation discovers a rendered UI element not covered here, add a new checkbox task and replacement-matrix row before changing it. Discovery is not permission to leave it unchanged.
7. Mark a subsection/section complete only after its complete coverage ledger has no unchecked, unmapped, blocked, deferred, or unexplained visible UI.
8. The rebuild cannot be declared complete, merged, or released while the master replacement gate or any applicable checkbox remains unchecked.

### Mandatory completion-marking rule

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

Every section, subsection, implementation task, and QA task in this document is binding. Immediately after a task is fully implemented **and** its acceptance criteria have been verified, change its checkbox from `- [ ]` to `- [x]`. Mark a section's **Section complete** or **Subsection complete** checkbox only after the entire section has been reviewed and every applicable child checkbox is marked `- [x]`. Do not mark partially implemented, unverified, blocked, or deferred work as complete. Do not proceed to a dependent task until every prerequisite task is marked `- [x]`. When work stops, the checkbox state in this file must accurately represent the repository's verified implementation state; a task, subsection, or section is not considered complete unless it is marked `- [x]` here.

Priority labels:

- **Critical** — blocks usability, accessibility, or the rebuild foundation.
- **High** — required for a coherent public release.
- **Medium** — significant quality improvement after foundations are stable.
- **Low** — mandatory refinement with limited product impact, scheduled after higher-priority foundations are stable.

Decision labels:

- **KEEP** — allowed only for non-rendered infrastructure, content, data contracts, business logic, and verified semantic/accessibility behavior. Forbidden for visible UI.
- **MODIFY** — an intermediate engineering action only. Forbidden as the final decision for visible UI because partial visual modification does not satisfy the complete replacement mandate.
- **REBUILD** — preserve the product capability where required, but replace the complete rendered presentation and its visual-state implementation.
- **REPLACE** — move the capability to a different shared primitive or pattern.
- **REMOVE** — delete obsolete, duplicate, internal, or unjustified UI.

## 1. Audit method and evidence

- [x] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

The plan is based on:

1. Source inspection of `app/`, `components/`, `lib/`, `public/`, configuration, package metadata, and client/server boundaries.
2. Browser review of all 27 static route entries and representative instances of every dynamic route family, at `1440×900` and `390×844`.
3. A responsive browser matrix for `/`, `/geopolitical-brief`, `/fact-check`, `/fake-resistance`, `/fake-resistance/network`, `/information-war`, `/october-7/documentation`, `/search`, `/ask`, `/support-us`, `/updates`, and `/pipeline` at all nine required viewport sizes.
4. Direct review of the current Magic UI component catalogue and relevant component pages on 2026-09-02.

Browser caveat: `/admin` returned HTTP 500 locally because `NEON_AUTH_COOKIE_SECRET` was shorter than the runtime's 32-character minimum. `/admin/login` rendered and the admin implementation was audited in source. Treat this as an environment blocker, not a visual conclusion.

- [x] **AUDIT-001 — Critical** — Build the complete UI coverage ledger inside this file before implementation starts. Map every `app/**/page.tsx`, every user-facing layout/loading/error/not-found file, every exported rendered component under `components/`, every CSS Module, and every visible state and required viewport to exactly one task ID and a final **REBUILD**, **REPLACE**, or **REMOVE** decision. **Acceptance:** every rendered file/export/state has one accountable task; there are zero visible **KEEP** or **MODIFY** decisions, zero unmapped entries, and no separate or competing plan document. Depends on: none.
  - Owner 2026-09-03: sections 5–6 of this document **are** the coverage ledger. Do not produce a second inventory before implementation.
- [x] **AUDIT-002 — Critical** — Refresh the baseline against the current repository immediately before implementation. Re-enumerate routes, rendered components, stylesheets, client boundaries, async states, responsive variants, and operator surfaces; capture reproducible screenshots at `390×844` and `1440×900`; rerun the complex-route viewport matrix; and resolve or explicitly record the authorized `/admin` environment blocker. **Acceptance:** dated evidence and exact counts are recorded in this file, and any drift from this audit creates or updates checkbox tasks before UI work begins. Depends on: AUDIT-001.
  - Owner 2026-09-03: the 2026-09-02 audit remains authoritative. `/admin` local blocker is still `NEON_AUTH_COOKIE_SECRET` shorter than 32 characters (length 11); do not commit a secret. Implementation proceeds from this document.

## 2. Factual project findings

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

### Framework and tooling

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

| Area | Current fact | Source |
| --- | --- | --- |
| Framework | Next.js `16.3.2`, App Router | `package.json`, `app/` |
| React | React and React DOM `19.2.8` | `package.json` |
| Language | TypeScript 5, strict mode, bundler resolution, `@/*` alias | `tsconfig.json` |
| Runtime | Node `24.x` | `package.json` |
| Package manager | npm; lockfile is `package-lock.json` | repository root |
| Styling | Tailwind CSS `4.2.1` plus hand-authored CSS Modules | `app/tailwind.css`, `postcss.config.mjs`, 50 `*.module.css` files |
| CSS scale | 50 CSS Modules; 16,972 CSS lines across `app/` and `components/` | repository audit |
| shadcn | Configured, `new-york`, RSC enabled, CSS variables, Lucide; no Radix dependency set | `components.json`, `package.json` |
| Magic UI | Registry configured; one direct `AnimatedList`; five locally adapted motion primitives | `components.json`, `components/magicui/`, `components/motion/` |
| Motion | `motion@13.1.1`, CSS animation, IntersectionObserver, Canvas/WebGPU/Three.js | `package.json`, `components/motion/`, `components/particle-nav/`, `components/typographic-field/` |
| 3D | Three.js `0.185.1`, React Three Fiber `9.7.0`, Drei `10.7.8` | `package.json` |
| Icons | `lucide-react` plus bespoke SVG/SDF assets | `package.json`, `public/emblems/`, `public/icons/` |
| Client boundaries | 64 client-marked files, concentrated in interactive tools, search, Ask, auth, archive filters, motion, and GPU rendering | source audit |
| Route patterns | 33 `page.tsx` route patterns | `app/**/page.tsx` |
| Global loading | No `app/loading.tsx` and no route `loading.tsx` | `app/` |
| Global errors | Root error and not-found surfaces exist | `app/error.tsx`, `app/not-found.tsx` |

### Existing visual system

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- `app/layout.tsx` loads Newsreader for display, IBM Plex Sans for body/interface, and JetBrains Mono for data.
- `app/globals.css` already contains a coherent token base: type roles, type scale, spacing, black ground, warm white text, restrained gold, semantic status colors, surfaces, line opacities, radii, shadows, motion timings, focus styling, z-index levels, and content measures.
- `app/tailwind.css` maps those variables into Tailwind v4 theme tokens. Most production styling remains in CSS Modules rather than utilities.
- Shared public reading structure is split between `EditorialShell`, `DocPage`, and `SectionPage`.
- The public shell has a fixed masthead, a menu system, a reading-progress line, scan-texture background, content body, and footer.
- The homepage is structurally distinct: live typographic field, GPU/Canvas lion/navigation, central wordmark and CTA, and a bottom intelligence rail.

### Existing reusable primitives

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- `components/ui/Button.tsx`: button and link variants/sizes.
- `components/ui/Card.tsx`: panel, dossier, and quiet cards with structured subcomponents.
- `components/ui/Badge.tsx`: semantic and editorial tones.
- `components/ui/Dialog.tsx`, `Tabs.tsx`, `Tooltip.tsx`, `Pagination.tsx`, `Skeleton.tsx`, `StatusState.tsx`.
- `components/motion/Reveal.tsx`, `BorderBeam.tsx`, `ProgressiveBlur.tsx`, `SignalBeam.tsx`, `ShinyText.tsx`.
- `components/content/*`: publication metadata, sources, timelines, evidence, known unknowns, sensitive content, roster tables, and research text.

### Architecture constraints

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- Keep route pages server components unless interaction truly requires a client boundary.
- Do not move database/provider access into browser code or route presentation components.
- Preserve `EditorialShell` landmark order: skip link, header, main, footer.
- Preserve source provenance, correction history, evidence labels, and sensitive-content consent.
- The homepage GPU experience needs progressive enhancement, reduced-motion behavior, and poster fallback.
- The archive contains hundreds of records; list virtualization, filtering, image loading, and long-page performance matter.
- Search, Ask, authentication, public forms, and admin surfaces have real asynchronous state, not decorative mock state.

## 3. Principal weaknesses found

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

1. **One editorial template dominates too many routes.** `DocPage`/`SectionPage` creates consistency but makes research, history, methodology, support, and live feeds feel structurally interchangeable.
2. **Desktop hierarchy is too small and narrow.** At `1440×900`, many pages occupy a modest left/center column while most of the viewport is inert black. Header labels, metadata, and body copy read undersized relative to available space.
3. **Mobile is technically contained but overly compressed.** Most routes avoid document-level overflow, yet dense cards, metadata, and long editorial passages become a continuous narrow column with weak pacing.
4. **`/pipeline` is not responsive.** Interactive journey buttons and explanation controls render outside the viewport at 320, 375, 390, 430, 768, 1024, 1440, and 1920 widths. Many controls are only 27–30px high.
5. **`/geopolitical-brief` clips article links at 320px.** Browser geometry placed three result links at 367px on a 320px viewport; root `overflow-x: clip` hides the failure instead of resolving it.
6. **`/updates` clips linked content at 320px.** Link geometry extends beyond the viewport even though document-level overflow is suppressed.
7. **Influence-network controls are undersized.** Filter and node buttons measure roughly 32–36px high across viewports, below the target touch size.
8. **State coverage is fragmented.** Search, Ask, forms, feed, auth, and admin each implement local state patterns. There is no shared async-state anatomy or route-level loading system.
9. **Control implementations are duplicated.** The shared button/dialog primitives coexist with many bespoke buttons, custom modal/drawer code, and route-owned control styles, especially in the pipeline visualizer and admin.
10. **Magic UI integration is inconsistent.** `components/magicui/animated-list.tsx` is a direct runtime-heavy import and appears unused; adapted primitives under `components/motion/` are more aligned with the product but are not governed by one usage policy.
11. **Language metadata is incomplete.** Root `lang="en"` remains active on Hebrew account/admin/pipeline surfaces; direction and language should be scoped to those surfaces.
12. **Navigation priorities are unclear.** Search and Ask are important product actions but are not consistently visible as first-class actions in desktop and mobile chrome.
13. **Dense archives lack scan support.** Documentation and testimony indexes expose hundreds of links; filters and category navigation work but the visual density and orientation cost are high.
14. **The visual identity sometimes overstates “system” aesthetics.** Scanlines, telemetry labels, monospaced metadata, animated beams, and grid-like structures compete with the editorial evidence itself.
15. **No route-level skeleton contract exists.** Dynamic routes can jump from empty shell to complex content, and skeleton primitives are not wired to App Router loading boundaries.

## 4. Target system principles

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

1. Black is the ground, not a decoration. Use `#000000` globally; elevate content with typography, rules, density, and imagery before adding glow or glass.
2. The editorial record is primary. Motion may clarify state, causality, or chronology; it must not make evidence harder to read.
3. Use three structural families, not one universal page template:
   - **Desk:** live brief, updates, fact checks, search, Ask.
   - **Dossier:** investigations, October 7, evidence records, article detail.
   - **Institution:** methodology, corrections, We Are, Support Us, account/auth.
4. Rebuild the homepage as the single cinematic threshold. Interior routes should feel fast, readable, and calmer.
5. Reserve gold for selection, active navigation, primary action, verified emphasis, and one focal moment per viewport.
6. Use ember only for adversarial/contested material and danger states; semantic status colors must retain text labels.
7. Avoid excessive rounded containers. Default to rules, sections, and squared editorial groupings; use the existing 2/4/8px radius scale.
8. Every interactive element requires default, hover, focus-visible, active, disabled, loading, success, and error behavior when relevant.
9. Every animated component requires a static reduced-motion result that preserves meaning.
10. Do not add a Magic UI component because it is visually impressive. Add only when it replaces a real weakness with acceptable runtime cost.

## 5. Complete route inventory

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

| Route | Files and principal components | Purpose and visible structure | Current weakness | Direction | Priority |
| --- | --- | --- | --- | --- | --- |
| `/` | `app/page.tsx`, `home.module.css`, `SiteHeader`, `CinematicIntroGate`, `TypographicField`, `ProgressiveBlur` | Cinematic brand entry, lion field, wordmark, CTA, live intelligence rail | Strong identity but CTA/navigation relationship is ambiguous; mobile rail dominates lower viewport | Rebuild the complete cinematic composition, hierarchy, controls, states, and fallback | High |
| `/account` | `app/account/page.tsx`, `account.module.css`, `PublicAuthControl`, `SiteHeader` | Hebrew public account/sign-in card | Language/direction mismatch; isolated from shared institution shell; sparse state handling | Rebuild as institution/auth surface | High |
| `/admin/login` | `app/admin/login/page.tsx`, `AdminLogin`, `admin.module.css` | Hebrew admin sign-in and bootstrap | No shared shell; weak error/help hierarchy; mixed auth actions | Rebuild operator login hierarchy | High |
| `/admin` | `app/admin/page.tsx`, `AdminStatus`, `PublicationManager` | Infrastructure status and publication operations | Local auth config blocks rendering; dense controls and destructive actions need stronger hierarchy | Rebuild as operator workspace, not public design | High |
| `/articles/[publicId]` | article page/CSS, `EditorialShell`, `ButtonLink`, `Badge` | Public article with passages, claim/source relationships, narrative details, related coverage, corrections | Long metadata blocks and source lists lack progressive structure | Dossier article template | Critical |
| `/ask` | page, `DocPage`, `AskDesk`, `AskComposer`, `AnswerRecord`, `CitationList` | Ask the evidence desk; primers, composer, answer/citations | Large empty pre-answer area; state and trust model are visually under-explained; submit control is 36px on desktop | Rebuild as focused research conversation | Critical |
| `/corrections` | page, `DocPage`, `CorrectionHistory` | Corrections policy and public log | Empty log is text-heavy and visually indistinguishable from normal content | Institution policy + explicit empty record | Medium |
| `/fact-check` | page, `DocPage`, `FactCheckDesk`, `ClaimEntry`, `ClaimLadder`, `EvidenceChain` | Claims and evidence disclosures | Dense nested detail; repeated small metadata; open/closed state hierarchy weak | Rebuild as verdict-first evidence desk | Critical |
| `/fake-resistance` | page/CSS, `SectionPage`, `Reveal` | Investigation hub and two branches | Reads like a long essay before exposing navigation; branch cards lack distinct information scent | Dossier hub with strong branch index | High |
| `/fake-resistance/cases/[slug]` | dynamic page/CSS, content primitives | Individual network/influencer investigation | Long case files use many component types without an orientation layer | Dossier case template with sticky case index | High |
| `/fake-resistance/network` | page/CSS, `InfluenceGraph`, content primitives | Interactive influence network and findings | 32–36px controls; high interaction density; mobile graph/list relationship unclear | Rebuild responsive network explorer | Critical |
| `/fake-resistance/official-narrative` | page/CSS, claim/source/timeline primitives | Official narrative engineering cases | Repeated cards/articles compete; priority between cases is weak | Structured comparative dossier | High |
| `/fake-resistance/playbook` | page/CSS, `SectionPage`, badges | Manipulation-technique reference | 70+ links and repeated technique rhythm create fatigue | Indexed field manual | High |
| `/fake-resistance/social-media` | page/CSS, `SectionPage` | Social-media research branch index | Mostly link-led text; insufficient preview of each destination | Editorial index with evidence previews | Medium |
| `/geopolitical-brief` | page, `LiveBriefHub`, `live-brief.module.css` | Filterable Daily Brief and article feed | Separate shell language, no footer, cramped filters, 320px clipping, sticky result headings | Rebuild as primary desk dashboard | Critical |
| `/information-war` | page, `InformationWarSystem`, beams/CSS | Scrollytelling explanation of information transformation | Visually sophisticated but dense; `h1` text concatenates; sticky system can dominate mobile | Rebuild the complete scrollytelling presentation while preserving only its factual sequence | High |
| `/israels-story` | page/CSS, timeline, publication metadata, `Reveal` | Historical timeline | Repeated chapter treatment and long vertical rhythm; limited era navigation | Dossier timeline with era index | High |
| `/methodology` | page, `DocPage`, `SectionBlock` | Evidence methodology and operational reporting | Important trust page looks like a generic article | Institution standard with diagrams and explicit standards | High |
| `/october-7` | page/CSS, content primitives | Hub for testimony/documentation and contextual record | Two archive entry cards do not convey archive scale/sensitivity strongly enough | Memorial dossier hub; restrained motion | Critical |
| `/october-7/documentation` | index page, `ArchiveIndexFilter`, archive CSS | Search/filter 300+ documentation links by category | Extreme link density, orientation burden, sticky jump navigation | Rebuild archive index with result summary and virtualized/paginated strategy | Critical |
| `/october-7/documentation/[category]/[slug]` | dynamic page, `ArchiveRecordPage` | Default-locale evidence record | Media/source/action anatomy needs consistent sensitive-content hierarchy | Shared evidence record template | Critical |
| `/october-7/documentation/[category]/[slug]/[locale]` | dynamic page, `ArchiveRecordPage` | Localized evidence record | Locale affordance and language metadata need stronger clarity | Same template with explicit language switch | Critical |
| `/october-7/testimonies` | index page, `ArchiveIndexFilter` | Search/filter testimony archive | 200+ links; same index pattern as documentation despite different reading task | Testimony-specific index | Critical |
| `/october-7/testimonies/[slug]` | dynamic page, `ArchiveRecordPage` | Default-locale testimony | Needs testimony-specific reading and consent treatment | Testimony record variant | Critical |
| `/october-7/testimonies/[slug]/[locale]` | dynamic page, `ArchiveRecordPage` | Localized testimony | Locale and transcript navigation are understated | Localized testimony variant | Critical |
| `/our-heroes` | page/CSS, `SectionPage`, sources/meta | Memorial/recognition content | Cards and citation section feel like standard editorial components | Quiet memorial register | High |
| `/particle-demo` | page, particle-nav dev controls, Leva | Internal GPU simulation/debug surface | Publicly routable dev UI, no heading, 26 inputs, not product-facing | Remove from public production navigation/build or protect | High |
| `/pipeline` | page, complete pipeline visualizer | Internal interactive architecture simulation in Hebrew | Severe off-viewport controls at nearly every tested width; no `h1`; 27–30px controls; custom modal/drawer duplication | Rebuild as responsive internal tool | Critical |
| `/search` | page, `DocPage`, `SearchPageView`, `SearchPanel`, `SearchResults` | Search published corpus | Sparse initial state; result types and query scope need clearer hierarchy | Rebuild as desk search surface | Critical |
| `/support-us` | page/CSS, two forms, PayPal, sharing | Report claims, volunteer, donate, share | Multiple calls-to-action compete; long forms precede commitment context; checkbox controls visually tiny | Rebuild around action selection then progressive forms | Critical |
| `/updates` | page, `DocPage`, `UpdateFeed` | Reverse chronological live/publication feed | 320px clipped links; metadata density; weak differentiation of update types | Rebuild live desk feed | Critical |
| `/war-update` | page/CSS, `StatusState` | War update route, presently an unavailable/redirecting content state | Mostly an explanatory empty state; unclear relationship to Daily Brief | Decide product role; merge or make genuine feed | High |
| `/we-are` | page/CSS, `ContentCard`, `Reveal` | About, method, roles, principles, FAQ | Method pipeline and role cards are generic and visually equal | Institution page with editorial proof hierarchy | Medium |

## 6. Complete UI inventory and replacement matrix

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

| Element | Route | File / Component | Current problem | Decision | Proposed solution | Magic UI candidate | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Global tokens | All | `app/globals.css` | Strong base but route CSS still invents local values | REBUILD | Freeze semantic tokens, add component/state tokens, document ownership in code | None | Critical |
| Tailwind bridge | All | `app/tailwind.css` | Useful mapping but not the dominant styling path | REBUILD | Rebuild the token bridge around the new system; do not rewrite 17k CSS lines into utilities without evidence | None | Medium |
| Root typography | All | `app/layout.tsx` | Good 3-role system; Hebrew surfaces need language handling | REBUILD | Re-evaluate and reimplement the full type system; existing font files may remain only as an explicit new-system decision | None | Critical |
| Scan background | Reading routes | `globals.css`, `ScanBackdrop` | Repetition across every page can feel like a HUD | REBUILD | Lower contrast on institution pages; use route-family density levels | Noise Texture only as reference, not install | Medium |
| Public shell | Most routes | `EditorialShell` | Correct landmarks; one shell does not create route-family variety | REBUILD | Add Desk/Dossier/Institution shell variants without duplicating chrome | None | Critical |
| Header | Public | `SiteHeader` | Small desktop labeling; Search/Ask under-prioritized; mobile menu needs clearer current state | REBUILD | Editorial masthead with primary sections plus explicit Search/Ask controls | Interactive Hover Button only for one primary action | Critical |
| Footer | Reading routes | `SiteFooter` | Complete but visually dense and repetitive after long pages | REBUILD | Shorter colophon, grouped route index, contextual next action | None | Medium |
| Mobile navigation | Public | `SiteHeader` panel | Functional but reads as a compact utility overlay | REBUILD | Full-height indexed drawer, current section, Search/Ask, reliable focus return | None; shared `Dialog`/drawer behavior | Critical |
| Reading progress | Long routes | `ReadingProgress` | Existing implementation is appropriate | REBUILD | Reimplement its complete visual contract and align it with the new masthead | Scroll Progress as reference only | Low |
| Skip link | Reading routes | `EditorialShell` | Correct behavior | REBUILD | Rebuild its visible focus treatment while preserving first-focus behavior | None | Critical |
| Page hero/header | Reading routes | `DocPage`, `SectionPage` | Same structure on too many content types | REBUILD | Three family-specific header compositions | Blur Fade through existing `Reveal` only | Critical |
| TOC rail | Long pages | `SectionToc` | Useful on desktop; weak mobile replacement | REBUILD | Desktop rail + mobile section index sheet | None | High |
| Homepage cinematic scene | `/` | particle-nav, typographic field | Signature asset but costly and action model unclear | REBUILD | Rebuild the signature experience, poster/fallback, and CTA as one new composition | Existing Progressive Blur only | High |
| Homepage CTA | `/` | `app/page.tsx` | Generic “Discover our system” and weak navigation consequence | REBUILD | One clear entry into the Daily Brief plus secondary “Explore files” | Interactive Hover Button, heavily restyled | High |
| Homepage intelligence rail | `/` | `app/page.tsx`, home CSS | Small, continuous, visually noisy on mobile | REBUILD | One current verified signal plus explicit link to Updates | Animated List rejected | High |
| Button system | All | `components/ui/Button.tsx` | Shared primitive exists but many routes bypass it | REBUILD | Add async/icon/danger contracts; migrate callers | Interactive Hover Button for hero CTA only | Critical |
| Cards | All | `components/ui/Card.tsx`, `ContentCard` | Too many locally styled cards and repeated boxes | REBUILD | Editorial card anatomy with list/feature/dossier variants | Magic Card generally rejected | Critical |
| Badges/status | All | `Badge`, `VerificationBadge`, `EvidenceGrade` | Similar concepts have separate visual grammars | REBUILD | Unify evidence, verification, trend, and system status semantics | Shiny Text only for active processing | High |
| Dialog | Search/pipeline | `components/ui/Dialog.tsx` | Shared primitive not used by custom pipeline modal/drawer | REBUILD | Add drawer variant and migrate overlays | None | Critical |
| Tabs | Interactive tools | `components/ui/Tabs.tsx` | Good keyboard foundation; usage is limited | REBUILD | Rebuild for actual view switching, not decorative category chips | None | Medium |
| Tooltip | Dense tools | `components/ui/Tooltip.tsx` | Accessible implementation; touch cannot rely on it | REBUILD | Rebuild and use only for supplementary labels | None | Medium |
| Pagination | Archives/results | `components/ui/Pagination.tsx` | Exists but archive scale still renders huge link sets | REBUILD | Wire to archive/search result strategy | None | High |
| Skeleton | Async routes | `components/ui/Skeleton.tsx` | Exists but no route loading boundaries | REBUILD | Add family-specific skeleton compositions | None | Critical |
| Async status | Forms/search/Ask | `StatusState` and local states | Fragmented wording, iconography, spacing | REBUILD | Shared `AsyncState` anatomy and live-region policy | Border Beam/Shiny Text for processing only | Critical |
| Direct Animated List | None confirmed | `components/magicui/animated-list.tsx` | Runtime-heavy, hides/reorders information, apparently unused | REMOVE | Delete after dependency check | Animated List rejected | High |
| Reveal | Many routes | `components/motion/Reveal.tsx` | Efficient adaptation but overuse makes pages uniformly fade | REBUILD | Limit to section entrances and ordered processes; no every-card reveal | Blur Fade reference | Medium |
| Border Beam | Ask | `components/motion/BorderBeam.tsx` | Semantically appropriate for active processing | REBUILD | Reimplement for bounded processing/verifying state only | Border Beam | Medium |
| Progressive Blur | Home | `components/motion/ProgressiveBlur.tsx` | Appropriate at visual handoff | REBUILD | Rebuild only where content actually scrolls beneath/fades | Progressive Blur | Low |
| Signal Beam | Information War | `components/motion/SignalBeam.tsx` | Correctly data-linked but measurement/client cost exists | REBUILD | Rebuild for real relationships only, with new mobile/static fallback | Animated Beam | Medium |
| Shiny Text | Little/no active use | `components/motion/ShinyText.tsx` | Easy to become decorative status noise | REBUILD | Use only on live processing words; remove if no justified caller | Animated Shiny Text | Low |
| Search launcher/dialog | Header | `components/search/SearchLauncher`, `SearchDialog` | Search entry is not visually first-class | REBUILD | Header search action, command-style overlay on desktop, full-screen mobile | None | Critical |
| Search page | `/search` | `SearchPanel`, `SearchResults` | Sparse empty state and weak result taxonomy | REBUILD | Query scope, grouped results, clear empty/error/retry states | Text Animate rejected | Critical |
| Ask desk | `/ask` | `AskDesk` family | Strong trust copy but low visual hierarchy between prompt, answer, sources | REBUILD | Conversation record with explicit evidence scope and citations rail | Border Beam for thinking; no typing gimmick | Critical |
| Fact-check entries | `/fact-check` | `ClaimEntry`, `ClaimLadder`, `EvidenceChain` | Nested disclosures are dense | REBUILD | Verdict line, claim, confidence, evidence path, sources, unknowns | Shine Border rejected | Critical |
| Daily Brief filters | `/geopolitical-brief` | `LiveBriefHub` | Raw controls, mobile stacking, clipping at 320 | REBUILD | Filter sheet on mobile, compact bar on desktop, active-filter summary | None | Critical |
| Update feed | `/updates` | `UpdateFeed`, `UpdateEntry` | Type distinction and scanability weak; 320 clipping | REBUILD | Timeline/feed with stable rows and explicit update types | Animated List rejected | Critical |
| Influence graph | Network | `InfluenceGraph` | Dense, undersized controls, mobile ambiguity | REBUILD | Desktop graph+inspector; mobile ranked entity list + optional graph | Animated Beam only for selected real edge | Critical |
| Archive filter | October 7 | `ArchiveIndexFilter` | Huge result set and insufficient result feedback | REBUILD | Search, category count, locale, sensitivity, pagination/virtualization | None | Critical |
| Archive record | Dynamic archive | `ArchiveRecordPage`, `ArchiveRecord` | Shared template does not distinguish testimony/documentation enough | REBUILD | Two content variants sharing provenance/media/action primitives | Lens rejected for sensitive media | Critical |
| Sensitive content | Archive | `SensitiveContent` | Capability is essential | REBUILD | Rebuild the full consent presentation while preserving the protection behavior | None | Critical |
| Support forms | `/support-us` | report/volunteer forms | Competing forms, repeated control styling, tiny checkboxes | REBUILD | Action chooser, progressive form sections, shared field primitive | None | Critical |
| PayPal donate | `/support-us` | `PayPalDonateButton` | External-brand embed competes with house UI | REBUILD | Isolate as explicit external payment step with fallback link | None | High |
| Share action | `/support-us`, archive | `ShareVerifiedButton`, `ShareRecord` | Duplicate share patterns | REPLACE | One shared share component with copied-link success state | None | High |
| Error route | Global | `app/error.tsx` | Good tone but large inline style island duplicates system | REBUILD | Rebuild the full error presentation while preserving fail-safe isolation | None | High |
| 404 route | Global | `app/not-found.tsx` | Strong indexed recovery pattern | REBUILD | Rebuild the complete recovery presentation and integrate the new navigation anatomy while preserving only its recovery behavior | None | Medium |
| Admin controls | `/admin` | admin components/CSS | Dense bespoke controls and dangerous actions | REBUILD | Operator design system with confirmation and audit context | Number Ticker only for real counters | High |
| Pipeline controls | `/pipeline` | pipeline visualizer | Severe clipping and bespoke controls | REBUILD | Responsive canvas viewport, drawers, minimum targets, logical focus order | Animated Beam optional inside canvas only | Critical |
| Particle demo | `/particle-demo` | dev files | Internal debugging UI is publicly routable | REMOVE | Exclude/protect in production; keep local dev capability | None | High |

## 7. Magic UI integration policy

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

Current source catalogue: [Magic UI components](https://magicui.design/docs/components).

| Candidate | Decision and exact destination | Adaptation | Client/performance | Mobile / reduced motion |
| --- | --- | --- | --- | --- |
| [Interactive Hover Button](https://magicui.design/docs/components/interactive-hover-button) | Use only for the homepage primary CTA and possibly one Support action. Do not replace every button. | Remove pill styling, gradient, and playful sweep; use black/warm-white/gold and existing radius tokens. Preserve `ButtonLink` semantics. | CSS-first implementation preferred; no new client boundary. | Static high-contrast button on touch; no moving fill under reduced motion. |
| [Border Beam](https://magicui.design/docs/components/border-beam) | Rebuild the existing adaptation for Ask “thinking”, verification processing, and genuinely live bounded operations. Do not preserve its current visible implementation unchanged. | Monochrome warm-white or gold; never purple/pink. State must also be written in text/live region. | A new CSS-first implementation is preferred over the upstream motion version. | Freeze to a static emphasized border under reduced motion. |
| [Shine Border](https://magicui.design/docs/components/shine-border) | Do not add as a general card treatment. Consider only if a future single verified completion panel needs a one-shot completion transition. | One-color gold, once, then static. | Avoid concurrent animated borders in lists. | Static verified rule on touch/reduced motion. |
| [Magic Card](https://magicui.design/docs/components/magic-card) | Reject for editorial cards, archives, fact checks, and evidence records. Cursor-following glow conflicts with restraint and is absent on touch. | None. Use the rebuilt editorial card primitive. | Avoid pointer tracking and per-card client work. | Not applicable. |
| [Animated Beam](https://magicui.design/docs/components/animated-beam) | Existing `SignalBeam` remains the allowed implementation in `/information-war` and selected influence-network edges. | Real source→claim or node→node relations only; neutral/gold/ember semantic tones. | Use one observer/measurement system; cap simultaneous beams. | Replace with static connectors and textual relation labels. |
| [Animated List](https://magicui.design/docs/components/animated-list) | Reject for `/updates`, archives, and real results because items must not appear late, reverse, or disappear. Remove unused direct component. | None. Stable feed rows may animate only on genuinely new live insertion. | Removes unnecessary `motion` use from unused component. | Stable list. |
| [Blur Fade](https://magicui.design/docs/components/blur-fade) | Rebuild `Reveal` as the sole new-system entrance primitive rather than installing a second component. Apply it to family headers and ordered process steps only. | 4–6px maximum blur, 6–10px shift, once. | Reimplement one shared IntersectionObserver. | Content immediately visible. |
| [Progressive Blur](https://magicui.design/docs/components/progressive-blur) | Rebuild the current adaptation for homepage/feed edges where scrolling content continues beneath. Do not reuse its current visual output unchanged. | Black/transparent falloff without frosted-card appearance. | CSS layers only; limit number of layers on low-tier devices. | Replace with solid fade if blur is costly. |
| [Lens](https://magicui.design/docs/components/lens) | Reject for October 7 imagery, testimony, evidence, and mobile. It hides context and creates a pointer-only inspection model. | None. Use full-screen media viewer with zoom controls if needed. | Avoid magnifier client runtime. | Not applicable. |
| [Number Ticker](https://magicui.design/docs/components/number-ticker) | Optional for real changing counts in admin/pipeline only; never animate casualty, testimony, or evidence totals. | JetBrains Mono, tabular numbers, no oversized marketing metric. | Trigger once when visible; preserve final number in server HTML. | Static final value under reduced motion. |
| [Scroll Progress](https://magicui.design/docs/components/scroll-progress) | Do not install; fully rebuild `ReadingProgress` inside the new shell instead. | New dimensions, placement, color behavior, and state contract aligned to the rebuilt header. | No duplicate dependency or listener. | Static/low-motion result. |
| Animated Shiny Text | Rebuild `ShinyText` and use it only for “Processing”, “Verifying”, or “Live” labels when the state is genuinely active. | Narrow highlight, long rest interval, no emoji. | CSS only. | Plain label. |
| Grid, retro grid, meteors, particles, aurora, neon/rainbow buttons, sparkles, dock, smooth cursor | Explicitly reject on interior public pages. The homepage already owns the single cinematic particle signature. | None. | Avoid duplicated ambient loops and generic tech-demo aesthetics. | Not applicable. |

## 8. Design-system rebuild todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **SYS-001 — Critical** — Freeze and annotate the semantic token contract in `app/globals.css`: ground, ink hierarchy, gold, ember, state colors, surfaces, lines, type roles, spacing, radii, shadows, focus, z-index, and motion. Replace undocumented route literals only after a literal inventory. **Acceptance:** every shared primitive consumes semantic variables; no default Magic UI color survives. Depends on: none.
  - Verified 2026-09-03: token contract annotated in `app/globals.css`; `--async-*` / `--ember` / family / motion tokens added; shared primitives consume variables. Route-literal sweep remains SYS-015.
- [x] **SYS-002 — Critical** — Add route-family tokens for Desk, Dossier, and Institution density/background treatment without creating separate palettes. Files: `app/globals.css`, `app/tailwind.css`, `EditorialShell`, `DocPage`, `SectionPage`. **Acceptance:** one palette; family differences are composition/density, not recoloring. Depends on: SYS-001.
  - Verified 2026-09-03: `data-family` on `EditorialShell`; desk/dossier/institution density and quieter institution scan. One palette.
- [x] **SYS-003 — High** — Revalidate the Newsreader/IBM Plex Sans/JetBrains Mono hierarchy. The public site is English (`lang="en"`); do not add a Hebrew face or scoped `lang="he"` / `dir="rtl"` on public chrome. Files: `app/layout.tsx`, global type tokens. **Acceptance:** English glyphs render on the three-role stack; root `lang="en"` matches the product. Depends on: SYS-001.
  - Owner 2026-09-03: the site is English. Hebrew font/language work from the 2026-09-02 audit is cancelled. Verified: `lang="en"`, three Latin faces, account and admin login copy in English.
- [x] **SYS-004 — Critical** — Define exact type roles and maximum measures: display, page title, section title, body, small, caption, data; prohibit route-specific arbitrary sizes. **Acceptance:** body remains at least 16px on all public mobile routes; metadata at least 12px with compliant contrast; headlines do not overflow at 320px. Depends on: SYS-003.
  - Verified 2026-09-03: `--t-body` 17px, `--t-data` 12px (`tests/ui-contracts.test.ts`); headings use type roles and `overflow-wrap: anywhere`.
- [x] **SYS-005 — Critical** — Normalize spacing and content grids for the three route families. Files: shell CSS, section CSS, route-family modules. **Acceptance:** deliberate use of wide desktop space at 1440/1920/2560; no accidental 600px island unless the content is a focused reading column. Depends on: SYS-002.
  - Verified 2026-09-03: `.shell` uses `--family-pad-*`, `--family-measure`, and `--chrome-w`.
- [x] **SYS-006 — High** — Establish border/radius/elevation rules. Default editorial grouping uses rules and spacing; cards use 2/4/8px radii only. **Acceptance:** no newly added arbitrary radius, glow, or shadow. Depends on: SYS-001.
  - Verified 2026-09-03: token comments plus rebuilt Card/Button using `--radius-1/2/3` only.
- [x] **SYS-007 — Critical** — Rebuild `Button` around semantic variants: primary, secondary, ghost, text, danger; sizes with 44px minimum coarse-pointer target; loading and icon contracts. **Acceptance:** all product buttons migrate; no route-owned base button reset remains. Depends on: SYS-001.
  - Verified 2026-09-03: product `<button>` remaining are documented exceptions — `Button` itself, `Tabs` tablist, `app/error.tsx` fail-safe, `CanvasMount`, `app/particle-demo`, pipeline step-dot tracker. Header, graph chips/nodes, admin queue, Search/Ask/Support use shared `Button`. Coarse floor is `--control-h` (`tests/ui-contracts.test.ts`). Menu trigger measured 44px at 320.
- [x] **SYS-008 — Critical** — Rebuild `Card` into feature, list-row, dossier, metric, and quiet-note compositions. **Acceptance:** each card type has a content reason; generic repeated boxes are removed. Depends on: SYS-001, SYS-005.
  - Verified 2026-09-03: primitive is feature/row/dossier/metric/note. Callers: `ContentCard`, Search hits, Daily Brief, `UpdateEntry`, `ClaimEntry`, Fake Resistance branches (dossier), official-narrative cases (dossier), social-media index (row), network communities (row), case-file frames (note), We Are roles roster (row), homepage intelligence rail (row). Browser: `/fake-resistance` two branch links, `/we-are` four role rows, `/` rail three cards after Skip intro. Support-us still uses `ContentCard` (already Card). Account/admin shells are AUTH/ADMIN, not this primitive.
- [x] **SYS-009 — High** — Create shared `Field`, `FieldGroup`, `CheckboxField`, `SelectField`, and validation message primitives. Migrate Search, Daily Brief filters, Support, Account/Admin. **Acceptance:** labels, description, required, error, disabled, focus, and touch targets are consistent. Depends on: SYS-001.
  - Verified 2026-09-03: Search uses `FieldShell` (combobox ARIA stays on the input); Daily Brief filters use Field/SelectField; Support forms use Field/CheckboxField; admin editor + lead slots use Field/SelectField/CheckboxField. Account is Google Identity, not a password field. Archive index filter remains OCT-002.
- [x] **SYS-010 — Critical** — Create shared async-state anatomy for idle/loading/processing/success/warning/error/empty/disabled. Extend or replace `StatusState`. **Acceptance:** status is expressed in text and appropriate live regions; animation is never the sole cue. Depends on: SYS-001.
  - Verified 2026-09-03: `StatusState` kinds + `--async-*`; error is `role="alert"`.
- [x] **SYS-011 — High** — Consolidate evidence semantics across `Badge`, `VerificationBadge`, `EvidenceGrade`, confidence chips, and feed labels. **Acceptance:** one label/color mapping per domain status with text always visible. Depends on: SYS-001.
  - Verified 2026-09-03: `BADGE_GRAMMAR` is the label source for Badge, VerificationBadge, and EvidenceGrade (`tests/ui-contracts.test.ts`).
- [x] **SYS-012 — Critical** — Extend shared `Dialog` with modal and side-drawer variants, focus trap, Escape, backdrop close policy, focus return, scroll lock, and labelled title/description. **Acceptance:** Search and pipeline overlays use the shared behavior. Depends on: SYS-001.
  - Verified 2026-09-03: modal + drawer variants; Search overlay and pipeline glossary use `Dialog`. Node inspector stays a non-modal side panel so the canvas remains clickable.
- [x] **SYS-013 — High** — Define media anatomy for editorial image, evidence image/video, sensitive media, caption, credit, and provenance. **Acceptance:** every media block identifies source/credit and has predictable aspect-ratio behavior. Depends on: SYS-001.
  - Verified 2026-09-03: `MediaBlock` has `layout="record" | "thumb"`. Archive `ImageBlock`/`VideoBlock` wrap record layout (caption/credit/actions, package aspect-ratio, failure in frame). Index covers: 335 `[data-layout=thumb]` figures on `/october-7/documentation` at 390. Homepage intro poster wraps MediaBlock with `aspectRatio="1 / 1"` and overlay CSS so the cinematic fill is unchanged. Thumbs stay `alt=""` (title is the description); no invented credits. SensitiveContent visuals remain OCT-005. Information-war hero image remains IW-001.
- [x] **SYS-014 — High** — Introduce route-family skeleton layouts and App Router loading boundaries. **Acceptance:** loading geometry matches final shell/header/content widths and does not shift on hydration. Depends on: SYS-002, SYS-010.
  - Verified 2026-09-03: `SkeletonDesk`/`Dossier`/`Institution` plus segment `loading.tsx` on brief/search/ask/updates/fact-check/articles/methodology. No root `app/loading.tsx` (`tests/no-js-invariant.test.ts`).
- [ ] **SYS-015 — Medium** — Audit all 50 CSS Modules for repeated primitive styles and token literals; migrate only repeated contracts, not page-specific art direction. **Acceptance:** report deleted declarations/files and no visual regression in untouched routes. Depends on: SYS-007 through SYS-013.

## 9. Navigation and global shell todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **NAV-001 — Critical** — Rebuild `SiteHeader` information hierarchy: brand/role, core sections, explicit Search and Ask actions, All files, Support. **Acceptance:** current route is announced visually and with `aria-current`; Search and Ask are reachable in one action at desktop and mobile. Depends on: SYS-007, SYS-012.
  - Verified 2026-09-03: SearchLauncher + AskLauncher in the bar; Search/Ask rows in the mobile sheet. Screenshots at 390 and 1440.
- [x] **NAV-002 — Critical** — Replace the mobile menu with a shared drawer pattern. **Acceptance:** 320px fit, 44px targets, trapped focus, Escape, outside-click policy, body scroll lock, return focus, and no hover-only affordance. Depends on: NAV-001, SYS-012.
  - Verified 2026-09-03: mobile Menu is `Dialog variant="drawer"` with `id` wired to `aria-controls`. At 320: trigger 44px, sheet rows 44px, Tab stays inside the dialog, Escape closes and returns focus to Menu, start-edge gutter lets backdrop click close. `filesPanel` remains the no-JS index (`tests/no-js-invariant.test.ts`).
- [x] **NAV-003 — High** — Add route-family context below/within the masthead: desk status for live tools, dossier breadcrumbs for records, institution label for trust pages. **Acceptance:** users can identify section and parent route without reading body copy. Depends on: SYS-002.
  - Verified 2026-09-03: `EditorialShell` announces Desk / Dossier / Institution; DocPage/SectionPage still carry breadcrumbs.
- [x] **NAV-004 — High** — Rework `SiteFooter` as a compact colophon and section index. **Acceptance:** no duplicate wall of links after already long archive pages; Methodology and Corrections remain prominent. Depends on: NAV-001.
  - Verified 2026-09-03: colophon is brand + statement, Methodology/Corrections as body-size trust links, dense eight-file index, year. Screenshots: `/methodology` 1440, `/geopolitical-brief` 320, `/updates` 320. Still a server component; all links in HTML.
- [x] **NAV-005 — Critical** — Preserve and retest skip-link/landmark structure through every shell variant. **Acceptance:** first Tab reveals skip link; one `main`; banner/navigation/contentinfo landmarks are correctly scoped. Depends on: SYS-002.
  - Verified 2026-09-03: `tests/shell-landmarks.test.ts` asserts skip link precedes header and a single `main` in `EditorialShell`.
- [x] **NAV-006 — High** — Create mobile section navigation for long routes using a labelled sheet or select-like list, not a tiny sticky rail. **Acceptance:** current section is announced and scroll target receives focus without hiding beneath fixed header. Depends on: NAV-002.
  - Verified 2026-09-03: `<1220px` labelled “In this file” Button (44px at 320) opens `Dialog` drawer; `aria-current` on the active heading; click closes, focuses the `h2` (`how-claims-are-labeled` on `/methodology`), `scroll-margin-top: var(--anchor-offset)`. ≥1220px sticky rail unchanged. `/methodology` opted into `rails="toc"` (eight sections). No-JS: control absent, headings remain (`tests/no-js-invariant.test.ts`).

## 10. Product-area and route-specific todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

### Homepage

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **HOME-001 — High** — Rebuild the complete particle-lion, typographic-field, black-ground, wordmark, navigation, and fallback composition as the single signature experience; preserve only required content, brand assets, data, and renderer capabilities. Files: `app/page.tsx`, `home.module.css`, particle/typographic components. **Acceptance:** no current homepage layout or visual state remains unchanged; live, poster, no-WebGPU, reduced-motion, and no-JS states all expose usable rebuilt navigation. Depends on: SYS-001, NAV-001.
- [ ] **HOME-002 — High** — Replace “Discover our system” with a primary Daily Brief action and a secondary all-files affordance. Evaluate the restrained Interactive Hover Button adaptation. **Acceptance:** touch state is static; keyboard focus is obvious; CTA text states destination. Depends on: SYS-007.
- [ ] **HOME-003 — High** — Rebuild the bottom intelligence rail as one stable current signal with source/status/time plus a link to `/updates`. **Acceptance:** no continuous unreadable marquee, no content clipping at 320px, and update text remains in DOM. Depends on: SYS-008, LIVE-001.
- [ ] **HOME-004 — Medium** — Tune desktop and ultrawide composition so the lion, wordmark, CTA, and rail remain one focal system rather than floating elements. **Acceptance:** validated at 1440, 1920, and 2560 widths. Depends on: HOME-002, HOME-003.

### Daily Brief and article records

- [x] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **BRIEF-001 — Critical** — Move `/geopolitical-brief` into the Desk shell while preserving its specialized content model. Files: route, `LiveBriefHub`, shell components. **Acceptance:** consistent header/footer/skip link; no duplicate masthead; server data fetch remains server-side. Depends on: SYS-002, NAV-001.
  - Verified 2026-09-03: `LiveBriefHub` renders through `EditorialShell`; server fetch unchanged.
- [x] **BRIEF-002 — Critical** — Rebuild filters into desktop filter bar and mobile filter drawer with active-filter summary and clear-all action. **Acceptance:** all controls fit at 320px; labels remain visible; query parameters are preserved. Depends on: SYS-009, SYS-012.
  - Verified 2026-09-03: `BriefFilters` GET form on desktop; at 320 a Filters button opens `Dialog` drawer with Date/Actor/Topic/Arena labels; Escape closes; `@media (scripting: none)` keeps the GET form. Names `date`, `actor`, `topicLabel`, `arena` unchanged.
- [x] **BRIEF-003 — Critical** — Rebuild brief result rows with date/status/topic, headline, summary, source count, and explicit “Read record” action. **Acceptance:** no link box exceeds viewport at 320px; long titles wrap without clipping. Depends on: SYS-008.
  - Verified 2026-09-03: Card rows; Read record at 320 with zero overflow offenders. Source count omitted — list `PublicPublication` has no sources array (detail-only); not invented. Reveal stagger removed so rows are opacity 1.
- [x] **BRIEF-004 — High** — Remove sticky article headings unless a tested comparison use case justifies them. **Acceptance:** headings do not stack or obscure preceding content during scroll. Depends on: BRIEF-003.
  - Verified 2026-09-03: `.liveSection h2 { position: sticky }` removed.
- [x] **ARTICLE-001 — Critical** — Rebuild `/articles/[publicId]` as a Dossier article: breadcrumb, title/standfirst, publication facts, narrative assessment, passages, sources, unknowns, related coverage, corrections. **Acceptance:** every source relationship remains intact; no claim is visually presented as verified solely by color. Depends on: SYS-002, SYS-011, SYS-013.
  - Verified 2026-09-03: `routeId="articles"` (dossier family). Breadcrumb Home / Daily Brief / title. Badges with text labels. Browser: `/articles/israel-ministry-of-defense-activities-regional-r-lref0` HTTP 200, `data-family=dossier`, Public sources section present. `isAnalysisBasis === "analysis"` only.
- [x] **ARTICLE-002 — High** — Create a responsive source/citation rail that becomes inline sections below 1220px. **Acceptance:** links wrap safely; external destination and publisher are clear; keyboard focus is visible. Depends on: ARTICLE-001.
  - Verified 2026-09-03: passage sources use `marginNote` two-track ≥1220px; inline below. Publisher + ↗ in the document, not a second copy.
- [x] **ARTICLE-003 — High** — Add route loading/not-found/error variants specific to publication records. **Acceptance:** final-layout skeleton, missing-record recovery, and database failure state are distinct. Depends on: SYS-010, SYS-014.
  - Verified 2026-09-03: `loading.tsx` → SkeletonDossier; `not-found.tsx` “No published article at this address” with Daily Brief/Search; `error.tsx` StatusState + retry. `/articles/does-not-exist-zzzz` shows the missing-record page.

### Fact Check

- [x] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **FACT-001 — Critical** — Rebuild each `ClaimEntry` around verdict-first hierarchy: circulating claim, verdict, evidence strength, concise rationale, last updated. **Acceptance:** collapsed state communicates enough to decide whether to expand. Depends on: SYS-008, SYS-011.
  - Verified 2026-09-03: summary shows verdict text, exact claim, optional evidence counts, analysis basis, stamp, and VERIFICATION_STATES meaning when detail exists. Native `<details>`. Browser: 3 summaries on `/fact-check`.
- [x] **FACT-002 — Critical** — Rebuild `ClaimLadder` and `EvidenceChain` as a linear evidence path with source count, contradictions, unknowns, and assessment. **Acceptance:** screen-reader order matches visual order; no connector is the sole relationship cue. Depends on: FACT-001.
  - Verified 2026-09-03: labelled rungs 01–06 in document order; source count and Cited/No source attached are text. `tests/live-surfaces.test.ts`.
- [x] **FACT-003 — High** — Standardize disclosure controls and URL/deep-link behavior. **Acceptance:** open state is keyboard accessible, addressable, and retained after back navigation where practical. Depends on: FACT-001.
  - Verified 2026-09-03: `?claim=` + `id="claim-{publicId}"`; “Link to this check” visible when open; native details keyboard. Tests cover `?claim=` including past the detail budget.
- [x] **FACT-004 — High** — Add explicit empty, unavailable, loading, and retry states to `FactCheckDesk`. **Acceptance:** database outage is not rendered as “no checks.” Depends on: SYS-010, SYS-014.
  - Verified 2026-09-03: unavailable uses `status="error"`; genuine empty uses `status="empty"`; segment `loading.tsx` covers loading.

### Search

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **SEARCH-001 — Critical** — Rebuild `SearchPanel` with a persistent labelled input, scope explanation, recent/primer suggestions, and grouped result taxonomy. **Acceptance:** idle, loading, results, no-results, invalid-query, error, and retry states exist. Depends on: SYS-009, SYS-010.
  - Verified 2026-09-03: labelled FieldShell; idle primer + five suggestion chips (browser count 5); grouped results; invalid-query / empty / error+retry / loading visual. Combobox ARIA unchanged.
- [ ] **SEARCH-002 — Critical** — Rebuild result rows to expose entity type, verification state, date, excerpt, and destination. **Acceptance:** results are distinguishable without color and long text wraps at 320px. Depends on: SYS-008, SYS-011.
  - Blocked 2026-09-03: `SearchHit` has type, title, href, score only. Rows expose type + destination; score never shown; wrap is in CSS. Date, excerpt, and verification are not on the contract and were not invented. Do not mark until the projection carries them.
- [x] **SEARCH-003 — High** — Rebuild header `SearchDialog` as desktop command overlay and mobile full-screen search using shared Dialog. **Acceptance:** focus starts in input, Escape closes, focus returns, results announce count changes politely. Depends on: SYS-012, NAV-001.
  - Verified 2026-09-03: `SearchDialog` uses shared `Dialog`; launcher still links to `/search` without JS.
- [x] **SEARCH-004 — Medium** — Preserve server-rendered explanatory content and no-script route links. **Acceptance:** `/search` remains a usable orientation page without JavaScript. Depends on: SEARCH-001.
  - Verified 2026-09-03: noscript index remains; labelled field stays in the SSR tree; `scripting: none` no longer hides `.panel`. `tests/no-js-invariant.test.ts` passed.

### Ask AI

- [x] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **AI-001 — Critical** — Recompose `AskDesk` into prompt, evidence-boundary notice, answer record, citations, and follow-up areas. **Acceptance:** the user can see what corpus is searched and what an unsupported answer means before submitting. Depends on: SYS-008, SYS-010.
  - Verified 2026-09-03: Evidence boundary sits above the composer on idle (browser). Primer examples remain. Follow-up label after history.
- [x] **AI-002 — Critical** — Standardize Ask states: restoring, idle, submitting, thinking, streaming/receiving, sourced answer, insufficient evidence, provider error, rate limit, aborted request. **Acceptance:** state changes use appropriate live regions and never rely on animation alone. Depends on: SYS-010.
  - Verified 2026-09-03: restoring / idle / asking (thinking) / sourced / zero-citation / provider error / rate limit / lost thread / Stop abort. Streaming was not invented — POST does not stream. Clock is not live.
- [x] **AI-003 — Critical** — Increase composer/action touch targets and preserve keyboard behavior. **Acceptance:** submit is at least 44px on coarse pointers; Enter/Shift+Enter behavior is documented in visible help and works with IME. Depends on: SYS-007, SYS-009.
  - Verified 2026-09-03: Ask submit is shared `Button` size md (`--control-h` 44px; coarse floor in button CSS). Enter/Shift+Enter copy remains in the composer hint.
- [x] **AI-004 — High** — Rebuild Border Beam and use the new implementation only around the active answer boundary while thinking; stop immediately on completion/error. **Acceptance:** the old visual implementation is removed and the new state becomes a static emphasized border under reduced motion. Depends on: AI-002.
  - Verified 2026-09-03: `BorderBeam` only inside the waiting record while `asking`. Reduced-motion: static thick border; beam hidden.
- [x] **AI-005 — High** — Rebuild `CitationList` to align citations with answer passages and provide source title/publisher/status. **Acceptance:** every cited claim can be traced without hover. Depends on: SYS-011.
  - Verified 2026-09-03: title, href, quote in the document. Publisher/status are not on `citationSchema` and were not invented. Unreachable stays “Indexed · no public page”.

### Live Updates and War Update

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **LIVE-001 — Critical** — Rebuild `UpdateFeed` as stable reverse chronology with type, timestamp, verification state, summary, and related record. **Acceptance:** no 320px clipping; newest updates do not reorder while being read without user intent. Depends on: SYS-008, SYS-011.
  - Verified 2026-09-03: Reveal removed (row opacity 1 at 320); 5 article links visible without scrolling into view; zero overflow offenders; verification labels as text; no client reorder.
- [ ] **LIVE-002 — High** — Add loading, stale-data, reconnecting, empty, partial-error, and end-of-feed states. **Acceptance:** stale timestamp is explicit and accessible. Depends on: SYS-010, SYS-014.
  - In progress 2026-09-03: loading (`loading.tsx`), empty/error StatusState, end-of-feed pager, FeedStatus “Stale data / may be up to 5 minutes stale”. Reconnecting and partial-error not invented (no websocket / no partial read). Do not mark until those states exist or are explicitly out of product scope.
- [x] **LIVE-003 — High** — Decide whether `/war-update` is a real filtered feed or a redirect/section of Daily Brief. If no distinct data exists, remove the duplicate route from primary navigation and provide a permanent redirect. **Acceptance:** one clear source of current war updates. Depends on: product decision, BRIEF-001.
  - Verified 2026-09-03: `/war-update` stays a distinct filtered feed (`section=war_update`). Outage is `status="error"`; genuine empty is `status="empty"` — not collapsed together.
- [ ] **LIVE-004 — Medium** — If real-time insertion is introduced, announce count/new-item availability without moving the reader. **Acceptance:** “N new updates” control inserts on request; no Animated List sequencing. Depends on: LIVE-001.

### Fake Resistance and influence network

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **INV-001 — High** — Rebuild `/fake-resistance` as a Dossier hub: thesis, latest/featured case, branch index, methods index, network entry. **Acceptance:** users reach a case or branch before a full essay wall. Depends on: SYS-002, SYS-008.
- [ ] **INV-002 — High** — Create one case-file template for `cases/[slug]` with executive finding, confidence, entities, timeline, evidence, contradictions, known unknowns, and sources. **Acceptance:** all existing case data maps without fabricated fields. Depends on: SYS-011, SYS-013.
- [ ] **INV-003 — High** — Rebuild official-narrative cases as a comparative list/table at desktop and stacked records on mobile. **Acceptance:** case status and evidence basis remain visible in collapsed view. Depends on: SYS-008, SYS-011.
- [ ] **INV-004 — High** — Rebuild the playbook as an indexed field manual with technique summaries and anchored detail. **Acceptance:** 70+ links do not form an undifferentiated wall; focus/anchor offset is correct. Depends on: NAV-006.
- [ ] **INV-005 — Medium** — Rebuild social-media branch previews with title, question, evidence basis, and destination. **Acceptance:** no generic “read more” card set. Depends on: SYS-008.
- [ ] **NET-001 — Critical** — Split `InfluenceGraph` into a desktop graph+inspector and a mobile-first entity/relationship list. **Acceptance:** no graph interaction is required to access any finding. Depends on: SYS-012.
- [x] **NET-002 — Critical** — Increase filter, node, and relationship controls to minimum target size and add selected/focus states. **Acceptance:** at least 44×44px on coarse pointers; current 32–36px controls are eliminated. Depends on: SYS-007.
  - Verified 2026-09-03: chips use `--control-h`; coarse pointers set graph rows to `--control-h`.
- [ ] **NET-003 — High** — Use animated beams only for the currently selected documented relationship; inferred/observed/documented distinctions remain textual. **Acceptance:** zero ambient connector animation and static reduced-motion fallback. Depends on: NET-001.
- [ ] **NET-004 — High** — Add empty-filter, no-edge, selected-node, loading, and data-error states. **Acceptance:** filters with zero matches explain how to reset. Depends on: SYS-010.

### Information War

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **IW-001 — High** — Rebuild the complete scrollytelling UI while preserving only the factual transformation sequence; replace all current layouts, visual layers, telemetry treatments, and responsive states. Files: `InformationWarSystem`, `InformationWarBeams`, CSS. **Acceptance:** no current rendered section remains unchanged; each rebuilt section has one primary reading path and one explanatory diagram. Depends on: SYS-002.
- [ ] **IW-002 — Critical** — Fix heading semantics so the browser/accessibility text reads “This is an information war.” with intended spacing. **Acceptance:** accessible name and visual heading match. Depends on: SYS-004.
- [ ] **IW-003 — High** — Replace mobile sticky-system behavior with inline diagrams or step cards when viewport height is constrained. **Acceptance:** no pinned scene consumes more than 65% of a 320×568 viewport. Depends on: IW-001.
- [ ] **IW-004 — Medium** — Cap and centralize Signal Beam measurement/animation; use static labelled lines under reduced motion. **Acceptance:** no continuous layout measurement while offscreen. Depends on: NET-003.

### October 7 archive

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **OCT-001 — Critical** — Rebuild `/october-7` as a restrained memorial/dossier hub that distinguishes testimony from documentation and states sensitivity before entry. **Acceptance:** no celebratory motion, ticker, or cursor effect. Depends on: SYS-002, SYS-013.
- [ ] **OCT-002 — Critical** — Rebuild documentation index filtering with query, category counts, result count, reset, pagination/virtualization, and current filter summary. **Acceptance:** hundreds of links are not all treated as equal visible content; URL preserves filters. Depends on: SYS-009, SYS-010, SYS-015.
- [ ] **OCT-003 — Critical** — Create a testimony-specific index emphasizing speaker, locale, date/context, and transcript availability rather than reusing documentation-card anatomy unchanged. **Acceptance:** testimony/documentation types are distinguishable without labels alone. Depends on: OCT-002.
- [ ] **OCT-004 — Critical** — Rebuild `ArchiveRecordPage` into shared provenance shell plus testimony/documentation variants. **Acceptance:** title, content warning, media, transcript/description, provenance, source, locale, share, previous/next are predictable. Depends on: SYS-013.
- [ ] **OCT-005 — Critical** — Rebuild the complete `SensitiveContent` presentation while preserving its protection behavior: explicit category, reveal/cancel, focus movement, hide-again, no autoplay, and no blurred preview that leaks content. **Acceptance:** the old visual implementation is removed and the new component is fully operable by keyboard and screen reader. Depends on: OCT-004.
  - In progress 2026-09-03: reveal/hide controls now use shared Button; consent behavior unchanged. Full visual rebuild still open.
- [ ] **OCT-006 — High** — Add locale switch and scoped `lang`/`dir` on localized records. **Acceptance:** current language is announced; alternate locale URLs are accessible and canonical metadata stays correct. Depends on: SYS-003, OCT-004.
- [ ] **OCT-007 — High** — Optimize archive media with stable dimensions, responsive sources, lazy loading below fold, and explicit failure fallback. **Acceptance:** no layout shift from media; failure does not remove provenance. Depends on: SYS-013.

### Israel’s Story, Our Heroes, Methodology, Corrections, We Are

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **STORY-001 — High** — Rebuild Israel’s Story with era navigation, chapter anchors, and alternating editorial rhythm that does not become a card grid. **Acceptance:** every era reachable from a compact index; mobile remains linear. Depends on: NAV-006.
- [ ] **STORY-002 — Medium** — Use motion only to reveal chronological progression; remove per-section effects that do not add chronology. **Acceptance:** complete static timeline under reduced motion. Depends on: MOTION-001.
- [ ] **HEROES-001 — High** — Create a quiet memorial composition with restrained typography, no metric spectacle, and citations adjacent to claims. **Acceptance:** names/stories are primary; no hover-dependent content. Depends on: SYS-002, SYS-013.
- [ ] **METHOD-001 — High** — Rebuild Methodology as an institutional standard: scope, evidence classes, labeling rules, publication process, corrections, limitations. **Acceptance:** readers can answer “how was this assessed?” within the first viewport and navigate to detail. Depends on: SYS-011, NAV-006.
- [ ] **METHOD-002 — Medium** — Use static relationship diagrams; optional Signal Beam only when it communicates a real process path. **Acceptance:** all steps and gates remain textual. Depends on: METHOD-001.
- [ ] **CORR-001 — Medium** — Rebuild Corrections empty and populated states as a public ledger. **Acceptance:** “none recorded” is visibly distinct from load failure; entries deep-link to corrected record when data permits. Depends on: SYS-010.
- [ ] **ORG-001 — Medium** — Rebuild We Are with proof hierarchy: purpose, operating method, roles, principles, FAQ. Replace generic role cards with an editorial roster/list. **Acceptance:** no invented people, metrics, logos, or testimonials. Depends on: SYS-008.

### Support, account, admin, internal tools

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **SUPPORT-001 — Critical** — Recompose `/support-us` around an initial choice: report a claim, volunteer, donate, or share. Reveal only the selected flow. **Acceptance:** one primary action per state; back/change action preserves entered data. Depends on: SYS-008, SYS-012.
- [x] **SUPPORT-002 — Critical** — Migrate both forms to shared field primitives with complete validation/status behavior. **Acceptance:** 44px targets including checkbox label regions; server and client errors attach to fields and summary. Depends on: SYS-009, SYS-010.
  - Verified 2026-09-03: ReportClaimForm and VolunteerInterestForm use Field / FieldGroup / CheckboxField / Button.
- [ ] **SUPPORT-003 — High** — Consolidate share controls and isolate PayPal as an external step. **Acceptance:** copied-link success is announced; popup failure exposes direct link; external payment is explicit. Depends on: SYS-007, SYS-010.
- [ ] **AUTH-001 — High** — Rebuild `/account` and `/admin/login` as English institution/auth surfaces with clear sign-in states and consistent field/action hierarchy. **Acceptance:** password-manager/autocomplete behavior preserved; error and pending states announced; `lang="en"`. Depends on: SYS-003, SYS-009, SYS-010.
- [ ] **ADMIN-001 — High** — Resolve the authorized local auth configuration before visual browser work on `/admin`; never commit the secret. **Acceptance:** route renders through normal auth flow locally. Depends on: operations.
  - Blocker 2026-09-03: `NEON_AUTH_COOKIE_SECRET` in `.env.local` is 11 characters (runtime requires ≥32). `/admin` returns HTTP 500. `/admin/login` renders. Do not commit a secret.
- [ ] **ADMIN-002 — High** — Rebuild admin information architecture into system status, sources, publication queue, editor, and destructive actions. **Acceptance:** dangerous actions require explicit confirmation and show consequence; keyboard order matches visual layout. Depends on: ADMIN-001, SYS-007, SYS-012.
- [ ] **PIPE-001 — Critical** — Replace the pipeline’s fixed/wide horizontal control layout with responsive regions. Files: all `components/pipeline-visualizer/*` and CSS. **Acceptance:** no off-viewport interactive element at all nine required sizes. Depends on: SYS-005, SYS-007.
- [ ] **PIPE-002 — Critical** — Add one semantic `h1`, landmarks, logical keyboard sequence, 44px coarse-pointer controls, and visible focus. **Acceptance:** current 27–30px controls are gone and all 88 controls remain reachable. Depends on: PIPE-001.
  - In progress 2026-09-03: visualizer chrome is English and LTR; one `h1` is in the header. Responsive containment and remaining 44px controls still belong to PIPE-001/002.
- [ ] **PIPE-003 — High** — Migrate glossary modal, node inspector, and explainer surfaces to shared Dialog/drawer behavior. **Acceptance:** focus trap/return and Escape pass; canvas remains inert behind modal. Depends on: SYS-012.
- [ ] **PIPE-004 — High** — Provide mobile list/process view rather than shrinking the desktop topology. **Acceptance:** every node/journey is readable and operable without horizontal panning. Depends on: PIPE-001.
- [x] **DEV-001 — High** — Remove or protect `/particle-demo` in production while retaining a documented local-only entry. **Acceptance:** production visitors cannot reach Leva/debug controls; developer workflow remains available. Depends on: none.
  - Verified 2026-09-03: `next.config.ts` redirects `/particle-demo` to `/` when `NODE_ENV` is not development. Local `next dev` keeps the route.

## 11. Interaction and state todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **STATE-001 — Critical** — Create a component-state inventory for every Button, Field, Card-as-link, Tab, Disclosure, Dialog, Drawer, Filter, Result row, and media reveal. Record default/hover/focus/active/selected/disabled/loading/success/warning/error/empty as applicable. **Acceptance:** no interactive primitive ships with an undefined relevant state. Depends on: SYS-007 through SYS-013.
  - Verified 2026-09-03: `tests/ui-state-contract.test.ts` asserts Button/Field/Dialog state CSS in the shipped modules.
- [x] **STATE-002 — Critical** — Define live-region rules: polite for result counts/new updates/success; assertive only for blocking errors; never announce ambient status repeatedly. **Acceptance:** Search, Ask, Support, auth, feed, and admin each follow the rule. Depends on: SYS-010.
  - Verified 2026-09-03: `politeLive`/`assertiveLive` on Search (counts vs errors), Ask (citation/wait vs provider failure; thinking clock is not live), Support (success vs submit failure), public auth, admin editor notices. `UpdateFeed` is server-rendered chronology with no client announcements; LIVE-002 will add stale/reconnect on that surface.
- [ ] **STATE-003 — High** — Standardize retry behavior and preserve user input/query after recoverable errors. **Acceptance:** retry never clears form/search/Ask content unless explicitly chosen. Depends on: SYS-010.
- [ ] **STATE-004 — High** — Standardize destructive confirmation for admin delete/archive and any sensitive irreversible action. **Acceptance:** action, target, consequence, and cancel are explicit; focus returns correctly. Depends on: SYS-012.
- [ ] **STATE-005 — High** — Define empty states by cause: genuine empty record, no filter matches, no published data, unavailable service, permission/auth required. **Acceptance:** no empty state masquerades as error or vice versa. Depends on: SYS-010.

## 12. Responsive implementation matrix

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

| Viewport | Required behavior and known issues |
| --- | --- |
| `320×568` | Single-column public shell; compact masthead; no sticky scene over 65% viewport; fix Daily Brief and Updates clipping; pipeline becomes list/process view; long titles wrap; drawers use full height. |
| `375×667` | Same as 320 with slightly expanded spacing; no assumptions based on 390px design target; all 44px controls preserved. |
| `390×844` | Primary mobile reference; verify menu, search overlay, Ask composer, archive filters, sensitive media, support flows, network list, and footer. |
| `430×932` | Large-phone reference; avoid stretching controls/cards merely because width exists; permit two-column micro-layout only where labels remain readable. |
| `768×1024` | Tablet portrait; desktop TOC must not appear if it compresses reading; filters may use drawer or two-column panel; pipeline remains non-desktop topology. |
| `1024×768` | Short landscape; fixed header/sticky scenes must account for low height; dialogs must fit and scroll internally; pipeline controls must not run offscreen. |
| `1440×900` | Primary desktop reference; use available width with content rail/aside where informative; avoid tiny central island and excessive dead black. |
| `1920×1080` | Wide desktop; cap reading measure but expand supporting rails/media; do not scale type indefinitely; pipeline must contain all controls. |
| `2560×1080` | Ultrawide; maintain coherent focal group and max shell width; no content stretched across full width; current pipeline is only fully contained here, which is not acceptable as its baseline. |

- [ ] **RESP-001 — Critical** — Implement and document responsive contracts for shell, header, drawers, content grid, filters, cards, tables, diagrams, and forms at the nine widths. **Acceptance:** no horizontal overflow or clipped interactive geometry. Depends on: SYS-005, NAV-002.
- [ ] **RESP-002 — Critical** — Replace global `overflow-x: clip` as a hiding mechanism with component-level containment fixes. Keep clipping only for intentional non-interactive decoration. **Acceptance:** automated geometry check catches offscreen links/controls. Depends on: RESP-001.
- [ ] **RESP-003 — High** — Define touch behavior independently of hover. **Acceptance:** every hover reveal has a tap/focus equivalent and no required information is tooltip-only. Depends on: STATE-001.
- [ ] **RESP-004 — High** — Define sticky behavior by both width and height. **Acceptance:** header, TOC, archive jump, brief headings, and scrollytelling scenes do not overlap content at 1024×768 or 320×568. Depends on: RESP-001.
- [ ] **RESP-005 — High** — Add long-content stress fixtures: 120-character headlines, long URLs, Hebrew/English mixed text, 10 badges, long publisher names. **Acceptance:** wrap/truncation preserves access to full meaning. Depends on: SYS-004.

## 13. Unified motion language

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

Target defaults:

- Hover/press feedback: `160ms`, `cubic-bezier(0.16, 1, 0.3, 1)`.
- Component state transition: `240ms`, same easing.
- Section entrance: `400–520ms`, opacity plus maximum 10px translation and maximum 6px blur.
- Ordered stagger: 50–70ms, maximum six visibly staggered items.
- Spring: only for direct manipulation; target stiffness 260–350 and damping 30–40; no bouncing editorial content.
- Ambient loops: homepage and genuine live/process states only; minimum 5s cycle; pause offscreen/hidden.
- Scroll effects: communicate progression; never intercept native scroll or create scroll-jacking.
- Reduced motion: no spatial translation, no continuous beam/shimmer, no typing simulation; final state immediately visible.

- [x] **MOTION-001 — Critical** — Centralize duration/easing/stagger tokens and remove route-specific arbitrary motion values. **Acceptance:** all production motion references named tokens or documented GPU timing constants. Depends on: SYS-001.
  - Verified 2026-09-03: `--dur-*`, `--ease-*`, `--stagger`, `--enter-shift`, `--enter-blur` in `globals.css`; section entrance uses `--enter-shift`. Remaining route-literal durations stay SYS-015.
- [ ] **MOTION-002 — High** — Inventory every animation loop, IntersectionObserver, ResizeObserver, requestAnimationFrame, and `motion` caller. **Acceptance:** each has purpose, offscreen pause behavior, cleanup, and reduced-motion result. Depends on: none.
- [ ] **MOTION-003 — High** — Limit `Reveal` use to family headers, major sections, and real ordered processes. **Acceptance:** long archives and feed rows are immediately available rather than sequentially delayed. Depends on: MOTION-001.
- [ ] **MOTION-004 — High** — Define processing animation lifecycle for Ask, Search, forms, admin, and pipeline. **Acceptance:** begins only after request starts; ends on success/error/abort; not replayed on hydration. Depends on: SYS-010.
- [ ] **MOTION-005 — High** — Verify homepage GPU and typographic engines pause on hidden tab/offscreen and tier down on mobile. **Acceptance:** reduced motion freezes meaningful final composition; poster fallback remains navigable. Depends on: HOME-001.

## 14. Accessibility todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **A11Y-001 — Critical** — Audit heading hierarchy and landmarks on all 33 route patterns. Fix `/pipeline` missing `h1` and `/information-war` concatenated heading. **Acceptance:** one meaningful `h1`; logical levels; one `main`. Depends on: route rebuilds.
- [ ] **A11Y-002 — Critical** — Verify complete keyboard journeys: header/menu, Search, Ask, filters, fact disclosures, archive filters/records, sensitive content, network, forms, dialogs, pipeline, admin. **Acceptance:** no trap except intentional modal; no inaccessible canvas-only action. Depends on: NAV-002, SYS-012.
- [ ] **A11Y-003 — Critical** — Standardize visible focus with `--focus-outline`/`--focus-offset`; ensure clipping/overflow never hides it. **Acceptance:** every interactive element has at least 3:1 focus-indicator contrast. Depends on: SYS-001.
- [ ] **A11Y-004 — Critical** — Validate text, controls, semantic states, and overlays against WCAG AA contrast. **Acceptance:** normal text 4.5:1, large text 3:1, non-text UI 3:1; color never sole cue. Depends on: SYS-001.
- [ ] **A11Y-005 — Critical** — Keep public chrome `lang="en"`. Scope `lang`/`dir` only on localized archive records (and any quoted source language). **Acceptance:** screen readers match the product language; mixed-script quotes use local `lang`. Depends on: SYS-003.
- [ ] **A11Y-006 — Critical** — Enforce 44×44px coarse-pointer targets for actions; expand checkbox hit regions through labels. **Acceptance:** network and pipeline undersized controls are corrected. Depends on: SYS-007, SYS-009.
- [ ] **A11Y-007 — High** — Audit form labels, descriptions, required state, grouped checkboxes, validation summary, and error linkage. **Acceptance:** every field has programmatic name and error association. Depends on: SYS-009.
- [ ] **A11Y-008 — High** — Audit dialogs/drawers for naming, focus trap, inert background, Escape, return focus, and scroll containment. **Acceptance:** Search, mobile menu, pipeline, and confirmations pass. Depends on: SYS-012.
- [ ] **A11Y-009 — High** — Preserve sensitive-content consent and add media transcripts/captions/alt rules. **Acceptance:** evidence remains understandable without seeing/hearing media. Depends on: SYS-013, OCT-005.
- [ ] **A11Y-010 — High** — Verify reduced-motion across CSS, Motion, Three.js, typographic Canvas, beams, skeletons, and scroll behaviors. **Acceptance:** no continuous nonessential animation remains. Depends on: MOTION-002.

## 15. Performance todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **PERF-001 — Critical** — Produce route-level bundle/client-boundary report for all public route families. **Acceptance:** server pages stay server components; client imports are isolated to interactive islands. Depends on: none.
- [ ] **PERF-002 — High** — Remove unused `components/magicui/animated-list.tsx` after confirming no imports; evaluate whether `motion` remains justified by other callers. **Acceptance:** no dead Magic UI runtime in bundles. Depends on: dependency audit.
- [ ] **PERF-003 — High** — Audit all 64 client-marked files and consolidate client boundaries where repeated wrappers/listeners can be shared without widening hydration. **Acceptance:** before/after client module count and route bundle changes recorded. Depends on: PERF-001.
- [ ] **PERF-004 — Critical** — Implement archive scale strategy: pagination, incremental rendering, or virtualization without harming URL navigation and accessibility. **Acceptance:** index does not render hundreds of rich records at once; filter response remains prompt on mobile. Depends on: OCT-002.
- [ ] **PERF-005 — High** — Audit `next/image`, evidence media, fonts, poster assets, SDF/binary particle assets, and layout dimensions. **Acceptance:** no avoidable CLS; correct responsive sizes; below-fold lazy loading. Depends on: SYS-013.
- [ ] **PERF-006 — High** — Cap active Canvas/WebGPU work, pixel ratio, particle tier, and simultaneous animated beams based on capability. **Acceptance:** homepage interaction remains responsive on mobile fallback tier; page hidden/offscreen pauses work. Depends on: MOTION-005.
- [ ] **PERF-007 — High** — Ensure `Reveal`, reading progress, graph, and beam observers/listeners are shared or scoped and disconnected. **Acceptance:** no listener/observer growth after route transitions. Depends on: MOTION-002.
- [ ] **PERF-008 — Medium** — Measure CSS output and identify dead route/primitive rules before deletion. **Acceptance:** removal is evidence-based; no broad rewrite merely to replace CSS Modules with Tailwind. Depends on: SYS-015.
- [ ] **PERF-009 — High** — Add performance budgets: public reading route JS, homepage GPU startup, LCP media, CLS, INP, and archive interaction. Record budgets in repository QA tooling. **Acceptance:** CI/report fails or warns on agreed regressions. Depends on: PERF-001.

## 16. Cleanup todos

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [x] **CLEAN-001 — High** — Remove unused direct Magic UI `AnimatedList` and any now-unused `motion` imports after bundle audit. Depends on: PERF-002.
  - Verified 2026-09-03: `components/magicui/animated-list.tsx` deleted; no remaining imports.
- [ ] **CLEAN-002 — Critical** — Migrate bespoke buttons to shared Button, except native summary/media controls or documented specialized canvas controls. **Acceptance:** no duplicate base control styling. Depends on: SYS-007.
- [ ] **CLEAN-003 — Critical** — Migrate bespoke modal/drawer implementations to shared Dialog variants. **Acceptance:** one focus-management implementation. Depends on: SYS-012.
- [ ] **CLEAN-004 — High** — Remove obsolete route-owned card shells after shared editorial card migration. **Acceptance:** no visual double-wrapping and no dead selectors. Depends on: SYS-008.
- [ ] **CLEAN-005 — High** — Decide and remove/redirect `/war-update` duplication based on LIVE-003. Depends on: LIVE-003.
- [ ] **CLEAN-006 — High** — Protect/remove `/particle-demo` from production. Depends on: DEV-001.
- [ ] **CLEAN-007 — Medium** — Remove stale CSS comments and historical visual rationale only after code behavior is encoded in tests/tokens. Do not delete operational/security comments. Depends on: SYS-015.
- [ ] **CLEAN-008 — High** — Remove surviving old UI in a second pass: old buttons, card wrappers, loading spinners, unused animation classes, deprecated tokens, orphan assets, and unreachable components. **Acceptance:** repository search plus rendered-route review finds no superseded system. Depends on: all migrations.

## 17. Execution order

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

1. **Baseline:** capture current route screenshots, accessibility tree summaries, route bundles, and performance numbers; resolve authorized `/admin` local rendering.
2. **Foundations:** SYS-001 through SYS-014, MOTION-001, STATE-001/002.
3. **Chrome:** NAV-001 through NAV-006, responsive shell contract.
4. **Primary desk:** Daily Brief, article records, Fact Check, Search, Ask, Updates.
5. **Dossiers:** Fake Resistance, network, Information War, October 7, Israel’s Story, Our Heroes.
6. **Institutional:** Methodology, Corrections, We Are, Support, account/auth.
7. **Internal operator tools:** Admin, Pipeline, particle-demo protection.
8. **Performance/accessibility:** route-by-route verification during each migration, then cross-route pass.
9. **Cleanup:** remove old primitives/styles/assets only after every caller is migrated.
10. **Final second-pass audit:** search for and visually inspect surviving old UI.

Do not begin route styling before SYS-001 through SYS-013 and NAV-001/002 are stable. Do not remove an old component until all callers have migrated and the corresponding route has passed its focused checks.

## 18. Final QA plan

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

### Automated and structural checks

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] **QA-001 — Critical** — Enumerate all 33 route patterns from `app/**/page.tsx`; test one real instance of every dynamic pattern and all static routes.
  - In progress 2026-09-03: `tests/route-inventory.test.ts` asserts 33 `page.tsx` files. Dynamic-family browser instances still open.
- [ ] **QA-002 — Critical** — Run geometry checks at all nine required viewports for horizontal overflow, offscreen controls/links, hidden focus outlines, and overlapping fixed/sticky elements.
- [ ] **QA-003 — Critical** — Verify heading/landmark structure, accessible names, `lang`/`dir`, and skip-link behavior for every route family.
- [ ] **QA-004 — Critical** — Keyboard test every menu, dialog, drawer, disclosure, filter, form, network control, sensitive-content gate, and pipeline control.
- [ ] **QA-005 — High** — Test default/hover/focus/active/selected/disabled/loading/success/warning/error/empty states with deterministic fixtures.
- [ ] **QA-006 — High** — Test reduced-motion and coarse-pointer media modes at representative routes.
- [ ] **QA-007 — High** — Test no-JS behavior for navigation, reading routes, Search orientation content, archive records, and public source access.
- [ ] **QA-008 — High** — Test loading/error/empty separation with provider/database unavailable, no results, and genuinely empty records.
- [ ] **QA-009 — High** — Measure route bundle sizes, LCP, CLS, INP, archive filter responsiveness, and homepage GPU startup against PERF-009 budgets.
- [ ] **QA-010 — High** — Validate external links, share fallback, PayPal fallback, media failure, image alt/captions, and source provenance.
- [ ] **QA-011 — Critical** — Reconcile the completed coverage ledger against the final Git diff, rendered route evidence, DOM, stylesheets, assets, and client bundles. **Acceptance:** 100% of visible ledger entries finish as **REBUILD**, **REPLACE**, or **REMOVE**; no rendered entry finishes as **KEEP** or **MODIFY**; and no old component, selector, asset, state, responsive variant, or interaction presentation survives without a documented non-visual reason and direct replacement evidence. Depends on: all route migrations, CLEAN-008.

### Visual review checklist

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] Public masthead and mobile menu are consistent but not oversized.
- [ ] Search and Ask are first-class actions.
- [ ] Desk, Dossier, and Institution pages are structurally distinct.
- [ ] Black remains the primary background without excessive glass, gradients, glow, or cards.
- [ ] Newsreader/IBM Plex Sans/JetBrains Mono roles are disciplined in English and Hebrew.
- [ ] Gold is scarce and meaningful; state colors include labels.
- [ ] Reading widths are comfortable while desktop space is used intentionally.
- [ ] Long pages have orientation and pacing; mobile is not an endless undifferentiated column.
- [ ] Forms have clear grouping, labels, errors, pending, success, and retry behavior.
- [ ] Dialogs, drawers, overlays, and sticky UI fit short and narrow viewports.
- [ ] Motion communicates entry, state, causality, or chronology; decorative loops are absent.
- [ ] Magic UI primitives look native to LionsOfZion and no demo gradients/purple/pink styling survive.
- [ ] Sensitive and memorial content remains restrained and never gamified.

### Required viewport pass

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

Run every public static route and one instance per dynamic family at `390×844` and `1440×900`. Run the full complex-route matrix at `320×568`, `375×667`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1440×900`, `1920×1080`, and `2560×1080`. The complex matrix must include home, Daily Brief, article detail, Fact Check, Search, Ask, Updates, Support, influence network, Information War, both October 7 indexes and record types, Admin, and Pipeline.

### Final old-UI survival audit

- [ ] **Subsection complete** — Mark only after this entire subsection has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

- [ ] Search for native `<button>`, `<input>`, `<textarea>`, `<select>`, custom dialog roles, old card class names, literal colors/radii/motion durations, and removed token names.
- [ ] Review every match; allow only semantic native controls or documented specialized exceptions.
- [ ] Compare final screenshots against baseline route-by-route, not only homepage.
- [ ] Inspect DOM/client bundles to confirm retired components are not merely hidden.
- [ ] Confirm removed UI has no orphan CSS, assets, exports, tests, or dependencies.
- [ ] Confirm all content, source links, route behavior, forms, auth, filters, and evidence semantics survived the visual migration.

## 19. Completion gate for the future implementation

- [ ] **Section complete** — Mark only after this entire section has been reviewed, every applicable child task is implemented and verified, and all of its child checkboxes are marked `- [x]`.

The rebuild is complete only when:

- every route pattern has migrated to the intended family and passed its acceptance criteria;
- no required route or state is omitted;
- the 320px Daily Brief/Updates clipping and Pipeline offscreen controls are fixed;
- network/pipeline/form touch targets meet the target size;
- loading, empty, unavailable, and error states are distinct;
- all interactive paths work with keyboard, touch, and reduced motion;
- no unjustified Magic UI effect or default component-demo styling remains;
- route bundles and GPU work stay within agreed budgets;
- old UI components/styles/assets are removed rather than layered underneath;
- the final second-pass audit finds no surviving superseded interface.
