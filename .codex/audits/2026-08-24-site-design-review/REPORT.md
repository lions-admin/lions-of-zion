# Lions of Zion — Professional design review and major redesign plan

Date: 2026-08-24
Evidence: desktop 1280×720 and mobile 390×844
Scope: landing scan, all eight primary destinations, responsive reading, editorial trust, conversion, and Ask the Lion.

## Executive decision

Lions of Zion already has something most early products do not: a recognizable visual world. The central lion, midnight navy, restrained gold, signal corpus, and dossier typography create a cinematic identity that feels authored rather than assembled from a template.

The next release should therefore **not** be a visual reskin. It should preserve the brand and rebuild the product architecture behind it.

The core problem is a promise–delivery gap:

- The landing experience promises a live intelligence and verification system.
- The destination pages currently explain what each section will eventually contain.
- Almost every destination uses the same long-form prose template, despite serving radically different user needs.
- Trust is described in copy, but not yet demonstrated through dates, statuses, evidence, sources, revisions, or accountable authorship.

My recommendation is to preserve roughly 40% of the experience—the identity, palette, lion, type pairing, and “signal room” atmosphere—and redesign roughly 60%: information architecture, page archetypes, editorial modules, mobile composition, trust metadata, conversion paths, and the AI surface.

## The design thesis: Signal Room → Evidence Desk

The experience should have two deliberately different modes:

1. **Signal Room** — the home screen. Cinematic, spatial, alive, and exploratory. It visualizes the information environment and creates emotional entry into the mission.
2. **Evidence Desk** — every reading and action surface. Quieter, denser with proof, easier to scan, and explicit about what is known, sourced, assessed, disputed, or corrected.

The landing screen earns attention. The evidence desk earns trust.

The target feeling is a combination of a national archive, an investigative desk, and a premium editorial publication—not a generic SaaS dashboard and not a game HUD.

## What must be preserved

- The crowned lion as the primary brand asset.
- The midnight navy, warm gold, signal blue, and restrained ember palette.
- The intelligence-scan metaphor on the landing experience.
- The existing type triad: ceremonial serif, highly legible sans, and mono for evidence metadata.
- The thin-line geometry and generous desktop rhythm.
- The restrained writing tone used for October 7 and Our Heroes.
- The refusal to look like a generic news site.

## What must change

- Eight equally weighted navigation nodes need to become a clear hierarchy based on urgency and user intent.
- The blurry glowing section glyphs need to become a coherent, high-quality symbol family.
- The universal prose dossier needs to split into section-specific product archetypes.
- Decorative scan text must stop competing with reading, especially on mobile and memorial pages.
- “Monitoring · active” and similar metadata must communicate real state, not atmosphere.
- The mobile home needs its own composition instead of a compressed desktop orbit.
- Ask the Lion must stop covering content and must expose an unmistakable, accessible state.
- Trust needs to become visible in the interface through sources, verification status, timestamps, correction history, and accountable authorship.

## Design principles for the rebuild

1. **Atmosphere is not information.** Signal noise may set the mood, but it may never carry essential meaning or compete with content.
2. **Status labels are promises.** “Live,” “active,” “verified,” and “updated” appear only when backed by real product state.
3. **Format follows the reader’s question.** A war update is a feed, history is a timeline, testimony is a record, a person is a profile, and support is an action flow.
4. **Evidence appears near the claim.** Sources are not a footer afterthought; provenance travels with the item.
5. **Reporting and assessment remain visibly separate.** This distinction should be structural, not only stated in prose.
6. **Emotional context changes the visual mode.** Monitoring can feel active. Memorial and testimony surfaces must feel still, respectful, and human.
7. **Mobile is an authored composition.** It is not the desktop canvas squeezed into 390px.
8. **AI is subordinate to the evidence system.** Ask the Lion should explain and navigate sourced material, not become a competing oracle.

## Evidence walkthrough: all 12 captured states

### 1. Desktop landing scan — mixed health

![Desktop landing scan](./01-home-intro.png)

**What works:** The central lion is memorable, premium, and unusually ownable. The negative space and orbit create intrigue. The scan corpus establishes the mission without a conventional hero block.

**What fails:** A first-time visitor is not told the product name, value proposition, current priority, or what selecting a circle will do. All eight destinations carry equal weight, so “what is happening now,” “understand the context,” and “support the organization” compete as peers. Background category labels occasionally become louder than the navigation.

**Redesign:** Keep the lion and spatial field, but add a discreet identity/value layer and three levels of intent: **Now**, **Understand / Verify**, and **Trust / Participate**. Give the latest verified brief one unmistakable primary entry. Treat the small floating lion as the AI action, not a duplicate brand ornament.

### 2. Israel’s Story — mixed health

![Israel's Story](./02-israels-story.png)

**What works:** The ceremonial title, calm measure, and “long arc” framing are appropriate.

**What fails:** The page promises chronology, dates, places, and sources but presents only explanatory prose. It looks structurally identical to every other section.

**Redesign:** Build an era-based timeline with anchor events, maps, primary and secondary sources, “what is contested” notes, and a curated reading path. Let readers move between overview and evidence without losing chronology.

### 3. Geopolitical Brief — weak product delivery

![Geopolitical Brief](./03-geopolitical-brief.png)

**What works:** The distinction between reporting and assessment is credible, and the visual tone suits strategic analysis.

**What fails:** There is no dated brief, executive summary, map, development list, source stack, author, revision time, or update log. The screen explains a product instead of being the product.

**Redesign:** Make this the first real vertical slice: timestamped brief, “what changed,” map/context, verified developments, separate assessment, known unknowns, source stack, revision history, related items, share, and subscribe.

### 4. Support Us — critical conversion gap

![Support Us](./04-support-us.png)

**What works:** The copy identifies credible contribution modes and avoids manipulative fundraising language.

**What fails:** There is no action. Volunteer, contribute skills, amplify, contact, and donate are text concepts rather than completion paths.

**Redesign:** Begin with a contribution chooser—**Give time**, **Contribute expertise**, **Share verified material**, **Fund the work**—then expose a short, concrete flow for each. Show current needs, time commitment, privacy expectations, and a clear confirmation state.

### 5. War Update — weak product delivery

![War Update](./05-war-update.png)

**What works:** Verified / reported / disputed is a strong editorial model.

**What fails:** There is no time-stamped feed, filter, location, change log, source provenance, or visible freshness. “Monitoring · active” reads as simulated state on a static explainer.

**Redesign:** Use a reverse-chronological update stream with time zone, region, status, source count, last material change, and filters. Separate front-line reporting from home-front information. Avoid speculative operational detail and label uncertainty plainly.

### 6. October 7 — at risk despite respectful copy

![October 7](./06-october-7.png)

**What works:** The language is careful and the conceptual separation between record, testimony, and remembrance is right.

**What fails:** The moving misinformation corpus behind testimony and remembrance creates the wrong emotional register. There are no evidence records, witness entries, provenance controls, content warnings, or consent indicators.

**Redesign:** Create a quiet archive mode with no moving scan layer. Offer three clear pathways: **The record**, **Testimony**, and **Remembrance**. Add content warnings, media controls, chain of custody/provenance, consent and attribution, translations, and corrections. Never autoplay sensitive media.

### 7. Our Heroes — weak structural fit

![Our Heroes](./07-our-heroes.png)

**What works:** The copy explicitly resists reducing people to statistics.

**What fails:** The interface does exactly that by providing no people—no names, portraits, roles, places, biographies, or family-approved stories. The generic dossier template makes a human section feel institutional.

**Redesign:** Use portrait-led profile cards and individual story pages. Support role/place/date filters only if they help discovery without reducing dignity. Include approval/attribution notes, related testimony, and a calm memorial presentation.

### 8. Fake Resistance — high potential, incomplete product

![Fake Resistance](./08-fake-resistance.png)

**What works:** The “supply chain of outrage” is the strongest native fit for the scan metaphor and could become a distinctive investigative product.

**What fails:** The full chain remains prose. The title also pre-judges the case before evidence is shown.

**Redesign:** Consider a professional framing such as **Influence Operations** with “Fake Resistance” as an editorial series. Visualize a case as **claim → origin → amplifiers → cross-platform spread → evidence → correction**. Include media provenance, timestamps, confidence, related accounts, and a shareable fact-check card.

### 9. We Are — mixed health

![We Are](./09-we-are.png)

**What works:** The mission and evidence-first method are concise and credible.

**What fails:** The page asks for institutional trust without showing governance, people, funding, corrections, AI policy, partnerships, or contact details.

**Redesign:** Turn it into the organization’s trust center: mission, named roles, editorial method, review process, correction policy, funding/independence, privacy, AI use, security/contact, and published accountability metrics where available.

### 10. Mobile landing — at risk

![Mobile landing](./10-mobile-home.png)

**What works:** The navigation targets are generous and the lion retains impact at small width.

**What fails:** The composition reads like a long poster. There are large dead zones, clipped atmospheric labels, no orientation, and no hierarchy. The floating lion sits dangerously close to the device edge.

**Redesign:** Author a mobile-specific home: compact crest and value proposition, a **Latest verified** card, then a two-column grouped section grid. Keep the orbit as an optional “Explore the scan” mode rather than the required navigation. Use `100dvh` and safe-area insets.

### 11. Mobile reading — weak health

![Mobile Geopolitical Brief](./11-mobile-geopolitical-brief.png)

**What works:** The main text reflows without horizontal clipping, and body size/leading are broadly readable.

**What fails:** More than half the first viewport is consumed before the first section. Metadata is tiny, the long tracked title wraps awkwardly, the scan corpus crosses the reading surface, and page identity/navigation disappear after scrolling. The floating lion overlaps the text column.

**Redesign:** Use a 52–60px sticky reading header with Back, section title, progress, and a compact Ask action. Move file/status metadata into a disclosure. Use a nearly opaque reading surface, 20–24px gutters, reduced tracking, and modular content rather than uninterrupted paragraphs.

### 12. Mobile Ask activation — P0 interaction risk

![Mobile chat activation](./12-mobile-chat-click-no-panel.png)

**What the screenshot proves:** Activation produces a gold ring but no visible panel or useful loading/error state, while the launcher obscures the article and the “Reading the Map” section.

**Evidence conflict:** The repository roadmap says chat opening/focus behavior has worked in a real Chrome run. Therefore the screenshot alone should not be treated as final proof of a current application bug. It does prove an ambiguous visual state and content obstruction. Reproduce in real Chrome and cross-browser before closing or escalating the functional defect.

**Redesign:** On mobile, use a reserved bottom dock and open an accessible bottom sheet. On desktop, use a side sheet. The trigger needs `aria-expanded`/`aria-controls`; the sheet needs a title, close target, focus trap, Escape/Back behavior, focus return, loading/error states, and no obscured reading text. If the feature is not ready, do not expose an apparently functional production control.

## Proposed information architecture

The current eight-node model mirrors internal content areas. The revised structure should mirror user intent:

### Latest

- Geopolitical Brief
- War Update

### Verify

- Influence Operations / Fake Resistance
- Ask the Lion, scoped to sourced material

### Understand

- Israel’s Story
- Topic explainers and timelines

### People & Record

- October 7
- Our Heroes

### Trust & Participate

- We Are
- Support Us

On the landing page, the first four user actions should be immediately legible:

1. Read the latest verified brief.
2. Verify a claim or narrative.
3. Understand historical context.
4. Read testimony and stories of people.

About and Support remain easy to find, but they should not compete visually with urgent information.

## The universal trust contract

Every factual item—brief, update, investigation, event, testimony, or profile—should expose the following consistently:

- Publication date, last material update, time, and time zone.
- Status: **Confirmed**, **Attributed**, **Unverified**, **Disputed**, or **Corrected**.
- Author and reviewer/editor where appropriate.
- Source list and source type: primary, official, open-source, witness, media, or analysis.
- Clear structural separation between reporting and assessment.
- Known unknowns and confidence limitations.
- What evidence would change the assessment.
- Stable URL and source-complete sharing.
- Version and correction history.
- Content warning, consent, and translation metadata where human testimony is involved.

Status must never rely on color alone. Each state needs text and, where useful, a shape/icon.

## Product archetypes instead of one universal page

### A. Live intelligence — Geopolitical Brief and War Update

Core modules:

- Timestamped executive snapshot.
- “What changed since the previous update.”
- Structured development cards.
- Map or geographic context only when it adds meaning.
- Status, provenance, and source stack per development.
- Reporting and assessment in separate visual regions.
- Known unknowns, watch list, and update log.
- Related context, share, and subscribe.

### B. Investigation and verification — Influence Operations

Core modules:

- The claim exactly as circulated.
- Origin and first observed timestamp.
- Propagation path and amplifier groups.
- Media provenance and forensic evidence.
- Confidence and competing explanations.
- Correction/verdict and shareable evidence card.
- Related investigations and correction history.

### C. Historical context — Israel’s Story

Core modules:

- Era navigation and interactive timeline.
- Event overview, date, geography, and consequence.
- Primary and secondary source groups.
- “What is agreed / what is contested.”
- Maps, documents, and reading paths.
- Cross-links into current briefs without collapsing history into current politics.

### D. Testimony and memorial — October 7 and Our Heroes

Core modules:

- Quiet visual shell with no active signal field.
- Content warning and user-controlled media.
- Testimony/profile cards with human-first imagery.
- Attribution, consent, translation, and archival provenance.
- Related people, places, and events.
- Remembrance actions that do not gamify grief.

### E. Institutional trust and participation — We Are and Support Us

Core modules:

- Named people/roles and governance.
- Editorial method, review, corrections, independence, funding, privacy, and AI policy.
- Current volunteer needs with time/skill expectations.
- Short contribution flows and clear confirmation states.
- A share kit built from already verified material.
- Donation only when the legal, financial, privacy, and receipt flow is ready.

## Detailed page blueprints

### Geopolitical Brief

1. Dated title and last-updated status.
2. Five-sentence executive snapshot.
3. “What changed” list.
4. Region map or actor relationship diagram.
5. Verified developments with source stacks.
6. Separate assessment.
7. Known unknowns and watch list.
8. Update/correction history.
9. Sources, related context, share, subscribe.

### War Update

1. Freshness and coverage scope.
2. Region/front filters.
3. Reverse-chronological feed.
4. Status and provenance per update.
5. Material-change summaries rather than repetitive entries.
6. Separate home-front information.
7. Corrections and archive.

### Influence Operations / Fake Resistance

1. Case overview and current verdict.
2. Original claim/media.
3. Timeline of spread.
4. Origin/amplifier network.
5. Forensic evidence.
6. Alternative explanations and confidence.
7. Correction and share card.
8. Related campaigns.

### Israel’s Story

1. Era navigator.
2. Scrollable/zoomable timeline with accessible list alternative.
3. Event detail with geography.
4. Sources grouped by type and perspective.
5. Contested interpretations labeled as such.
6. Reading lists and related present-day explainers.

### October 7

1. Calm entry and content preferences.
2. Choose: Record, Testimony, Remembrance.
3. Evidence archive with provenance.
4. Testimony with consent and translation.
5. Remembrance profiles.
6. Correction/contact mechanism.

### Our Heroes

1. Human-first introduction.
2. Profile discovery, not a statistical dashboard.
3. Portrait, name, life, role, place, and story.
4. Family/author attribution and approval state where applicable.
5. Related testimony and remembrance.

### We Are

1. Mission and scope.
2. Named leadership/editorial roles.
3. How a claim becomes a publication.
4. Source, correction, privacy, security, and AI policies.
5. Funding/independence and partners.
6. Contact and accountability.

### Support Us

1. Contribution chooser.
2. Current, specific needs.
3. Skill/time/privacy expectations.
4. Minimal form or clear external completion path.
5. Confirmation and next step.
6. Share kit and optional donation flow when ready.

## Visual system upgrade

### 1. Icon family

This is the clearest craft mismatch in the current interface. The section icons are blurred, over-glowed, and visibly sit inside black squares, while the lion is detailed and premium.

Create eight related symbols with:

- A common optical box and stroke/mass.
- Transparent backgrounds—no baked black square.
- Restrained metallic gold rather than yellow-white bloom.
- Crisp vector/SDF output at every size.
- One controlled halo only in the landing node’s active state.
- The same symbol continuity from landing node to section header.

### 2. Typography

- Reserve the ceremonial serif and wide tracking for page titles and true memorial moments.
- Use sans for functional section headings, status, actions, and dense UI.
- Use mono only for verifiable metadata, timestamps, source IDs, and system state.
- Reduce letter spacing on mobile and for long titles.
- Mobile body target: 16–17px with 1.6–1.7 line height.
- Mobile metadata target: at least 12px with comfortable leading.
- Keep long-form measures around 60–72 characters where layout allows.

### 3. Semantic color

- Gold: identity, emphasis, and primary navigation—not generic status.
- Blue: verified/source-linked information.
- Amber: attributed/reporting pending independent confirmation.
- Neutral gray: unknown or not yet assessed.
- Ember/rose: disputed, correction, or warning—used sparingly.
- Human/memorial sections: warmer neutral imagery and quieter gold.

Every semantic state also needs a text label and non-color cue.

### 4. Surfaces and background

- **Scan mode:** active corpus, depth, parallax, and atmospheric labels.
- **Reading mode:** corpus frozen, heavily muted/blurred, and masked behind a 96–100% opaque reading surface.
- **Memorial mode:** corpus off; static, quiet background.
- Replace the single giant framed prose slab with modular evidence surfaces while keeping the thin-line DNA.

### 5. Motion

- Motion belongs primarily to discovery and live-update transitions.
- Reading motion should be minimal and never run under long text.
- Memorial/testimony pages should be still.
- Respect `prefers-reduced-motion`; any non-essential motion lasting more than five seconds needs a pause/stop path.

## Desktop landing redesign

Keep the radial intelligence field, but give it product hierarchy:

- A discreet “Lions of Zion” identity and one-sentence promise.
- A visible “Latest verified” signal with timestamp.
- **Now:** Geopolitical Brief and War Update receive primary scale/contrast.
- **Understand / Verify:** Israel’s Story, Influence Operations, October 7, and Our Heroes form the second tier.
- **Trust / Participate:** We Are and Support Us become tertiary but persistent.
- Hover/focus reveals one-sentence descriptions and freshness; click targets remain full nodes.
- Background labels remain decorative, clipped/faded at edges, non-interactive, and hidden from assistive technology.

## Mobile landing redesign

Do not reproduce the full desktop orbit as the default path.

Recommended order:

1. Compact crest, product name, and one-sentence promise.
2. A “Latest verified” card with freshness and status.
3. Two-column grouped grid for the primary sections.
4. Trust/Support links.
5. Optional “Explore the scan” immersive mode.
6. Reserved Ask the Lion bottom dock with safe-area padding.

The DOM order must match the visual reading order. Every section is a real link with a 44px minimum target and visible focus/pressed state; the background corpus is `aria-hidden` and cannot cause horizontal overflow.

## Reading shell redesign

### Desktop

- Compact persistent global navigation.
- A useful dossier header: section, date/freshness, verification status, author/reviewer, and actions.
- A modular main column plus optional evidence/source rail.
- Section-local table of contents for long records.
- Next/related content and archive/search entry.

### Mobile

- 52–60px sticky header with Back, compact page identity, progress, and Ask action.
- Move file number, route, and extended status into a disclosure.
- 20–24px page gutter and nearly opaque reading surface.
- Reserve layout space for the bottom dock; no floating control may cover text.
- Route changes scroll to the top and move focus to the new `h1`.
- Use `100dvh` and `env(safe-area-inset-*)`.

## Ask the Lion product pattern

The useful proposition is not “chat with a lion.” It is **ask a sourced question about this brief, claim, event, or source set**.

Requirements:

- Contextual starters such as “What is verified?”, “Show the sources,” and “What remains unknown?”
- Citations that open the exact source or evidence item.
- Explicit separation between extracted fact, synthesis, and assessment.
- Visible uncertainty and refusal when evidence is insufficient.
- Current-page context plus an obvious way to broaden the query.
- Desktop side sheet; mobile bottom sheet; full keyboard and screen-reader behavior.
- Loading, offline, empty, failure, and rate-limit states.
- No silent ingestion of sensitive testimony without an approved policy.
- Analytics should measure useful evidence navigation, not merely message count.

## Mobile and accessibility acceptance requirements

Validate at 320, 360, 390, and 430px, plus landscape:

- No horizontal scroll or clipped functional text.
- No fixed control obscures text, focus, or input.
- Minimum 44×44px interactive targets.
- Visible, non-clipped focus indicator.
- 200% browser zoom and increased text size remain usable.
- Keyboard order follows visual order.
- Background scan text is decorative and excluded from the accessibility tree.
- Dialog focus trap, close, Escape/Back, and focus return work.
- VoiceOver/TalkBack announce controls, statuses, headings, and updates meaningfully.
- Reduced motion produces a stable experience.
- Contrast is measured in implementation; screenshots alone cannot prove WCAG conformance.
- Safari dynamic toolbars and safe-area behavior are tested on a real iOS device.

## Phased redesign and implementation plan

### Phase 0 — Product and evidence alignment

**Goal:** Stop designing around placeholders.

Deliverables:

- Choose one real Geopolitical Brief with approved content and sources.
- Finalize status taxonomy, source taxonomy, correction model, and authorship rules.
- Decide which labels represent real live state and remove simulated ones.
- Reproduce the Ask launcher in real Chrome, Safari, and mobile emulation/device.
- Inventory sensitive content, consent, rights, translation, and legal review needs.

Exit criterion: one approved, source-complete item can populate the entire trust contract.

### Phase 1 — Design foundations and three reference screens

**Goal:** Establish the system before multiplying pages.

Deliverables:

- New icon family.
- Tokens for typography, semantic status, surfaces, focus, safe areas, and motion.
- Scan, reading, memorial, and dialog modes.
- Visual specifications for: desktop home, mobile home, and one real Geopolitical Brief.
- Responsive shell, sticky navigation, progress, source rail, and mobile dock patterns.

Exit criterion: the three reference screens work as one coherent system from 320px through desktop and pass design/accessibility review.

### Phase 2 — Build the Geopolitical Brief vertical slice

**Goal:** Prove product value, not just visual direction.

Deliverables:

- Real dated brief with structured modules.
- Status, author/reviewer, sources, reporting/assessment, known unknowns, and corrections.
- Share, related context, and subscription entry.
- Loading, empty, stale, and error states.
- End-to-end browser, keyboard, mobile, and visual-regression coverage.

Exit criterion: a reader can understand what changed, why it matters, what supports it, and what remains uncertain without leaving the page.

### Phase 3 — Expand live and investigative products

**Goal:** Reuse the trust system without forcing the same layout.

Deliverables:

- War Update chronology and filters.
- Influence Operations case-file/propagation visualization.
- Shared evidence, source, status, correction, and sharing components.
- Search/archive entry for current reporting.

Exit criterion: War and Influence Operations feel related to the brief but structurally fit their own tasks.

### Phase 4 — Build context, testimony, and human records

**Goal:** Create distinct, emotionally appropriate archive experiences.

Deliverables:

- Israel’s Story timeline and source library.
- October 7 record/testimony/remembrance paths with content controls.
- Our Heroes profile system and provenance/approval metadata.
- Memorial visual mode and sensitive-media policy implementation.

Exit criterion: no human story is presented through the generic live-monitoring template.

### Phase 5 — Trust and participation

**Goal:** Make institutional credibility and support actionable.

Deliverables:

- We Are trust center and policies.
- Support contribution chooser and completion flows.
- Contact, correction request, volunteer, share-kit, and—only when ready—donation paths.
- Confirmation, privacy, abuse-prevention, and operational ownership states.

Exit criterion: every action has an owner, response expectation, privacy statement, and visible success/failure state.

### Phase 6 — Ask the Lion and distribution

**Goal:** Add AI only after the evidence model is reliable.

Deliverables:

- Citation-grounded answers scoped to published evidence.
- Desktop side sheet and mobile bottom sheet.
- Uncertainty/refusal, feedback, safety, privacy, and failure states.
- Source-complete sharing, subscriptions, and notification preferences.

Exit criterion: every substantive answer can show its basis, and the AI never obscures or outranks the source material.

### Phase 7 — Hardening and scale

**Goal:** Make the rebuilt experience production durable.

Deliverables:

- WCAG-focused assistive-technology testing.
- Real-device matrix, visual regression, performance budgets, and monitoring.
- Internationalization and RTL/LTR layout rules.
- Editorial workflow, corrections SLA, stale-content handling, and archive policy.
- SEO/social metadata and stable canonical/share URLs.

Exit criterion: quality is measurable and enforceable, not dependent on manual visual review.

## Priority stack

### P0 — before visual polish

- Reproduce/fix or temporarily remove the ambiguous Ask state.
- Stop the mobile launcher from obscuring article text.
- Introduce a true reading surface and a quiet memorial mode.
- Remove or correct simulated “live/active” status.
- Establish the trust contract with one real brief.

### P1 — system-defining work

- Redesign the desktop and mobile landing hierarchy.
- Replace the icon family.
- Build the responsive reading shell.
- Implement the Geopolitical Brief vertical slice.
- Define semantic statuses, typography, focus, and motion tokens.

### P2 — product breadth

- War Update and Influence Operations.
- Israel’s Story, October 7, and Our Heroes archetypes.
- We Are trust center and Support conversion flows.

### P3 — leverage and scale

- Ask the Lion grounded experience.
- Search, subscriptions, sharing, multilingual support, and operational hardening.

## Success criteria

### Orientation

- In a five-second first-impression test, a new visitor can state what Lions of Zion does and identify the latest verified item.
- Users can distinguish “latest,” “verify,” “understand,” “people/record,” and “participate” without opening every node.

### Trust

- 100% of factual items expose status, freshness, source provenance, authorship/review, and correction history as applicable.
- Reporting and assessment are visibly distinct in every relevant format.
- No “live” or “active” state exists without a defined data source and freshness rule.

### Reading and accessibility

- Zero article text is obscured at 320–430px.
- Core flows remain usable at 200% zoom, with keyboard and screen reader.
- Motion and decorative signal text never interfere with reading or sensitive content.

### Product value

- The latest brief can be understood, verified, and shared with its sources.
- Support has at least one fully working completion path.
- AI answers, when launched, navigate readers to evidence rather than replacing it.

## Dependencies and major risks

- **Editorial supply:** The design will fail again if real, structured content is not available during the vertical slice.
- **False freshness:** Automated-looking UI without reliable update operations damages trust more than a clearly static archive.
- **Rights and consent:** Testimony, portraits, and sensitive media require explicit ownership and approval workflows.
- **Over-animation:** The successful signal-room aesthetic can become visual noise when reused everywhere.
- **AI trust:** A polished chat surface without grounded citations would contradict the organization’s evidence-first claim.
- **Template pressure:** Shared components are useful, but shared page structure must not erase differences between news, evidence, history, testimony, people, and action.

## Relationship to the existing `TODOS.md`

The repository’s `TODOS.md` is already a strong engineering backlog. It covers many of the necessary implementation areas: intro/mobile, navigation/chat, shell/accessibility, content modeling, section families, AI, SEO/i18n, performance, and testing.

This second-pass plan is the design layer above that backlog. It adds:

- The **Signal Room → Evidence Desk** product doctrine.
- A user-intent information architecture.
- Five distinct content archetypes.
- The universal trust contract.
- Emotional modes for live, reading, and memorial contexts.
- Three reference screens as the system gate.
- Exit criteria that prevent broad implementation before one real vertical slice proves the model.

The recommended execution order is therefore: use the existing backlog, but gate it through Phase 0, the three reference screens, and the real Geopolitical Brief before rolling the pattern across all destinations.

## Evidence limits

This review is grounded in the 12 supplied captures and repository structure. A screenshot can establish visual hierarchy, obstruction, density, and rendered state; it cannot prove DOM order, numeric contrast, accessible names, focus behavior, reduced-motion behavior, screen-reader support, or a reproducible application defect. Those claims require real-browser and assistive-technology verification.
