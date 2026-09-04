# LIONS OF ZION — Graphics Production Prompt Library

Date: 2026-09-04  
Status: Prompt and brief authoring complete. No graphics, SVGs, assets, UI, CSS, or production implementation were created.

## 1. Scope and source reconciliation

This library turns the current visual audit into production-ready briefs. It is not an image-generation run and it is not an implementation specification for the application.

The authoritative visual baseline is the current repository file:

- `GRAPHICS-BROWSER-AUDIT.md` — current G-ID set, routes, findings, priorities, and mobile supplement.
- `GRAPHICS-PHASE-0-FUNCTIONAL-REPORT.md` — authoritative behavior for Search, Ask, Account, and the safe-media boundary.
- `GRAPHICS-SYSTEMS-PLAN.md` — reusable systems, A-IDs, UX dependencies, and mobile strategy.
- `GEOPOLITICAL_BRIEF_REBUILD_TODOS.md` — consulted only for source/evidence terminology and operational constraints; it does not add a graphics requirement or a G-ID.
- Existing repository assets and screenshots — inspected before classifying requirements.

### G-ID reconciliation

The authoring instruction document describes a possible newer 21-item numbering set. The current repository audit actually contains the complete authoritative set `G-001` through `G-029`, including the Mobile & Responsive Graphics Supplement. The 21-item list is therefore treated as superseded planning shorthand, not as a second numbering system.

This library uses only the current 29 G-IDs. No new G-ID is created. No current G-ID is marked superseded because every current audit requirement remains present in the source-of-truth audit.

Phase 0 behavior is not folded into artwork. Graphics must expose the state that the application already knows; they must never merge, conceal, or invent functional states.

## 2. Existing asset inspection and disposition

| Existing material inspected | Finding | Disposition |
|---|---|---|
| `assets/brand/generated-2026-08-28/01-primary-crowned-lion-logo.png` | Approved crowned lion master, 1254 × 1254 | REUSE / DERIVE only; never redraw with an image model |
| `assets/brand/generated-2026-08-28/02-lz-monogram.png` | Approved transparent monogram, 1254 × 1254 | REUSE / DERIVE for compact mark |
| `assets/brand/generated-2026-08-28/04-lionsofzion-wordmark.png` | Approved wordmark, 1922 × 818 | REUSE / normalize lockup |
| `assets/brand/generated-2026-08-28/06-homepage-hero.png` | Approved lion hero, 1672 × 941 | REUSE / responsive crop derivative |
| `assets/brand/generated-2026-08-28/09-site-background-texture.png` | Approved scan/field texture, 1254 × 1254 | REUSE / derive tiered CSS/SVG density |
| `app/icon.svg`, `app/favicon.ico`, `public/icon-192.png`, `public/icon-512.png` | Existing application icon and favicon family | REUSE / VALIDATE; no replacement generation |
| `public/emblems/*.svg` | Existing section emblems | REUSE as current references; do not create a parallel emblem language |
| `components/ui/StatusState.tsx` and `components/ui/status-state.module.css` | Existing status primitive with explicit kinds and ARIA behavior | REUSE as the host for A-008/A-009 |
| `components/content/SensitiveContent.tsx` and archive media components | Covered-by-default, explicit reveal, reversible safe-media boundary | REUSE behavior; create only abstract covered-media frame treatment |
| `screenshots/graphics-audit/` and `screenshots/graphics-phase-0/` | Browser evidence for desktop, mobile, and functional states | REFERENCE only; never reproduce screenshot text as baked artwork |

### Disposition rules

- `REUSE`: use the approved asset as-is, with sizing and placement rules only.
- `DERIVE`: make a deterministic vector, crop, lockup, or export from an approved source; no visual reinvention.
- `CREATE`: produce a new shared system or bespoke data-driven composition.
- `UX ONLY`: the requirement is interaction/layout behavior; do not create a unique image.
- `OPTIONAL`: defer until visual testing proves a real need.
- `DO NOT GENERATE`: use real, approved, source-backed material or existing branding only.

## 3. Current G-ID → system → asset mapping

| New G-ID | System | Asset package | Old reference if applicable |
|---|---|---|---|
| G-001 | SYS-01 + SYS-03 | A-001 + A-008 | Same G-001 in the existing plan |
| G-002 | SYS-01 | A-001 + A-002 + A-004 | Same G-002 in the existing plan |
| G-003 | SYS-01 | A-003 | Same G-003; existing hero |
| G-004 | SYS-06 | A-012 | Same G-004 |
| G-005 | SYS-02 | A-005 | Same G-005 |
| G-006 | SYS-03 | A-008 + A-009 | Same G-006 |
| G-007 | SYS-02 | A-005; no unique asset | Same G-007 |
| G-008 | SYS-04 + SYS-06 | A-006 + A-007 + A-012 | Same G-008 |
| G-009 | SYS-07 | A-015 | Same G-009 |
| G-010 | SYS-02 + SYS-07 | A-013 + A-014 | Same G-010 |
| G-011 | SYS-05 | A-010 | Same G-011 |
| G-012 | SYS-07 | A-016 | Same G-012 |
| G-013 | SYS-02 | A-005 | Same G-013 |
| G-014 | SYS-03 + SYS-04 | A-008 + A-009; compact marker only | Same G-014 |
| G-015 | SYS-03 | A-008 + A-009 | Same G-015 |
| G-016 | SYS-03 | A-008 + A-009 | Same G-016 |
| G-017 | SYS-03 | A-008 + A-009; no unique account art | Same G-017 |
| G-018 | SYS-02 | A-005; no mobile keyboard graphic | Same G-018 |
| G-019 | SYS-03 | A-008 + A-009 | Same G-019 |
| G-020 | SYS-02 + SYS-04 | A-006 + A-007 | Same G-020 |
| G-021 | SYS-05 | A-006 + A-010 | Same G-021 |
| G-022 | SYS-02 | A-005; text/selector treatment | Same G-022 |
| G-023 | SYS-05 | A-006 + A-011 | Same G-023 |
| G-024 | SYS-03 | A-008 + A-009 | Same G-024 |
| G-025 | SYS-02 + SYS-04 | A-007 | Same G-025 |
| G-026 | SYS-06 + SYS-07 | A-012 + A-013 + A-014 | Same G-026 |
| G-027 | SYS-06 | A-017 | Same G-027 |
| G-028 | SYS-04 | A-006 + A-007 | Same G-028 |
| G-029 | SYS-04 | A-007 | Same G-029 |

There are no superseded current G-IDs. The old architecture is retained where it maps cleanly; the library consolidates output into shared packages rather than producing one asset per page.

## 4. Global production contract

Every package below inherits this contract unless a package explicitly overrides it.

### Brand visual language

- Near-black field and warm cream foreground.
- Restrained gold accent; use existing token roles rather than hard-coded decorative colors.
- Editorial serif environment for headings and text environment for reading copy.
- Monospace metadata environment for IDs, dates, source labels, and status.
- Dossier, archive, evidence-desk, and registration geometry.
- Thin structural rules, scan/signal/register motifs, and controlled information density.
- HTML text remains live and editable. Do not bake labels, claims, dates, source names, logos, or headlines into generated artwork.

### Forbidden visual language

No generic SaaS illustration, glossy 3D, cyberpunk neon, hologram, gaming aesthetic, military propaganda poster, flames, explosions, battlefield imagery, generic news photography, random gradient, stock-photo composition, robot, chatbot avatar, AI face, sparkle, magic wand, fabricated document, invented post, invented headline, invented face, invented logo, or decorative fake data.

### Accessibility and responsive baseline

- Every meaningful symbol has a visible label or an accessible name.
- Decorative motifs are `aria-hidden`; they never carry the state alone.
- Interactive graphic controls use the existing button/link primitives and at least 44 × 44 CSS pixels for touch.
- Preserve visible focus using the existing focus token.
- Do not rely on color, motion, hover, or texture as the sole state signal.
- Respect `prefers-reduced-motion`; state changes remain understandable without animation.
- Mobile composition is defined at 375, 390, and 430 CSS pixels; tablet composition is considered at 768 CSS pixels where the audit identified a layout change.
- No horizontal overflow. If a data visualization cannot be meaningfully reduced, use the specified mobile UX instead of shrinking it.

### Functional truth

- Search must support: idle, invalid-query, loading, results, no-results, fallback, error.
- Ask must support: idle, ready, submitting, loading, success-with-sources, insufficient-evidence, no-answer, error, retry/edit.
- Account must support: checking, signed out, signed in, unavailable, error, retry.
- October 7 protected media is `covered` until an explicit user action, and the reveal is reversible.
- Graphic systems must not invent a state or imply evidence that the data layer does not provide.

# 5. Canonical production briefs

## A-001 — Canonical compact lion / crown vector master

**Related G-IDs:** G-001, G-002  
**System:** SYS-01 Brand Identity & Hero Family  
**Production Type:** DERIVATIVE  
**Disposition:** DERIVE from approved brand material  
**Purpose:** Provide a deterministic compact lion/crown mark for constrained shell, intro, and brand contexts.  
**Placement:** Header compact mark, intro identity layer, constrained lockups, app-brand contexts.  
**Desktop Composition:** Use the approved lion/crown or monogram at the existing optical size; do not force a compact mark where the full lockup fits.  
**Mobile Composition:** Preserve the crown/lion silhouette at 24–32 CSS pixels where used as a mark; maintain clear space and do not add detail that disappears below 24 pixels.  
**Visual Language:** Existing Lions of Zion identity only; no new lion anatomy or crown design.  
**Geometry:** Vector-clean approved contours; optically balanced circular/compact bounding box; preserve the mark's existing negative space.  
**Color Rules:** `currentColor` for UI use; approved gold/cream/monochrome exports only. No glow, bevel, or gradient.  
**Typography Interaction:** Never replace the wordmark when the full lockup is required; the compact mark is not a textual abbreviation.  
**Required States:** Default, inverse on dark field, muted/disabled only when the surrounding control is disabled.  
**Accessibility Requirements:** Decorative instances `aria-hidden`; linked brand mark has accessible name “Lions of Zion”.  
**Technical Format:** Clean SVG, stable `viewBox`, no embedded raster, no filters, no external references.  
**Reuse Requirements:** Trace or normalize only from `01-primary-crowned-lion-logo.png` and `02-lz-monogram.png`; compare against current `app/icon.svg`.  
**Forbidden Elements:** New lion pose, new crown, extra lettering, facial changes, 3D effects, particles added to the mark.  
**Source/Data Constraints:** Identity source is approved brand art only.  
### Production Prompt

> Create a deterministic, vector-first compact Lions of Zion brand mark by cleaning and normalizing the approved existing lion/crown or LZ monogram source. Do not redesign, reinterpret, or regenerate the lion. Preserve the approved silhouette and negative space. Export a clean SVG with a stable square viewBox, currentColor-compatible fills, no embedded bitmap, no filters, no gradients, no glow, and no text. Provide default cream, approved gold, dark inverse, and monochrome usage through color rather than separate artwork. Optimize the mark for 24–32 CSS pixel UI placement without losing the crown or main silhouette. Include a clear-space rule and accessible-name guidance for linked use.

## A-002 — Brand lockup export pack

**Related G-IDs:** G-002  
**System:** SYS-01  
**Production Type:** DERIVATIVE  
**Disposition:** REUSE / normalize existing material  
**Purpose:** Establish consistent full, stacked, compact, inverse, and monochrome brand lockups.  
**Placement:** Site header, footer, social/OG template, constrained mobile header.  
**Desktop Composition:** Prefer existing wordmark plus approved mark with the current spacing; full lockup is primary where width allows.  
**Mobile Composition:** Use compact mark or stacked lockup only when measured width requires it; never squeeze the horizontal wordmark until it becomes unreadable.  
**Visual Language:** Existing wordmark and approved mark.  
**Geometry:** Preserve wordmark proportions; define minimum display widths from legibility testing, not arbitrary scaling.  
**Color Rules:** Approved cream, gold, dark, and monochrome exports; no new colorway.  
**Typography Interaction:** Wordmark is artwork and must not be recreated with substitute live text.  
**Required States:** Full, stacked, compact, inverse, monochrome, and safe-area variants.  
**Accessibility Requirements:** Alt text/name is “Lions of Zion”; decorative footer instance may be hidden from assistive technology if adjacent text already identifies the organization.  
**Technical Format:** SVG where a vector source exists; PNG exports only for contexts requiring raster; transparent background.  
**Reuse Requirements:** Start with `04-lionsofzion-wordmark.png`, `02-lz-monogram.png`, and existing app icon.  
**Forbidden Elements:** Redrawn wordmark, altered kerning, added slogan, invented seal, fabricated institutional mark.  
**Source/Data Constraints:** No text or mark may be generated by an image model.  
### Production Prompt

> Normalize the existing Lions of Zion lockup into a documented export pack without changing the brand artwork. Use the approved wordmark and compact mark as source material. Produce full horizontal, stacked, compact mark-only, cream-on-dark, gold-on-dark, dark-on-light, and monochrome variants with consistent clear space and optical alignment. Do not redraw the wordmark, alter letterforms, add a slogan, or introduce a new seal. Keep text editable in documentation, but keep the actual logo artwork free of baked UI copy. Deliver vector-first masters plus only the raster exports required by the existing shell and social/OG contexts.

## A-003 — Hero lion responsive crop master

**Related G-IDs:** G-003  
**System:** SYS-01  
**Production Type:** DERIVATIVE  
**Disposition:** REUSE existing hero; derive crop rules only  
**Purpose:** Make the existing crowned lion hero survive wide desktop and portrait mobile composition.  
**Placement:** Homepage hero `/`; desktop hero and mobile hero/fallback.  
**Desktop Composition:** Use `06-homepage-hero.png` in its wide composition; maintain the crown, eyes, muzzle, and signal field.  
**Mobile Composition:** Use a portrait crop/composition that keeps crown and eyes visible, leaves a safe HTML text zone, and does not expose a stretched or accidentally cropped face.  
**Visual Language:** Existing gold particle lion and dark signal field.  
**Geometry:** Preserve source aspect ratio; mobile crop must be tested at 375/390/430 CSS pixels and must not create a horizontal scroll.  
**Color Rules:** Preserve source grade; no extra glow or contrast effect that reduces text legibility.  
**Typography Interaction:** All title, skip, and intro copy remain HTML above a controlled safe zone.  
**Required States:** Intro/reveal, skipped/main, reduced-motion immediate path, fallback if the renderer is unavailable.  
**Accessibility Requirements:** Informative image gets concise alt text; decorative background layer is hidden; skip remains visible and keyboard reachable.  
**Technical Format:** Existing raster/WebP/AVIF or CSS crop; no new illustration.  
**Reuse Requirements:** Use only `06-homepage-hero.png` and the already approved poster/fallback if applicable.  
**Forbidden Elements:** New lion, new particles, added text in the image, face crop that removes eyes/crown, autoplay-dependent behavior.  
**Source/Data Constraints:** No generated or fabricated content.  
### Production Prompt

> Define a responsive crop specification for the approved Lions of Zion homepage lion hero. Do not generate a new image. Use the existing `06-homepage-hero.png` as the sole visual source. For desktop, preserve the wide crowned-lion composition and the existing signal field. For 375–430 CSS pixel mobile, derive a portrait crop that keeps the crown, both eyes, and muzzle readable, reserves a quiet HTML text zone, and avoids stretching or cutting the face. Document the crop anchor, safe text zone, object-position behavior, fallback asset, and reduced-motion path. Do not bake any headline, button, or logo into the image.

## A-004 — Social / OG card template

**Related G-IDs:** G-002  
**System:** SYS-01  
**Production Type:** REUSE  
**Disposition:** REUSE / VALIDATE  
**Purpose:** Keep social and OpenGraph identity aligned with the approved brand.  
**Placement:** Existing `next/og` or metadata generation path.  
**Desktop Composition:** Existing branded card proportions and hierarchy.  
**Mobile Composition:** Not a responsive UI asset; validate social-card crop and safe text area at platform previews.  
**Visual Language:** Approved wordmark, compact mark, dark field, restrained gold.  
**Geometry:** Preserve existing template geometry.  
**Color Rules:** Existing approved tokens/assets.  
**Typography Interaction:** Generated title/meta text must remain data-provided and readable.  
**Required States:** Default and article/title variant.  
**Accessibility Requirements:** Metadata title/description remains authoritative; image is supporting metadata.  
**Technical Format:** Existing template output.  
**Reuse Requirements:** Do not recreate.  
**Forbidden Elements:** Generated logos, fake headlines, fabricated claims.  
**Source/Data Constraints:** Article title and description must come from the actual route/content record.  
### Production Prompt

> Do not create a new OG graphic. Validate the existing Lions of Zion OG template against the approved wordmark, compact mark, dark field, gold accent, and real route metadata. Confirm that supplied titles remain readable without overlap, that no logo is generated or redrawn, and that article/title variants use only actual content. Change only the template's documented placement or safe-area rules if validation identifies a concrete failure.

## A-005 — Core utility and action icon set

**Related G-IDs:** G-005, G-007, G-013, G-018, G-022  
**System:** SYS-02 Core Icon & Action System  
**Production Type:** SVG  
**Disposition:** CREATE one shared family  
**Purpose:** Replace mixed text glyphs and inconsistent utility symbols with one evidence-desk icon grammar.  
**Placement:** Global shell, Search, Ask, filters, support actions, account, archive controls.  
**Desktop Composition:** 20–24 CSS pixel icons in labeled controls; icon-only controls only where the existing accessible name is visible to assistive technology.  
**Mobile Composition:** Same vector geometry inside 44 × 44 CSS pixel targets; do not make the icon itself smaller than 18–20 CSS pixels. Search keyboard hints are hidden/collapsed on touch; actions remain labeled.  
**Visual Language:** Quiet line iconography, precise registration, no illustrative detail.  
**Geometry:** 24 × 24 viewBox; 1.5–2 px optical stroke; round caps/joins where appropriate; align to a 2 px grid.  
**Color Rules:** `currentColor`; state color comes from existing tokens, never from per-icon custom palettes.  
**Typography Interaction:** Labels remain live text; icon never carries a claim that text does not state.  
**Required States:** Default, hover, focus, active/selected, disabled, loading where applicable, external-link.  
**Accessibility Requirements:** Every icon-only button has an accessible name and visible focus; no hover-only meaning.  
**Technical Format:** Individual SVGs or symbol components with stable IDs; no raster export as source.  
**Reuse Requirements:** Audit and preserve useful existing emblems; do not duplicate section emblems as utility icons.  
**Forbidden Elements:** Emoji, platform glyphs, random stroke weights, filled cartoon icons, decorative icon grids.  
**Source/Data Constraints:** Icon meaning must match the action or category; no icon implies verification unless the state is actually verified.  
### Production Prompt

> Create one coherent 24×24 SVG utility/action icon family for Lions of Zion. Include search, Ask, menu, close, clear, arrow, chevron, external link, filter, calendar, open, share, report, donate, volunteer, and account only where those actions exist. Use a quiet evidence-desk line grammar with a 1.5–2 px optical stroke, currentColor, stable viewBox, consistent cap/join rules, and no decorative detail that disappears below 20 CSS pixels. Provide default, active, disabled, and focus-compatible use guidance; do not encode state by color alone. The same vectors must work inside 44×44 touch targets. Do not use emoji, text glyphs, invented symbols, or separate page-specific icon styles. Preserve live labels and accessible names outside the SVG.

## A-006 — Record and media type icon set

**Related G-IDs:** G-008, G-020, G-021, G-023, G-028  
**System:** SYS-02 + SYS-04 + SYS-05  
**Production Type:** SVG  
**Disposition:** CREATE shared subset  
**Purpose:** Give records and safe archive media a stable type language.  
**Placement:** Brief cards, Updates, Search results, October 7 archive cards, media boundary.  
**Desktop Composition:** 20–24 CSS pixel leading marker paired with a text label or metadata.  
**Mobile Composition:** 20–24 CSS pixel marker in a single-column rail; labels wrap without shifting the icon out of alignment.  
**Visual Language:** Abstract dossier/record symbols, not illustrations of historical events.  
**Geometry:** 24 × 24 viewBox; distinct silhouettes for brief, War Update, Narrative Watch, testimony, documentation, film, photograph, source, actor, and location.  
**Color Rules:** currentColor with semantic state color supplied by the host; no category rainbow.  
**Typography Interaction:** Category name remains visible; icon is a reinforcement, not a replacement.  
**Required States:** Default, selected, unavailable, covered/on-request for media.  
**Accessibility Requirements:** Decorative icon hidden when label exists; otherwise accessible label is provided.  
**Technical Format:** SVG symbols/components.  
**Reuse Requirements:** Align with existing `public/emblems/*.svg`; do not replace those emblems or treat them as evidence.  
**Forbidden Elements:** Camera-realism, blood, weapons, flames, graphic media, invented organizational logos.  
**Source/Data Constraints:** Type is derived from the actual record/media type field.  
### Production Prompt

> Create a shared 24×24 SVG record/media type icon subset for Lions of Zion: brief, War Update, Narrative Watch, testimony, documentation, film, photograph, source document, actor, and location. Keep every symbol abstract, quiet, and legible at 20 CSS pixels. Use one line/shape grammar, currentColor, stable viewBox, and no photographic or historical depiction. Provide selected, unavailable, and covered/on-request host-state guidance. The actual category label stays in live HTML and the icon must never imply a type not present in the record data.

## A-007 — Evidence and provenance mark set

**Related G-IDs:** G-008, G-020, G-025, G-029  
**System:** SYS-04 Evidence, Provenance & Record System  
**Production Type:** SVG  
**Disposition:** CREATE shared marks and badge grammar  
**Purpose:** Make source status and provenance distinguishable without overstating certainty.  
**Placement:** Article metadata, Search results, Updates, source/legacy links, claim records.  
**Desktop Composition:** Small mark plus short text badge or metadata label; never a large decorative seal.  
**Mobile Composition:** Icon plus short wrap-safe label: Internal, External, Legacy, Unavailable; external-link indicator stays visible.  
**Visual Language:** Ledger marks, check/line/register motifs, restrained and factual.  
**Geometry:** 16 × 16 and 20 × 20 source marks; badge min-height 28 CSS pixels desktop and 32–44 CSS pixels in touch contexts.  
**Color Rules:** Existing semantic tokens only; verified/source status cannot be represented by gold alone.  
**Typography Interaction:** Monospace metadata for IDs/status; labels remain explicit and short.  
**Required States:** Verified, updated, internal, external, legacy, unavailable, no public page, loading if the host requires it.  
**Accessibility Requirements:** Text label is mandatory for high-consequence statuses; icon is decorative when label is present.  
**Technical Format:** SVG marks plus CSS badge composition; no baked text in SVG.  
**Reuse Requirements:** Align with existing Badge and publication-label grammar.  
**Forbidden Elements:** Official-looking seals that imply institutional approval, checkmarks that imply fact certainty, unsupported confidence grades.  
**Source/Data Constraints:** Status and provenance must be passed from the actual record/source model.  
### Production Prompt

> Create a shared SVG provenance mark set and CSS badge grammar for Lions of Zion. Include verified, updated, internal, external, legacy, unavailable, and no-public-page states only where the data model provides them. Use 16×16 and 20×20 vector marks, currentColor, quiet ledger geometry, and live monospace labels. On mobile, support short wrap-safe labels such as Internal, External, Legacy, and Unavailable while keeping the external-link indicator visible. Never use a seal, checkmark, gold color, or icon shape to imply certainty or institutional endorsement that the source data does not state.

## A-008 — Shared responsive state frame

**Related G-IDs:** G-001, G-006, G-014, G-015, G-016, G-017, G-019, G-024  
**System:** SYS-03 State, Absence & Recovery System  
**Production Type:** SVG/CSS  
**Disposition:** CREATE shared composition  
**Purpose:** Give idle, loading, empty, recovery, and service states one recognizable evidence-desk anatomy.  
**Placement:** Home intro, War Update, Ask evidence marker, Ask async states, Corrections, Account, Search, 404/missing record.  
**Desktop Composition:** Centered or reading-column state panel using a small mark, explicit state label, heading, description, and recovery action where applicable.  
**Mobile Composition:** Full-width stacked state with compact mark; do not force a wide illustration or oversized panel.  
**Visual Language:** Quiet monitor/document-ring/signal marker; no narrative illustration.  
**Geometry:** Responsive frame with optional 16:9 or auto-height motif zone; content width stays within existing narrow measure.  
**Color Rules:** Existing `--async-*`, `--ink-*`, `--gold-*`, and surface tokens.  
**Typography Interaction:** Heading and state label are live HTML; the graphic supports, never replaces, the cause.  
**Required States:** Idle, loading, processing, empty, no-results, success, warning, error, unavailable, missing file, signed out.  
**Accessibility Requirements:** Preserve `role=status`/ `role=alert` behavior from `StatusState`; animation cannot be required.  
**Technical Format:** CSS layout plus lightweight SVG motif slot; no one-off bitmap illustration.  
**Reuse Requirements:** Extend the existing `StatusState` primitive rather than making route-specific panels.  
**Forbidden Elements:** Giant one-off illustration, error mascot, sad face, chatbot, sparkle, generic “AI” imagery.  
**Source/Data Constraints:** State cause and action come from the functional state contract.  
### Production Prompt

> Create a reusable responsive state-frame composition for Lions of Zion, implemented as CSS layout plus a lightweight SVG motif slot. The frame must support explicit idle, loading, processing, empty, no-results, success, warning, error, unavailable, missing-file, and signed-out states without changing the semantic cause. Use a small evidence-monitor, document-ring, or signal marker; no character, face, robot, sparkle, or narrative scene. Keep state label, heading, description, and recovery action as live HTML. Provide standard desktop and compact mobile compositions, preserve the existing StatusState ARIA roles, use current design tokens, and make all motion optional under reduced-motion.

## A-009 — State glyph set

**Related G-IDs:** G-006, G-015, G-016, G-017, G-019, G-024  
**System:** SYS-03  
**Production Type:** SVG/CSS  
**Disposition:** CREATE a small controlled glyph family  
**Purpose:** Distinguish state causes without producing a separate illustration for every page.  
**Placement:** Inside A-008 and existing StatusState marks.  
**Desktop Composition:** 20–48 CSS pixel glyph depending on the state frame.  
**Mobile Composition:** 20–32 CSS pixel glyph; preserve stroke/shape legibility.  
**Visual Language:** Signal, ledger, ring, pause, check, warning, and break motifs.  
**Geometry:** 24 × 24 base, scalable to 48 × 48; consistent optical stroke.  
**Color Rules:** Host state token supplies color; shape remains distinct in grayscale.  
**Typography Interaction:** State name is text adjacent to glyph.  
**Required States:** Idle, loading, empty, no-results, success, warning, error, unavailable, missing file, signed out.  
**Accessibility Requirements:** Decorative when state text is present; no animation-only loading signal.  
**Technical Format:** SVG symbols or CSS shapes; no raster.  
**Reuse Requirements:** Extend existing indicator logic rather than replacing state semantics.  
**Forbidden Elements:** Generic sad illustrations, fake data thumbnails, ambiguous checkmarks for unsupported claims.  
**Source/Data Constraints:** Each glyph maps to one documented state cause.  
### Production Prompt

> Create a compact SVG/CSS state glyph family with one unmistakable but restrained mark for idle, loading, empty, no-results, success, warning, error, unavailable, missing file, and signed out. Use a 24×24 base viewBox, consistent optical stroke, currentColor, and shapes that remain distinct in grayscale. The glyph is always paired with a live state label or heading and never carries the meaning alone. Provide a reduced-motion path for loading and do not use a mascot, face, sparkle, fabricated thumbnail, or certainty-implying checkmark.

## A-010 — Consent-safe identity frame

**Related G-IDs:** G-011, G-021  
**System:** SYS-05 Safe Media & Identity System  
**Production Type:** SVG/CSS  
**Disposition:** CREATE shared frame; optional approved raster slot  
**Purpose:** Represent testimony and identity records without fabricating or exposing a person.  
**Placement:** `/our-heroes`, October 7 testimony cards, consent-safe identity records.  
**Desktop Composition:** Frame beside name/category/provenance metadata; approved portrait may occupy the slot only when explicitly supplied and cleared.  
**Mobile Composition:** Stacked frame above metadata; compact monogram/silhouette remains readable at 64–96 CSS pixels.  
**Visual Language:** Dossier portrait window, monogram, silhouette, source/document rail.  
**Geometry:** Deterministic frame with a reserved slot and explicit placeholder state; no pseudo-photographic face.  
**Color Rules:** Near-black/surface/cream/gold tokens; no skin-tone invention or cinematic grading.  
**Typography Interaction:** Name, consent state, and source metadata remain live text.  
**Required States:** Monogram, silhouette, approved portrait, testimony placeholder, unavailable/withheld.  
**Accessibility Requirements:** Alt text reflects the actual supplied identity asset; placeholder must state what is unavailable.  
**Technical Format:** SVG frame plus CSS slot; optional approved raster input only.  
**Reuse Requirements:** Use approved monogram and existing source emblems as references.  
**Forbidden Elements:** AI-generated faces, invented portraits, anonymous stock silhouettes that imply a real person, graphic October 7 media.  
**Source/Data Constraints:** No portrait is allowed unless the source record expressly provides it and the project permits its display.  
### Production Prompt

> Create a consent-safe identity frame for Lions of Zion using a deterministic SVG/CSS dossier frame with states for monogram, abstract silhouette, approved portrait slot, testimony placeholder, and unavailable/withheld. The frame must never generate or approximate a human face. Keep identity name, category, consent state, and provenance as live metadata outside the artwork. On mobile, stack the frame above metadata and keep the placeholder legible at 64–96 CSS pixels. No graphic October 7 media, no stock portrait, no fabricated identity, and no implication that an image exists when it does not.

## A-011 — Covered-media frame

**Related G-IDs:** G-021, G-023  
**System:** SYS-05  
**Production Type:** SVG/CSS  
**Disposition:** CREATE abstract safe-media treatment  
**Purpose:** Clearly mark protected archive media without previewing, simulating, blurring, or exposing it.  
**Placement:** October 7 documentation/testimony archive media blocks.  
**Desktop Composition:** Covered media frame with media-type label, warning copy, explicit reveal action, and provenance outside the gate.  
**Mobile Composition:** Stacked frame with type label and action; safe boundary remains obvious without requiring an image preview.  
**Visual Language:** Abstract covered document/film/photo frame; quiet and respectful.  
**Geometry:** Frame inherits the host media ratio; before reveal it contains no actual media pixels or poster image.  
**Color Rules:** Neutral surface/cream with restrained warning token; no sensational red treatment.  
**Typography Interaction:** Warning and action are live HTML; media type is explicit.  
**Required States:** Covered, revealed, unavailable, load error; covered is the default.  
**Accessibility Requirements:** Explicit button name, focus return, Escape close, no pre-request child mount, no autoplay, no storage-based acknowledgement.  
**Technical Format:** CSS/SVG frame; actual media remains owned by `SensitiveContent` after consent.  
**Reuse Requirements:** Preserve the existing safe-media behavior and `ArchiveImage` unavailable boundary.  
**Forbidden Elements:** Blurred preview, silhouette of the actual scene, color approximation, thumbnail, blood, body, weapon, distress imagery, “click to see” tease.  
**Source/Data Constraints:** Media type and warning must come from the archive record; the artwork cannot infer or invent content.  
### Production Prompt

> Create an abstract covered-media frame for the Lions of Zion October 7 archive. The closed state must contain no media pixels, poster frame, blur, silhouette, color approximation, or simulated scene. Show only a quiet dossier/film/photo/document boundary, explicit media-type label, source/warning copy, and the live “Show this material” action supplied by the host component. Define covered, revealed, unavailable, and load-error treatments while preserving the existing SensitiveContent contract: explicit action, reversible hide, Escape close, focus return, no pre-request child mount, no autoplay, and no stored acknowledgement. Do not depict graphic historical material in any form.

## A-012 — Background and editorial motif tier pack

**Related G-IDs:** G-004, G-008, G-026  
**System:** SYS-06 Editorial Atmosphere & Background Tiers  
**Production Type:** SVG/CSS  
**Disposition:** DERIVE existing texture into controlled tiers  
**Purpose:** Add hierarchy without creating a separate unrelated background for every route.  
**Placement:** Home/hero, editorial pages, archive/detail pages, utility/error surfaces.  
**Desktop Composition:** Hero/high-signal tier, standard editorial tier, archive/detail tier, quiet utility tier.  
**Mobile Composition:** Low-density variants with reduced contrast and fewer lines/dots; no text collision or scroll-width increase.  
**Visual Language:** Existing scan, registration, signal, and contour motifs from `09-site-background-texture.png`.  
**Geometry:** CSS background layers plus lightweight SVG overlays; motifs remain clipped to viewport.  
**Color Rules:** Existing background/surface/ink/gold tokens; opacity and density are controlled by tier.  
**Typography Interaction:** Reading text always wins; do not place high-contrast registration marks behind small metadata.  
**Required States:** Hero, editorial, archive/detail, utility/quiet, reduced-motion/static.  
**Accessibility Requirements:** Decorative only; no meaningful information in texture; motion disabled or omitted under reduced-motion.  
**Technical Format:** CSS gradients only where already approved, lightweight SVG motifs, and existing raster texture; no large new bitmap pack.  
**Reuse Requirements:** Derive from existing texture and current scan vocabulary.  
**Forbidden Elements:** Random gradients, glow, noisy wallpaper, large opaque decoration, unrelated page-specific backgrounds.  
**Source/Data Constraints:** Motifs are atmosphere, not evidence and must not resemble a real map or network.  
### Production Prompt

> Build a controlled four-tier background/editorial motif system from the approved Lions of Zion site texture. Define Hero/High Signal, Standard Editorial, Archive/Detail, and Quiet Utility tiers, plus reduced-motion/static behavior. Use CSS layers and lightweight SVG motifs derived from the existing scan, registration, contour, dot, and signal vocabulary. Keep all text and controls above a readable contrast floor; the motif must never add horizontal overflow or appear to be evidence, a real map, or a real network. Provide lower-density mobile variants at 375–430 CSS pixels with fewer marks and lower opacity. Do not create a new unrelated background for any individual page.

## A-013 — Process icon extension

**Related G-IDs:** G-010, G-026  
**System:** SYS-02 + SYS-07  
**Production Type:** SVG  
**Disposition:** CREATE extension of core icon system  
**Purpose:** Encode the actual editorial process: claim, evidence, assessment, human review, publish, correction.  
**Placement:** `/we-are`, `/methodology`, process/divider compositions.  
**Desktop Composition:** 24–32 CSS pixel icons paired with labels in a horizontal or rail sequence.  
**Mobile Composition:** 24 CSS pixel icons in a vertical numbered sequence; labels remain readable and do not sit outside the viewport.  
**Visual Language:** Intake/ledger/check/source/review/publish symbols, precise and non-decorative.  
**Geometry:** 24 × 24 viewBox, shared stroke and alignment with A-005.  
**Color Rules:** CurrentColor plus process-state tokens for current/completed/blocked.  
**Typography Interaction:** Step number and label are live text.  
**Required States:** Pending, current, completed, correction/revision, unavailable where the workflow exposes it.  
**Accessibility Requirements:** Sequence must be understandable without the icons; use ordered markup.  
**Technical Format:** SVG symbols/components.  
**Reuse Requirements:** Same icon grammar as A-005; no parallel process style.  
**Forbidden Elements:** Factory metaphor, magic transformation, robot, sparkles, fake pipeline data.  
**Source/Data Constraints:** Only stages supported by the actual workflow may be named.  
### Production Prompt

> Create a six-symbol process extension in the same 24×24 SVG grammar as the utility icon family: claim/intake, evidence/source, assessment, human review, publish, and correction/revision. Use deterministic line geometry, currentColor, shared cap/join rules, and no decorative metaphor. Provide pending, current, completed, and revision-compatible host states. The step number and label remain live HTML and the sequence must make sense without the symbols. Do not add stages that the actual Lions of Zion workflow does not support.

## A-014 — Process composition template

**Related G-IDs:** G-010, G-026  
**System:** SYS-07 Process & Structural Visualization  
**Production Type:** SVG/CSS  
**Disposition:** CREATE shared composition  
**Purpose:** Arrange A-013 into a clear editorial process timeline.  
**Placement:** `/we-are`, `/methodology`, methodology dividers.  
**Desktop Composition:** Horizontal or stepped sequence with a visible human-review checkpoint; labels aligned to a common rail.  
**Mobile Composition:** Vertical numbered timeline with icon + label + short description; no forced horizontal compression.  
**Visual Language:** Evidence-desk rail, registration line, current/completed markers.  
**Geometry:** CSS grid/flex composition with SVG rules; vertical mobile rail; no canvas-only text.  
**Color Rules:** Existing state/process tokens; selected/current step has more contrast but not color alone.  
**Typography Interaction:** Display headings and monospace stage labels remain live HTML.  
**Required States:** Pending, current, completed, revision, collapsed/expanded if content density requires it.  
**Accessibility Requirements:** Ordered semantic list, current step announced, keyboard-accessible expansion if used.  
**Technical Format:** Responsive HTML/CSS with SVG icon/rule components.  
**Reuse Requirements:** A-013 icons, A-012 quiet motif tier, existing process language.  
**Forbidden Elements:** Decorative arrows implying causality not present in the workflow, cluttered node graphs, tiny mobile labels.  
**Source/Data Constraints:** Stage order and wording must come from the actual process documentation.  
### Production Prompt

> Create a responsive process composition for the Lions of Zion editorial workflow using A-013. On desktop, arrange the stages on a horizontal or stepped evidence rail with a clearly visible human-review checkpoint. On mobile 375–430 CSS pixels, switch to a vertical numbered sequence with icon, stage label, and short live description; never shrink the desktop rail until labels become unreadable. Use semantic ordered markup, visible current/completed/revision states, existing tokens, and an SVG rule system that is decorative rather than the source of meaning. Do not invent workflow stages or imply automatic publication.

## A-015 — Fake Resistance network visualization

**Related G-IDs:** G-009  
**System:** SYS-07  
**Production Type:** DATA VISUALIZATION  
**Disposition:** CREATE bespoke data-driven component  
**Purpose:** Show verified relationships in the Fake Resistance network without turning evidence into decorative artwork.  
**Placement:** Fake Resistance network route and selected case context.  
**Desktop Composition:** Data-driven graph overview with node categories, relationship edges, legend, selected-node detail, and evidence references.  
**Mobile Composition:** Do not shrink the graph. Use simplified clusters, stacked relationship cards, and a selected-node detail view; optional explicit pan/zoom only if usability testing proves it.  
**Visual Language:** Sparse evidence map, not cyberpunk network art.  
**Geometry:** SVG/canvas only for plotted data; stable layout and collision handling; focusable nodes; edge routing must remain legible.  
**Color Rules:** Category colors use a restrained documented palette and must not encode truth certainty unless the data model says so.  
**Typography Interaction:** Node labels, counts, IDs, and evidence links remain live HTML or accessible data table equivalents.  
**Required States:** Loading, populated, empty, no verified relationships, unavailable, selected node, mobile cluster/detail.  
**Accessibility Requirements:** Provide a linear/list representation, keyboard focus for nodes, selected-node announcement, and an equivalent evidence table.  
**Technical Format:** Data-driven SVG/component with deterministic layout; static fallback for no-JS or export.  
**Reuse Requirements:** Use A-006/A-007 markers where record/source types appear.  
**Forbidden Elements:** Decorative fake edges, inferred links, invented nodes, invented evidence, random node labels, glowing cyberpunk treatment.  
**Source/Data Constraints:** Every node and edge must come from provided data and verified relationships; every edge must map back to evidence; no inference.  
### Production Prompt

> Specify a data-driven Fake Resistance network visualization. The renderer must receive an explicit node list, node categories, verified relationship list, evidence references, and selected-node state from the application. Render only supplied nodes and supplied edges. Never infer a connection, add a decorative edge, invent a label, fabricate an evidence reference, or use visual proximity as proof of relationship. Use a restrained evidence-map visual language, not neon or cyberpunk styling. Desktop may show the full graph overview with legend and evidence detail. Mobile must switch to simplified clusters plus stacked relationship cards and a selected-node detail view rather than shrinking the graph. Provide loading, populated, empty/no-verified-relationships, unavailable, keyboard, screen-reader, and no-JS/list fallback behavior.

## A-016 — Israel’s Story map and evidence timeline

**Related G-IDs:** G-012  
**System:** SYS-07  
**Production Type:** DATA VISUALIZATION  
**Disposition:** CREATE bespoke data-driven component  
**Purpose:** Relate verified chronology and geography without creating a decorative map or historical claim.  
**Placement:** `/israels-story`.  
**Desktop Composition:** Synchronized map/chronology when both datasets exist; date rail, event marker, category, source rail, and verified/source metadata.  
**Mobile Composition:** Vertical chapter/timeline is primary; map is optional behind an explicit reveal or horizontally scrollable/pannable region only when it adds meaning.  
**Visual Language:** Cartographic restraint, archival chronology, source-led annotation.  
**Geometry:** Data coordinates define map geometry; timeline uses a vertical rail on mobile; no text outside viewport.  
**Color Rules:** Existing tokens and documented category colors; no heatmap implication without quantitative data.  
**Typography Interaction:** Dates, chapter names, event labels, and source metadata stay live and selectable.  
**Required States:** Loading, populated, selected chapter/event, empty, unavailable, map hidden/revealed, mobile timeline-only.  
**Accessibility Requirements:** Ordered timeline/list alternative, keyboard selection, announcement of selected event, map not required to understand chronology.  
**Technical Format:** Data-driven SVG/map layer plus semantic timeline; no generated map image.  
**Reuse Requirements:** A-006/A-007 markers and A-014 process/timeline rules where appropriate.  
**Forbidden Elements:** Invented borders, invented routes, invented dates, false precision, decorative battle map, fabricated historical imagery.  
**Source/Data Constraints:** Geography, dates, events, categories, and sources must come from the provided verified dataset.  
### Production Prompt

> Specify a data-driven Israel’s Story map/timeline component. Use only supplied geographic geometry, verified dates, event records, categories, and source metadata. Desktop may synchronize a restrained map with a chronological rail when both are available. On mobile, make the vertical chapter/timeline the primary experience and place the map behind an explicit reveal or a controlled pan/scroll region only if it provides real explanatory value. Do not invent borders, routes, dates, locations, event relationships, heat values, or historical imagery. Provide an ordered timeline/list alternative, selected-event semantics, loading, empty, unavailable, and map-hidden states. All labels and source metadata remain live HTML.

## A-017 — Information War conceptual hero

**Related G-027  
**System:** SYS-06  
**Production Type:** SVG/CSS  
**Disposition:** CREATE bespoke responsive composition; no image generation  
**Purpose:** Give `/information-war` a conceptual visual anchor without pretending to show a real event or evidence image.  
**Placement:** Information War page hero/intro.  
**Desktop Composition:** Wide, quiet signal/noise field with structured bands, registration marks, and a clear HTML headline/CTA zone.  
**Mobile Composition:** Portrait or vertically stacked signal bands; headline remains dominant and the first action stays inside the initial content block.  
**Visual Language:** Editorial signal field, controlled noise, provenance/registration motifs.  
**Geometry:** Responsive CSS/SVG bands and lines; no large raster dependency; preserve safe text zones.  
**Color Rules:** Near-black field, cream text, restrained gold signal; no neon.  
**Typography Interaction:** Headline and explanatory copy are live HTML over a quiet zone.  
**Required States:** Default, reduced-motion/static, unavailable asset fallback.  
**Accessibility Requirements:** Decorative SVG hidden; text remains fully readable without the composition.  
**Technical Format:** Responsive SVG/CSS, optionally derived from A-012 motifs.  
**Reuse Requirements:** Use the existing background texture language and A-012 tokens.  
**Forbidden Elements:** Generic news photo, data claims, fake headline, map/network implication, explosions, flags used as propaganda, AI imagery.  
**Source/Data Constraints:** It is conceptual atmosphere only; it must not encode a factual claim or data relationship.  
### Production Prompt

> Create a responsive SVG/CSS conceptual hero for the Lions of Zion Information War page. Use a near-black field, restrained cream/gold signal bands, scan lines, registration marks, and controlled noise derived from the approved editorial texture vocabulary. Desktop should be wide with an intentionally quiet HTML headline/CTA zone. At 375–430 CSS pixels, switch to portrait or vertically stacked bands and keep the headline plus first action inside the initial content block. Do not use image generation, photography, flags, explosions, faces, maps, network edges, fake headlines, or data-like marks that could be mistaken for evidence. The composition must remain decorative and understandable without it.

# 6. G-ID disposition register

| G-ID | Requirement | Disposition | Production package | Mobile treatment |
|---|---|---|---|---|
| G-001 | Intro illustration/state | DERIVE + CREATE shared state support | A-001, A-008 | Responsive intro composition; reduced motion |
| G-002 | Logo/app/OG | REUSE + DERIVE + VALIDATE | A-001, A-002, A-004 | Compact/stacked lockup when constrained |
| G-003 | Hero illustration | REUSE + DERIVE crop | A-003 | Portrait crop; no new lion |
| G-004 | Background texture | DERIVE | A-012 | Lower-density tier |
| G-005 | Icon set | CREATE shared | A-005 | Same vectors, 44 px targets |
| G-006 | War Update empty state | CREATE shared state use | A-008, A-009 | Compact stacked state |
| G-007 | Filter/status icons | UX ONLY + REUSE A-005 | A-005 | Stacked/drawer controls |
| G-008 | Editorial markers/thumbnails | CREATE shared markers | A-006, A-007, A-012 | Leading marker, wrap-safe metadata |
| G-009 | Network diagram | CREATE data visualization | A-015 | Clusters/cards/detail, not shrink |
| G-010 | Process icon set | CREATE extension | A-013, A-014 | Vertical numbered process |
| G-011 | Safe avatar/portrait frame | CREATE safe frame | A-010 | Stacked, consent-safe |
| G-012 | Map/timeline | CREATE data visualization | A-016 | Vertical timeline; map reveal/pan |
| G-013 | Action icons | REUSE shared | A-005 | Full-row touch targets |
| G-014 | Evidence/question illustration | CREATE compact marker only | A-008, A-009 | Simplified marker |
| G-015 | Async state graphics | CREATE shared state use | A-008, A-009 | Stacked async anatomy |
| G-016 | Empty ledger graphic | CREATE shared state use | A-008, A-009 | Compact empty state |
| G-017 | Auth/session graphic | UX ONLY | A-008, A-009 optional | No bespoke account illustration |
| G-018 | Search/keyboard tokens | UX ONLY + REUSE A-005 | A-005 | Hide keyboard legend on touch |
| G-019 | No-results state | CREATE shared state use | A-008, A-009 | Explicit recovery state |
| G-020 | Result-type/status icons | REUSE shared | A-006, A-007 | Compact marker and wrap-safe metadata |
| G-021 | Testimony placeholder | CREATE safe frame | A-006, A-010 | Compact safe marker |
| G-022 | Language markers | UX ONLY + REUSE A-005 | A-005 | Text labels/selector, not new icon |
| G-023 | Safe media placeholders | CREATE abstract frame | A-006, A-011 | Covered frame; no preview |
| G-024 | 404/missing-file illustration | CREATE shared state use | A-008, A-009 | Compact recovery marker |
| G-025 | Source/status icons | REUSE shared | A-007 | Stacked provenance metadata |
| G-026 | Editorial dividers/diagram | REUSE process/background systems | A-012, A-013, A-014 | Vertical compact sequence |
| G-027 | Conceptual hero | CREATE SVG/CSS | A-017 | Portrait/stacked signal composition |
| G-028 | Feed markers | REUSE shared | A-006, A-007 | Sparse category/current markers |
| G-029 | Provenance badges | REUSE shared | A-007 | Wrap-safe icon + text |

## 7. Final classification

### A — Same asset works

- G-005 utility/action vectors, with responsive sizing only.
- G-007 filter/status symbols from the core set.
- G-013 support action icons from the core set.
- G-020 record-type markers from the shared set.
- G-025 source/status marks from the shared provenance set.
- G-028 feed markers from the shared record/provenance set.
- G-004 base texture vocabulary where the host uses a lower-density CSS tier rather than a new visual asset.
- G-004, G-005, G-007, G-013, G-020, G-025, and G-028 remain one family; mobile changes are host sizing/density, not a new visual language.

### B — Responsive variant needed

- G-001 intro composition and skip/reveal placement.
- G-002 compact/stacked brand lockup.
- G-003 hero crop.
- G-006 compact empty-state frame.
- G-008 editorial marker placement.
- G-010 process composition.
- G-011 safe identity frame.
- G-014 compact evidence marker.
- G-015 stacked async state frame.
- G-016 compact empty-ledger state.
- G-017 stacked account state using shared primitives.
- G-019 explicit mobile no-results frame.
- G-021 compact testimony marker.
- G-022 language selector/wrap treatment.
- G-023 covered-media frame.
- G-024 compact recovery state.
- G-026 compact methodology composition.
- G-027 portrait conceptual hero.
- G-028 compact feed rail.
- G-029 wrap-safe provenance badge.

### C — Simplified mobile graphic needed

- G-004 background texture: lower density and reduced contrast.
- G-009 network: cluster/card/detail representation.
- G-014 evidence/question marker: small corpus/evidence marker only.
- G-020 result-type/status icons: 20–24 CSS pixel subset where density is high.
- G-023 covered media: frame and boundary label only, never a preview.
- G-025 provenance marks: compact mark plus short label.
- G-027 conceptual hero: fewer bands and less signal density.

### D — Different mobile UX needed

- G-007 filters: stacked controls or one filter drawer.
- G-009 Fake Resistance network: clusters, relationship cards, and selected-node detail.
- G-010 process: vertical numbered sequence rather than compressed horizontal rail.
- G-012 Israel’s Story: vertical timeline first, optional map reveal/pan.
- G-018 Search: hide desktop keyboard legend and expose touch-first actions.
- G-022 language controls: text-preserving wrap/selector treatment.
- G-023 safe media: explicit covered boundary and action rather than an image resize.
- G-029 provenance badges: icon + short label with external-link affordance kept visible.

## 8. Production order

1. **Foundation:** A-001, A-002, A-003 derivative normalization; validate A-004.
2. **Shared symbols:** A-005, A-006, A-007.
3. **State and safety:** A-008, A-009, A-010, A-011.
4. **Atmosphere and process:** A-012, A-013, A-014.
5. **Data visualizations:** A-015 and A-016 only after real data contracts are available.
6. **Optional conceptual composition:** A-017 after content hierarchy and contrast are validated.

No image-generation package is approved in the current baseline. The bespoke visual requirements are better served by SVG/CSS or data-driven components, and the approved lion/brand imagery must be reused or derived deterministically.

## 9. Stop condition

Prompt/brief authoring is complete.

- No graphics were generated.
- No SVGs were created.
- No UI or CSS was changed.
- No assets were replaced.
- No production implementation was started.

