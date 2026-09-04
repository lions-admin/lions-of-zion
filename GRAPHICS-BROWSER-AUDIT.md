# LIONS OF ZION — Browser-Based Full Graphics Audit

תאריך הבדיקה: 2026-09-03  
אתר: <https://lionsofzion.io>  
Scope: Audit בלבד. לא שונה קוד, CSS, UI או asset; לא נוצרה גרפיקה ולא נעשה redesign.

## Executive summary

האתר בנוי סביב שפה חזותית עקבית יחסית: רקע שחור עם טקסט־מונוספייס כטקסטורה, כותרות serif גדולות, קווי מסגרת דקים, זהב כצבע accent, וכפתורי outline/gold. ה־hero של דף הבית הוא asset חזק וניתן לשימוש חוזר.

החוסרים העיקריים אינם “עוד תמונה בכל כרטיס”, אלא שכבת visual language שמבהירה מצבים ומבני מידע: empty state אמיתי ל־War Update ול־Search, safe placeholders לארכיוני October 7, אייקוני סטטוס ל־evidence/citations, גרפיקת process ל־We Are, map/timeline ל־Israel’s Story, ו־illustrations ייעודיות ל־Fake Resistance ול־Information War. בנוסף, מסכים רבים ארוכים וריקים ויזואלית; הטקסטורה האחורית לבדה אינה תמיד מייצרת היררכיה או orientation.

## Method and limitations

- בוצעה ניווטה בפועל בדפדפן cloud Chrome דרך האתר החי, לא באמצעות קריאת קוד בלבד.
- נאספו 179 כתובות פנימיות ייחודיות מתוך ה־navigation וה־links שנמצאו, כולל product routes, nested pages, article routes, archive records, source/legacy paths ו־404 paths.
- כל 179 הכתובות בוקרו בדפדפן ב־desktop viewport. למסכים משמעותיים נשמרו screenshots ייעודיים; ליתר המסלולים נשמרו screenshots בשם `route-*.jpg` או `route-recovered-*.jpg` כאשר נדרש recovery.
- viewport הדפדפן שסופק קבוע על 1363×936. ה־browser tool לא חשף API ל־resize/device emulation, ולכן לא ניתן היה לבדוק Mobile או Tablet באמת. אין להשתמש בדוח הזה כ־mobile sign-off.
- לא הוזנו credentials, לא בוצעה פעולה הרסנית, ולא נפתחו מדיות גרפיות של הארכיון לאחר שהאתר הזהיר שכל record הוא graphic. נבדקו archive/list states וה־safe boundary בלבד.
- Hover states לא נאספו באופן שיטתי; active/focus states שנוצרו על ידי click/fill כן תועדו כאשר היו זמינים.

## Route map

### Primary product routes

`/`, `/geopolitical-brief`, `/war-update`, `/october-7`, `/fake-resistance`, `/search`, `/ask`, `/support-us`, `/we-are`, `/our-heroes`, `/israels-story`, `/methodology`, `/corrections`, `/information-war`, `/account`, `/updates`.

### Nested product routes inspected or discovered

- `/october-7/testimonies`
- `/october-7/documentation`
- `/fake-resistance/cases/manosphere-far-right`
- `/fake-resistance/official-narrative`
- `/fake-resistance/social-media`
- `/fake-resistance/network`
- `/fake-resistance/playbook`
- 19 article routes תחת `/articles/...` שנמצאו מ־Daily Brief/Updates.
- 24 testimony detail routes ו־24 documentation detail routes תחת `/october-7/...`.

### Linked source / legacy / external-record paths

נמצאו ובוקרו גם paths כגון `/record/...`, `/wiki/...`, `/resources/...`, `/content/...`, `/world/...`, `/live-blog/...`, `/liveblog_entry/...`, `/fact-check`, `/dataset/...`, `/en/...`, paths בשפות נוספות ו־source pages. הם מייצגים evidence links או legacy/source records, ולא כולם הם מסכי מוצר בשליטת הממשק.

## Screenshots

כל הראיות נשמרו תחת `screenshots/graphics-audit/`.

### Named evidence screenshots

| Area | Evidence |
|---|---|
| Home intro / home hero | `home-desktop.jpg`, `home-desktop-full.jpg`, `home-main-desktop.jpg`, `home-main-desktop-full.jpg` |
| Home / all files attempt | `home-all-files-open-desktop.jpg` |
| Daily Brief | `geopolitical-brief-desktop-full.jpg`, `geopolitical-brief-filtered-desktop.jpg` |
| War Update empty state | `war-update-desktop.jpg`, `war-update-desktop-full.jpg` |
| Editorial files | `fake-resistance-desktop.jpg`, `we-are-desktop.jpg`, `our-heroes-desktop.jpg`, `israels-story-desktop.jpg` |
| October 7 archives | `october-7-desktop.jpg`, `october-7-testimonies-desktop.jpg`, `october-7-documentation-desktop.jpg` |
| Archive no-results attempt | `october-7-testimonies-no-results-desktop.jpg` |
| Ask desk | `ask-desktop-full.jpg`, `ask-suggestion-selected-desktop.jpg` |
| Search | `search-desktop-full.jpg`, `search-populated-desktop-full.jpg`, `search-no-results-desktop-full.jpg` |
| Utility / trust pages | `support-us-desktop.jpg`, `support-us-desktop-full.jpg`, `corrections-desktop.jpg`, `methodology-desktop-full.jpg`, `information-war-desktop.jpg`, `updates-desktop.jpg`, `updates-desktop-full.jpg`, `account-desktop.jpg` |
| Content / error templates | `article-brief-desktop.jpg`, `article-reported-claim-desktop.jpg`, `legacy-error-desktop.jpg`, `fake-resistance-case-desktop.jpg` |
| Bulk route evidence | `route-*.jpg`, `route-recovered-*.jpg` |

## Findings

### Shared brand, shell and home

#### G-001

- **Page / Route:** `/`
- **Location:** Intro overlay, initial load
- **Graphic Type:** Illustration / intro state
- **Current State:** Existing but weak
- **Problem:** initial state is an almost-black “SIGNAL INTAKE 01 / 01” screen. The skip affordance is visually easy to miss and the reveal does not provide a clear progress/brand explanation.
- **Required Graphic:** Branded intro/progress treatment with a clear skip marker and a resolved end state.
- **Purpose:** Explain that the black screen is intentional loading/intro, not a broken page.
- **Recommended Direction:** Keep the evidence-desk/scan motif; add a restrained progress glyph or framed signal indicator rather than a photographic hero.
- **Variants:** Desktop; mobile and reduced-motion variants not checked.
- **Recommended Format:** SVG/CSS animation or existing motion asset.
- **Priority:** P0 — Critical / חובה
- **Evidence:** `screenshots/graphics-audit/home-desktop.jpg`

#### G-002

- **Page / Route:** Shared shell, home and social/share surfaces
- **Location:** Header logo, compact contexts, browser tab/share preview
- **Graphic Type:** Logo / app icon / OpenGraph graphic
- **Current State:** Missing
- **Problem:** Desktop shows a text lockup (“Lions of Zion / Evidence Desk”), while the home hero contains a separate lion/wordmark composition. No compact symbol, favicon, app icon, or branded social preview was visible in the browser audit.
- **Required Graphic:** Compact lion mark, horizontal/stacked logo variants, favicon/app icon, monochrome/light variant and branded OG image.
- **Purpose:** Preserve brand recognition outside the full desktop header.
- **Recommended Direction:** Derive from the existing scan-line lion; keep the eye/gold accent restrained and legible at 16–32 px.
- **Variants:** Desktop; mobile; light/dark; monochrome.
- **Recommended Format:** SVG for marks/favicon; PNG/WebP for OG.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/home-main-desktop.jpg`

#### G-003

- **Page / Route:** `/`
- **Location:** Center hero
- **Graphic Type:** Illustration
- **Current State:** Existing and reusable
- **Problem:** The lion scan/glitch graphic is the strongest bespoke visual asset on the site, but no compact/mobile crop or documented reuse surface was visible.
- **Required Graphic:** Preserve the existing lion as a reusable master with compact and responsive crops.
- **Purpose:** Anchor the brand and provide a recognizable visual signature.
- **Recommended Direction:** Keep the current high-contrast scan-line treatment; avoid introducing a second illustration style.
- **Variants:** Desktop; mobile; light/dark if needed.
- **Recommended Format:** SVG or high-resolution WebP/AVIF depending on animation implementation.
- **Priority:** P3 — Nice to have
- **Evidence:** `screenshots/graphics-audit/home-main-desktop.jpg`

#### G-004

- **Page / Route:** Shared content pages and `/`
- **Location:** Full-page background
- **Graphic Type:** Background / decorative graphic
- **Current State:** Existing but weak
- **Problem:** Repeated low-contrast typewriter text creates atmosphere but often reads as noise and leaves large sections visually empty.
- **Required Graphic:** A small controlled library of evidence-desk background textures, with density/contrast tiers.
- **Purpose:** Separate hero, content, archive and footer zones without competing with long-form text.
- **Recommended Direction:** Use fewer, larger, slower motifs: scan bands, dossier grids, faint registration marks, or section-specific signal patterns.
- **Variants:** Desktop; mobile low-density version; dark only.
- **Recommended Format:** CSS gradients/patterns plus SVG texture overlays.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/information-war-desktop.jpg`

#### G-005

- **Page / Route:** Shared header/footer, `/search`, `/ask`, `/updates`
- **Location:** Search, Ask/chat, chevrons, keyboard hints, filters and status markers
- **Graphic Type:** Icon set
- **Current State:** Existing but inconsistent
- **Problem:** Utility controls use very small outline icons, text glyphs and chevrons with limited semantic differentiation. The visual weight changes between header controls, keyboard hints and archive buttons.
- **Required Graphic:** One tokenized icon family for search, ask, filter, clear, open, external link, source, verified, warning, media and status.
- **Purpose:** Improve recognition and cross-screen consistency.
- **Recommended Direction:** 1.5 px outline family with a gold active state and a neutral inactive state; avoid emoji/text substitutes.
- **Variants:** Desktop; mobile touch-size variant; active/inactive; disabled.
- **Recommended Format:** SVG icon sprite or component library.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/ask-desktop-full.jpg`

### Daily Brief, files and editorial pages

#### G-006

- **Page / Route:** `/war-update`
- **Location:** Center empty state card
- **Graphic Type:** Empty State / status illustration
- **Current State:** Existing but weak
- **Problem:** The empty state uses a small generic ring mark and text only: “No verified war update has been published yet.” It does not visually distinguish “empty”, “offline”, “loading” or “error”.
- **Required Graphic:** A calm live-desk empty-state/status illustration and a small status glyph family.
- **Purpose:** Make the absence of a verified update feel intentional and trustworthy.
- **Recommended Direction:** Minimal radar/scan pulse or empty dossier frame; avoid alarmist war imagery.
- **Variants:** Desktop; mobile; empty/loading/error/success.
- **Recommended Format:** SVG/CSS.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/war-update-desktop.jpg`

#### G-007

- **Page / Route:** `/geopolitical-brief`
- **Location:** Date, Actor, Topic, Arena filter row
- **Graphic Type:** Icon / status graphic
- **Current State:** Existing but weak
- **Problem:** The filters are functional but visually rely on tiny dropdown arrows and a date input icon; active/clear/filter states are not visually distinct.
- **Required Graphic:** Filter, calendar, clear and active-filter tokens, plus a compact “filtered archive” state.
- **Purpose:** Make the archive’s state legible at a glance.
- **Recommended Direction:** Thin outline controls with gold only for active filters; use a small result-count/status marker.
- **Variants:** Desktop; mobile stacked filters; active/inactive; disabled.
- **Recommended Format:** SVG/CSS.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/geopolitical-brief-filtered-desktop.jpg`

#### G-008

- **Page / Route:** `/geopolitical-brief`, `/updates`, article listings
- **Location:** Current edition, archive cards and long text lists
- **Graphic Type:** Image / editorial thumbnail system
- **Current State:** Missing
- **Problem:** Editorial records are almost entirely text and borders. The cards lack a visual type/status anchor, so long lists become visually repetitive.
- **Required Graphic:** A restrained abstract thumbnail/marker system for Daily Brief, Israel Update, War Update and Narrative Watch.
- **Purpose:** Improve scanning and distinguish record types without implying unsupported photographic content.
- **Recommended Direction:** Abstract evidence motifs, not stock news photos: source brackets, scan crops, dossier stamps, small map fragments.
- **Variants:** Desktop; mobile; record-type variants.
- **Recommended Format:** SVG or WebP/AVIF thumbnail set.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/geopolitical-brief-desktop-full.jpg`

#### G-009

- **Page / Route:** `/fake-resistance`, `/fake-resistance/cases/manosphere-far-right`, `/fake-resistance/network`
- **Location:** Hero and case/network sections
- **Graphic Type:** Illustration / diagram
- **Current State:** Missing
- **Problem:** The subject is a network of accounts, claims and connections, but the visual presentation is long text plus navigation. No conceptual network graphic or case topology appears.
- **Required Graphic:** Evidence-network diagram language: nodes, paths, clusters and source links.
- **Purpose:** Communicate relationships and propagation more quickly than prose alone.
- **Recommended Direction:** Monochrome dossier diagram with sparse gold/red accents; all claims must remain grounded in labeled records.
- **Variants:** Desktop; mobile simplified diagram; active/highlighted node.
- **Recommended Format:** SVG, optionally CSS-animated.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/fake-resistance-case-desktop.jpg`

#### G-010

- **Page / Route:** `/we-are`
- **Location:** Method/process timeline
- **Graphic Type:** Icon set / process illustration
- **Current State:** Missing
- **Problem:** The process is represented by circles and a vertical rule only. The steps do not have distinct visual symbols for intake, checking, sourcing, publishing and correction.
- **Required Graphic:** Five-to-seven process icons that map to the desk workflow.
- **Purpose:** Make methodology understandable before the user reads every paragraph.
- **Recommended Direction:** Consistent outline icons built from the same scan-line geometry as the lion mark.
- **Variants:** Desktop; mobile horizontal/stacked timeline; completed/current/upcoming.
- **Recommended Format:** SVG.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/we-are-desktop.jpg`

#### G-011

- **Page / Route:** `/our-heroes`
- **Location:** Hero profiles and consent-boundary section
- **Graphic Type:** Avatar / portrait placeholder
- **Current State:** Placeholder
- **Problem:** Profiles are text-only and have no consistent human identity treatment. The consent boundary is important, but the page has no respectful visual placeholder for profiles without approved portraits.
- **Required Graphic:** Consent-safe silhouette/monogram placeholder system and optional approved monochrome portrait frame.
- **Purpose:** Add human orientation while respecting image consent.
- **Recommended Direction:** No dramatic memorial imagery; use neutral archival frame, initials or silhouette with source/consent metadata.
- **Variants:** Desktop; mobile; approved portrait; no-consent placeholder.
- **Recommended Format:** SVG placeholder; WebP/AVIF only for approved portraits.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/our-heroes-desktop.jpg`

#### G-012

- **Page / Route:** `/israels-story`
- **Location:** Historical timeline and chapter navigation
- **Graphic Type:** Map / timeline illustration
- **Current State:** Missing
- **Problem:** The page has chapter numbers, a gold vertical timeline and source links, but no spatial or geographic visual layer.
- **Required Graphic:** Context map/timeline system that can pair geography with major historical chapters.
- **Purpose:** Help users understand chronology and location without replacing the sourced text.
- **Recommended Direction:** Minimal line map with chapter markers; avoid politically ambiguous territory fills and add an explicit legend.
- **Variants:** Desktop; mobile simplified; chapter selected/unselected.
- **Recommended Format:** SVG.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/israels-story-desktop.jpg`

#### G-013

- **Page / Route:** `/support-us`
- **Location:** “Choose how to help” action list
- **Graphic Type:** Icon / illustration
- **Current State:** Missing
- **Problem:** Report, volunteer, share and donate actions are text-only and visually repetitive, so their different intents are not immediately scannable.
- **Required Graphic:** Four action icons plus one small supportive illustration for the section.
- **Purpose:** Differentiate contribution paths and reduce cognitive load.
- **Recommended Direction:** Simple evidence-desk symbols: flag claim, tools/skill, share node, secure contribution.
- **Variants:** Desktop; mobile; selected/focus.
- **Recommended Format:** SVG.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/support-us-desktop.jpg`

### Ask, search, trust and account states

#### G-014

- **Page / Route:** `/ask`
- **Location:** Suggestions, Evidence Boundary card and question composer
- **Graphic Type:** Illustration / explanatory graphic
- **Current State:** Missing
- **Problem:** The screen explains a distinct evidence-bound answering model, but the UI has no visual metaphor for corpus, sources or answer boundaries.
- **Required Graphic:** Small “ask the desk” evidence/corpus illustration and source-list marker.
- **Purpose:** Set expectations before a question is submitted.
- **Recommended Direction:** A document stack/scan field with linked source dots; keep it abstract and non-anthropomorphic.
- **Variants:** Desktop; mobile; idle/ready.
- **Recommended Format:** SVG.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/ask-desktop-full.jpg`

#### G-015

- **Page / Route:** `/ask`
- **Location:** Question submission lifecycle
- **Graphic Type:** State graphics
- **Current State:** Missing
- **Problem:** The audit reached idle, suggestion-selected and ready-to-submit states, but no dedicated loading, error or successful answer visual treatment was exposed without submitting a real request.
- **Required Graphic:** Loading scan, no-answer/empty-corpus, error and answer-with-sources markers.
- **Purpose:** Make async states legible and keep users oriented while the desk responds.
- **Recommended Direction:** Reuse the same scan pulse and evidence tokens; do not introduce a chatbot avatar.
- **Variants:** Desktop; mobile; idle/loading/error/success/no-results.
- **Recommended Format:** SVG/CSS.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/ask-suggestion-selected-desktop.jpg`

#### G-016

- **Page / Route:** `/corrections`
- **Location:** Public ledger with `0 entries`
- **Graphic Type:** Empty State / ledger illustration
- **Current State:** Placeholder
- **Problem:** “Public ledger · 0 entries” is text-only. The page’s promise of transparent corrections would benefit from a clear empty-ledger state.
- **Required Graphic:** Empty ledger/document stamp with a neutral “no corrections recorded” status.
- **Purpose:** Avoid making an empty public record look unfinished or broken.
- **Recommended Direction:** Thin document outline and verified stamp; no celebratory checkmark.
- **Variants:** Desktop; mobile; empty/populated/corrected.
- **Recommended Format:** SVG.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/corrections-desktop.jpg`

#### G-017

- **Page / Route:** `/account`
- **Location:** Unauthenticated sign-in check card
- **Graphic Type:** Account / auth state illustration
- **Current State:** Placeholder
- **Problem:** The card remained at “Checking your sign-in…” in the unauthenticated audit. There is no visible account/avatar/secure-session visual anchor.
- **Required Graphic:** Neutral account/session placeholder and explicit loading, signed-out, signed-in and error variants.
- **Purpose:** Make auth state and optionality understandable without implying a failed login.
- **Recommended Direction:** Minimal profile ring plus lock/session line; avoid a human portrait until a user chooses one.
- **Variants:** Desktop; mobile; checking/signed-out/signed-in/error.
- **Recommended Format:** SVG/CSS.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/account-desktop.jpg`

#### G-018

- **Page / Route:** `/search`
- **Location:** Input, keyboard legend and result navigation
- **Graphic Type:** Icon tokens
- **Current State:** Existing but inconsistent
- **Problem:** Keyboard instructions use text glyphs (`↑`, `↓`, `↵`, `esc`) and tiny icon treatment rather than a consistent command/navigation visual language.
- **Required Graphic:** Search, keyboard, move, open, clear and result-type icons.
- **Purpose:** Make the command interface more scannable and accessible.
- **Recommended Direction:** Use compact outlined keycaps only where they clarify the interaction; pair them with semantic icons.
- **Variants:** Desktop; mobile touch alternative; focused/disabled.
- **Recommended Format:** SVG/CSS.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/search-desktop-full.jpg`

#### G-019

- **Page / Route:** `/search`
- **Location:** No-results query state
- **Graphic Type:** Empty State / search state
- **Current State:** Existing but weak
- **Problem:** A deliberately impossible query produced a transient “Searching the index…” state, then a generic list of indexed routes rather than a stable, clearly labeled no-results state. The result is ambiguous from a user perspective.
- **Required Graphic:** Distinct no-results illustration/status plus a reliable empty-result state; separate it from loading and fallback/indexed states.
- **Purpose:** Tell users whether the query found nothing, is still searching, or returned fallback content.
- **Recommended Direction:** Empty dossier/search aperture with one clear recovery action; no generic magnifying-glass-only treatment.
- **Variants:** Desktop; mobile; loading/no-results/fallback/error.
- **Recommended Format:** SVG/CSS.
- **Priority:** P0 — Critical / חובה
- **Evidence:** `screenshots/graphics-audit/search-no-results-desktop-full.jpg`

#### G-020

- **Page / Route:** `/search`
- **Location:** Populated result rows and “Indexed · no public page” badge
- **Graphic Type:** Result-type/status icons
- **Current State:** Existing but weak
- **Problem:** October 7 search results render as uniform text rows with the same generic `BRIEF` treatment. “Indexed · no public page” has no dedicated no-page/external/source icon.
- **Required Graphic:** Result-type icons for brief, testimony, documentation, source and unavailable public page.
- **Purpose:** Let users scan mixed record types and understand linkability.
- **Recommended Direction:** One monochrome icon per record class with gold only for active/verified states.
- **Variants:** Desktop; mobile; active/inactive/no-public-page.
- **Recommended Format:** SVG.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/search-populated-desktop-full.jpg`

### October 7 archives and sensitive media

#### G-021

- **Page / Route:** `/october-7`, `/october-7/testimonies`
- **Location:** Testimonies archive cards and record list
- **Graphic Type:** Safe placeholder / identity graphic
- **Current State:** Placeholder
- **Problem:** Testimony records are text/list driven, while the page says accounts include images and credits. There is no consistent visual identity for an account when the media is not shown.
- **Required Graphic:** Neutral witness/account placeholder with record, language and source markers.
- **Purpose:** Add human orientation without exposing graphic media or implying an unapproved portrait.
- **Recommended Direction:** Abstract document/profile silhouette, not a face or reenactment.
- **Variants:** Desktop; mobile; language variants; covered-media/available-media.
- **Recommended Format:** SVG.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/october-7-testimonies-desktop.jpg`

#### G-022

- **Page / Route:** `/october-7/testimonies`
- **Location:** Language filter row and archive metadata
- **Graphic Type:** Icon / language marker
- **Current State:** Placeholder
- **Problem:** Seven language buttons are compact text labels with counts and no language/world/language-state visual token.
- **Required Graphic:** Accessible language marker plus selected/unselected states that do not rely on text density alone.
- **Purpose:** Clarify filtering and active language at a glance.
- **Recommended Direction:** Small globe/characters icon family; retain the actual language names as text.
- **Variants:** Desktop; mobile wrapped controls; active/inactive.
- **Recommended Format:** SVG/CSS.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/october-7-testimonies-desktop.jpg`

#### G-023

- **Page / Route:** `/october-7/documentation`
- **Location:** Archive result cards and graphic-content boundary
- **Graphic Type:** Safe media placeholder / media-type icons
- **Current State:** Placeholder
- **Problem:** The page explicitly says every record is graphic and that no film or photograph is shown until requested. The safe archive view has no visual placeholder explaining whether a record is film, photograph, covered, or available on request.
- **Required Graphic:** Blurred/covered-safe placeholder frame with film/photo/document type and “ask to view” boundary marker.
- **Purpose:** Preserve a usable archive while respecting the content warning.
- **Recommended Direction:** Neutral dark frame with media-type icon and a clear covered-state label; never auto-load the image.
- **Variants:** Desktop; mobile; covered/available/on-request; film/photo.
- **Recommended Format:** SVG/CSS, optional blurred WebP only where policy allows.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/october-7-documentation-desktop.jpg`

### Error, article and long-form templates

#### G-024

- **Page / Route:** Observed 404/legacy path `/october7testimonies`; also missing record `/record/4051246`
- **Location:** Error card
- **Graphic Type:** Error illustration
- **Current State:** Existing but weak
- **Problem:** The 404 experience has strong typography and a gold divider, but no signal-loss/file-recovery illustration. Missing records and missing files use similar text-first treatments.
- **Required Graphic:** Branded “signal lost / missing file” illustration with distinct variants for 404, missing record and unavailable source.
- **Purpose:** Turn an error into a clear recovery path without making it look like a system crash.
- **Recommended Direction:** Empty dossier folder, broken scan line or locator frame; keep the current restrained tone.
- **Variants:** Desktop; mobile; 404/missing-record/source-unavailable.
- **Recommended Format:** SVG.
- **Priority:** P1 — Important
- **Evidence:** `screenshots/graphics-audit/legacy-error-desktop.jpg`

#### G-025

- **Page / Route:** `/articles/...`, Daily Brief article template
- **Location:** Title metadata, source stack and record body
- **Graphic Type:** Source/status icon set
- **Current State:** Existing but weak
- **Problem:** Article pages have editorial tag pills and metadata, but source, actor, arena and verification concepts are largely text labels. There is no visual distinction between source-linked facts and surrounding metadata.
- **Required Graphic:** Source, verified, update, actor, location and external-link markers shared with Search and Updates.
- **Purpose:** Make evidence provenance scannable without adding decorative imagery to every article.
- **Recommended Direction:** Small labels/icons integrated into the dossier grid; preserve the serif/monospace pairing.
- **Variants:** Desktop; mobile; verified/updated/external.
- **Recommended Format:** SVG.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/article-brief-desktop.jpg`

#### G-026

- **Page / Route:** `/methodology`
- **Location:** Long-form method sections and large unused lower page area
- **Graphic Type:** Decorative graphic / explanatory divider
- **Current State:** Optional enhancement
- **Problem:** The page is unusually text-dense at the top and then has a very large visually empty black area before the footer. The background texture does not provide enough pacing.
- **Required Graphic:** Small section dividers, rule diagrams or a compact “standard → evidence → labeling → publication → correction” visual.
- **Purpose:** Improve long-page rhythm and make the methodology structure easier to scan.
- **Recommended Direction:** Purely informational line graphics; no illustrative metaphor that could make policy feel ornamental.
- **Variants:** Desktop; mobile stacked.
- **Recommended Format:** SVG/CSS.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/methodology-desktop-full.jpg`

#### G-027

- **Page / Route:** `/information-war`
- **Location:** Hero / chapter intro
- **Graphic Type:** Hero illustration / conceptual background
- **Current State:** Missing
- **Problem:** The page has a strong statement (“This is an information war.”) but no visual concept for signal, narrative, distortion or verification.
- **Required Graphic:** Conceptual hero graphic that can carry the five-chapter system.
- **Purpose:** Establish the topic visually before the long explanatory sections.
- **Recommended Direction:** Layered signal/noise bands, redacted headlines, or a split verified/unverified waveform; keep it abstract and non-photographic.
- **Variants:** Desktop; mobile crop; chapter state.
- **Recommended Format:** SVG or CSS composition.
- **Priority:** P2 — Polish
- **Evidence:** `screenshots/graphics-audit/information-war-desktop.jpg`

#### G-028

- **Page / Route:** `/updates`
- **Location:** Feed filters and vertical feed/timeline
- **Graphic Type:** Timeline marker / data-visualization accent
- **Current State:** Existing but weak
- **Problem:** The feed has a useful timeline structure and filter pills, but entries are visually close to one another and lack type/status markers beyond text.
- **Required Graphic:** Feed-type markers for Daily Brief, Israel Update, War Update and Narrative Watch, plus a subtle current/latest marker.
- **Purpose:** Improve chronology and category scanning.
- **Recommended Direction:** Reuse G-020/G-025 icon tokens; keep the timeline sparse.
- **Variants:** Desktop; mobile; filter selected/unselected.
- **Recommended Format:** SVG/CSS.
- **Priority:** P3 — Nice to have
- **Evidence:** `screenshots/graphics-audit/updates-desktop.jpg`

#### G-029

- **Page / Route:** Linked source and legacy paths discovered from product pages
- **Location:** Source/external link affordances
- **Graphic Type:** Badge / external-link graphic
- **Current State:** Missing
- **Problem:** Product routes link to heterogeneous records and external/legacy sources. The interface does not visibly distinguish “internal published record”, “indexed source”, “external source” and “legacy path”.
- **Required Graphic:** Source provenance badge family with internal/external/legacy/unavailable variants.
- **Purpose:** Prevent users from mistaking a source page for a first-party published record.
- **Recommended Direction:** Small icon + text badge; use a consistent external-link arrow and source category color.
- **Variants:** Desktop; mobile; internal/external/legacy/unavailable.
- **Recommended Format:** SVG/CSS.
- **Priority:** P3 — Nice to have
- **Evidence:** `screenshots/graphics-audit/article-reported-claim-desktop.jpg`

## Visual consistency assessment

- **Strong:** Black/gold/cream palette, serif display typography, monospace metadata, thin rules, dossier framing and scan-text background are broadly coherent.
- **Primary weakness:** The same background texture is used at similar density on home, editorial, archive, utility and error pages. It provides brand atmosphere but not enough section hierarchy.
- **Iconography:** Utility icons are too small and mixed with text glyphs/chevrons. A shared icon token set is needed before adding one-off graphics.
- **Visual weight:** Home has a bespoke lion illustration, while most other pages are almost entirely typographic. The jump from high-impact hero to text-only archive is abrupt.
- **Empty/error states:** War Update, Search, Corrections, Account and 404 each use text-first states with different levels of framing. They need a common state-graphic system.
- **Archive safety:** October 7 correctly avoids auto-displaying graphic media, but the archive does not yet have a clear visual placeholder/type system that explains the boundary.
- **Data visualization:** Israel’s Story and We Are have structural timelines but not enough iconographic or spatial encoding. Fake Resistance would benefit most from a relationship diagram; no chart/dashboard-style visualization was present.
- **Brand completeness:** The browser views did not reveal compact logo, favicon/app icon or social-share graphic usage.

## Master list

| ID | Graphic Type | Page(s) | Priority | Evidence | Status |
|---|---|---|---|---|---|
| G-001 | Intro illustration/state | `/` | P0 | `home-desktop.jpg` | Existing but weak |
| G-002 | Logo/app/OG | Shared shell | P1 | `home-main-desktop.jpg` | Missing |
| G-003 | Hero illustration | `/` | P3 | `home-main-desktop.jpg` | Existing and reusable |
| G-004 | Background texture | Shared pages | P2 | `information-war-desktop.jpg` | Existing but weak |
| G-005 | Icon set | Shared shell, Search, Ask | P2 | `ask-desktop-full.jpg` | Existing but inconsistent |
| G-006 | Empty-state illustration | `/war-update` | P1 | `war-update-desktop.jpg` | Existing but weak |
| G-007 | Filter/status icons | `/geopolitical-brief` | P2 | `geopolitical-brief-filtered-desktop.jpg` | Existing but weak |
| G-008 | Editorial markers/thumbnails | Brief, Updates, articles | P1 | `geopolitical-brief-desktop-full.jpg` | Missing |
| G-009 | Network diagram | Fake Resistance | P1 | `fake-resistance-case-desktop.jpg` | Missing |
| G-010 | Process icon set | `/we-are` | P1 | `we-are-desktop.jpg` | Missing |
| G-011 | Safe avatar/portrait frame | `/our-heroes` | P1 | `our-heroes-desktop.jpg` | Placeholder |
| G-012 | Map/timeline | `/israels-story` | P1 | `israels-story-desktop.jpg` | Missing |
| G-013 | Action icons | `/support-us` | P2 | `support-us-desktop.jpg` | Missing |
| G-014 | Evidence/question illustration | `/ask` | P2 | `ask-desktop-full.jpg` | Missing |
| G-015 | Async state graphics | `/ask` | P1 | `ask-suggestion-selected-desktop.jpg` | Missing |
| G-016 | Empty ledger graphic | `/corrections` | P1 | `corrections-desktop.jpg` | Placeholder |
| G-017 | Auth/session graphic | `/account` | P1 | `account-desktop.jpg` | Placeholder |
| G-018 | Search/keyboard tokens | `/search` | P2 | `search-desktop-full.jpg` | Existing but inconsistent |
| G-019 | No-results state | `/search` | P0 | `search-no-results-desktop-full.jpg` | Existing but weak |
| G-020 | Result-type/status icons | `/search` | P2 | `search-populated-desktop-full.jpg` | Existing but weak |
| G-021 | Testimony placeholder | October 7 archive | P1 | `october-7-testimonies-desktop.jpg` | Placeholder |
| G-022 | Language markers | Testimonies archive | P1 | `october-7-testimonies-desktop.jpg` | Placeholder |
| G-023 | Safe media placeholders | Documentation archive | P1 | `october-7-documentation-desktop.jpg` | Placeholder |
| G-024 | 404/missing-file illustration | 404, missing record | P1 | `legacy-error-desktop.jpg` | Existing but weak |
| G-025 | Source/status icons | Articles | P2 | `article-brief-desktop.jpg` | Existing but weak |
| G-026 | Editorial dividers/diagram | `/methodology` | P2 | `methodology-desktop-full.jpg` | Optional enhancement |
| G-027 | Conceptual hero | `/information-war` | P2 | `information-war-desktop.jpg` | Missing |
| G-028 | Feed markers | `/updates` | P3 | `updates-desktop.jpg` | Existing but weak |
| G-029 | Provenance badges | Source/legacy links | P3 | `article-reported-claim-desktop.jpg` | Missing |

## Required summary

- **Total pages discovered:** 179 unique internal routes from the live link crawl.
- **Total pages inspected:** 179 routes visited in the browser at desktop viewport; 16 primary product routes plus nested product/archive/article/source/legacy routes.
- **Total screenshots created:** 117 persisted screenshot files in `screenshots/graphics-audit/` at completion of the audit pass, including named evidence and bulk route screenshots.
- **Desktop screens checked:** 179 desktop route visits; significant screens also have dedicated viewport/full-page captures.
- **Mobile screens checked:** 0. The supplied browser session exposed a fixed 1363×936 viewport and no device emulation/resize capability.
- **Tablet screens checked:** 0 for the same tool limitation.
- **States checked:** Home intro/skip attempt, home main, search idle, search loading, search populated, search no-results attempt, Ask idle, Ask suggestion-selected, Ask ready-to-submit, War Update empty, Updates selected default filter, Daily Brief filter row/filtered attempt, archive list states, archive no-results attempt, Support action focus/click attempt, unauthenticated Account loading/check, 404/file-not-found, missing record.
- **Total graphic requirements:** 29 unique requirements.
- **P0 count:** 2.
- **P1 count:** 14.
- **P2 count:** 10.
- **P3 count:** 3.

## Top 10 highest-priority graphics

1. **G-001** — Intro overlay/progress/skip treatment.
2. **G-019** — Stable Search no-results state and empty-state graphic.
3. **G-006** — War Update empty/live-desk status illustration.
4. **G-023** — Safe documentation media placeholder and on-request boundary.
5. **G-021** — Consent-safe testimony/account placeholder.
6. **G-024** — 404/missing-record signal-loss illustration.
7. **G-009** — Fake Resistance network/case diagram.
8. **G-010** — We Are methodology process icons.
9. **G-012** — Israel’s Story map/timeline graphic.
10. **G-002** — Compact logo, favicon/app icon and branded OG assets.

## Pages not fully checkable

- **Mobile and Tablet:** Not checkable because the connected browser did not expose viewport/device emulation. Exact consequence: responsive wrapping, mobile navigation, touch hit areas, mobile image crops and mobile-specific states remain unverified.
- **Authenticated Account states:** Not checkable because no credentials were available or entered. The unauthenticated “Checking your sign-in…” state was captured.
- **Documentation/testimony media detail:** Not opened after the archive warned that records contain graphic content and that media is shown only on request. The archive/list/placeholder boundary was checked; individual media presentation is intentionally unverified.
- **Ask success/error response:** Not submitted as a real request because doing so would create a live product interaction and was not necessary to audit the visible idle/ready states. Loading/error/success graphics remain unverified.
- **Hover-only states:** Not systematically checked; browser automation exposed click/fill but not a reliable full hover-state capture workflow for this audit.
- **Some full-page archive captures:** The very long testimony/documentation archive pages timed out during full-page screenshot capture in the browser protocol. Their desktop viewport evidence is present (`october-7-testimonies-desktop.jpg`, `october-7-documentation-desktop.jpg`), while their record lists were still visited and inspected through the live browser.

## Stop condition

Audit complete. No implementation, asset creation, asset replacement or redesign was started.

---

# Mobile & Responsive Graphics Supplement

Date: 2026-09-04  
Scope: Complementary Mobile/Tablet browser audit only. The Desktop Audit above remains the baseline. No code, CSS, UI, asset, illustration, or production graphic was changed.

## Method and viewport evidence

The live site was inspected in a real Playwright Chromium browser with touch/device-emulation contexts at `390 × 844`, `375 × 667`, `430 × 932`, and selected `768 × 1024` Tablet contexts. Screenshots were saved under `screenshots/graphics-audit/mobile/`. Safe archive interfaces were inspected without opening graphic media. No live Ask submission was made.

Observed global result: the responsive shell fit the tested viewport widths without document-level horizontal overflow (`scrollWidth = viewport width`) on the inspected routes. The mobile header presents a compact text lockup plus Search, Ask, and Menu controls. The Menu drawer provides a close button, backdrop, grouped navigation, and visible route labels.

## Mobile Findings by existing G-ID

### G-001 — Intro illustration/state

- **Mobile Findings:** Mobile variant required. The intro remains a full-viewport black signal state and the `SKIP INTRO` control is visible, but the control occupies a large portion of the lower mobile frame and the intro does not explain progress beyond the label.
- **Mobile Variant:** `375 × 667`, `390 × 844`, `430 × 932`; preserve full-viewport crop; keep skip control inside the safe lower inset with at least 44 px touch height; provide reduced-motion immediate reveal.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/home-mobile-390.jpg`, `screenshots/graphics-audit/mobile/home-main-mobile-390.jpg`
- **Priority:** P0 unchanged.

### G-002 — Logo/app/OG

- **Mobile Findings:** Mobile variant required. The compact header lockup is legible at 390 px, but it is still a two-line wordmark and competes with three utility controls. A compact lion mark is not currently visible in the mobile shell.
- **Mobile Variant:** `375–430 px`; provide a lion-mark-only fallback below approximately 360 px or when the header is constrained; keep the two-line lockup at 390 px; preserve dark/light contrast.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/home-main-mobile-390.jpg`, `screenshots/graphics-audit/mobile/home-mobile-390-menu-open.jpg`
- **Priority:** P1 unchanged.

### G-003 — Hero illustration

- **Mobile Findings:** Mobile crop required. The lion remains readable and centered, but the artwork and wordmark form a tall stacked composition that dominates the first fold.
- **Mobile Variant:** `390 × 844` and `375 × 667`; use a centered portrait crop with the lion above the wordmark; preserve eye detail and avoid cutting the scan halo; allow a tighter `430 px` crop only if the CTA remains above the fold.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/home-main-mobile-390.jpg`
- **Priority:** P3 unchanged.

### G-004 — Background texture

- **Mobile Findings:** Mobile simplified variant required. The typewriter texture is visible behind every section and can read as noise behind small metadata and long text.
- **Mobile Variant:** `375–430 px`; use low-density/low-contrast texture behind body content, with stronger texture only in hero or section headers; never reduce text contrast to preserve atmosphere.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/home-main-mobile-390.jpg`, `screenshots/graphics-audit/mobile/methodology-mobile-390-full.jpg`
- **Priority:** P2 unchanged.

### G-005 — Icon set

- **Mobile Findings:** Mobile layout treatment required. Search, Ask, and Menu are present and distinct, but the controls are icon-led and visually small relative to touch use; the Menu label remains text while Search/Ask are icon-first.
- **Mobile Variant:** `375–430 px`; minimum 44 × 44 px hit areas; consistent outline family; retain labels for Menu and accessible names for icon-only Search/Ask; explicit focus/active state.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/home-main-mobile-390.jpg`, `screenshots/graphics-audit/mobile/home-mobile-390-menu-open.jpg`
- **Priority:** P2 unchanged.

### G-006 — Empty-state illustration

- **Mobile Findings:** Mobile variant required. The War Update empty state stacks cleanly and remains readable, but the status ring is too small to distinguish empty from loading at a glance.
- **Mobile Variant:** `390 × 844`; compact centered status graphic above the message; provide distinct empty/loading/error glyphs; keep CTA full-width or near full-width.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/war-update-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-007 — Filter/status icons

- **Mobile Findings:** Mobile layout treatment required. The Daily Brief filter collapses to a full-width control; the desktop filter row is not a suitable direct resize.
- **Mobile Variant:** `375–430 px`; stacked filter controls or a single filter drawer trigger; selected state must remain visible without relying on a desktop row; minimum 44 px controls.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/geopolitical-brief-mobile-390.jpg`
- **Priority:** P2 unchanged.

### G-008 — Editorial markers/thumbnails

- **Mobile Findings:** Responsive variant needed. Text-only records remain usable but become long and repetitive on narrow screens; a small marker is more valuable than a large thumbnail.
- **Mobile Variant:** `390 px`; use 24–32 px record-type markers or a narrow leading rail; do not add full-width imagery that pushes the first result below the fold.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/geopolitical-brief-mobile-390.jpg`, `screenshots/graphics-audit/mobile/updates-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-009 — Network diagram

- **Mobile Findings:** Different mobile UX needed. The current case/network pages are text-first and fit, but a future desktop diagram cannot be resized into a readable 390 px canvas.
- **Mobile Variant:** `390 px`; use simplified clusters with stacked relationship cards and a selected-node detail view; optional horizontal scroll or zoom/pan only for an explicitly diagrammatic view; do not force the full graph into the viewport.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/fake-resistance-mobile-390.jpg`, `screenshots/graphics-audit/mobile/fake-resistance-network-mobile-390.jpg`, `screenshots/graphics-audit/mobile/fake-resistance-network-mobile-390-full.jpg`
- **Priority:** P1 unchanged.

### G-010 — Process icon set

- **Mobile Findings:** Mobile layout treatment required. The process content is already long and vertical; icons should aid scanning without adding another wide timeline.
- **Mobile Variant:** `375–430 px`; vertical numbered steps with one icon plus short label per step; current/completed state should use a restrained accent; avoid horizontal overflow.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/we-are-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-011 — Safe avatar/portrait frame

- **Mobile Findings:** Mobile variant required. Text-only profiles fit, but the identity placeholder should be compact and consent metadata must remain readable.
- **Mobile Variant:** `390 px`; 48–64 px silhouette/monogram anchored to each profile header; stack consent/source metadata below rather than beside narrow text.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/our-heroes-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-012 — Map/timeline

- **Mobile Findings:** Different mobile UX needed. The current chapter index is readable, but a future combined map/timeline cannot be a shrunken desktop map.
- **Mobile Variant:** `390 px`; vertical chapter-by-chapter timeline with selected chapter detail; map should be horizontally scrollable or revealed behind an expandable control; simplify labels and use a clear legend.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/israels-story-mobile-390.jpg`, `screenshots/graphics-audit/mobile/israels-story-mobile-390-full.jpg`, `screenshots/graphics-audit/mobile/israels-story-tablet-768.jpg`
- **Priority:** P1 unchanged.

### G-013 — Action icons

- **Mobile Findings:** Mobile variant required. The action list stacks cleanly, but text-only rows make the four contribution paths visually similar.
- **Mobile Variant:** `375–430 px`; use 24 px leading action icons with full-row tap targets; keep label and explanatory text stacked; preserve focus/selected treatment.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/support-us-mobile-390.jpg`
- **Priority:** P2 unchanged.

### G-014 — Evidence/question illustration

- **Mobile Findings:** Mobile simplified variant required. The Evidence Boundary card appears low in the first viewport after the composer and explanatory copy; a large illustration would worsen page length.
- **Mobile Variant:** `390 px`; use a small corpus/source marker beside or above the boundary heading; keep it abstract, static, and secondary to the evidence text.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/ask-mobile-390.jpg`, `screenshots/graphics-audit/mobile/ask-mobile-390-full.jpg`
- **Priority:** P2 unchanged.

### G-015 — Async state graphics

- **Mobile Findings:** Needs further implementation testing. Idle and selected-suggestion states fit, but loading/error/success were not exposed without a live submission.
- **Mobile Variant:** `390 px`; full-width stacked composer and answer states; use a compact scan indicator and source markers; do not require an avatar or animation for comprehension.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/ask-mobile-390.jpg`, `screenshots/graphics-audit/mobile/ask-mobile-390-full.jpg`
- **Priority:** P1 unchanged.

### G-016 — Empty ledger graphic

- **Mobile Findings:** Mobile variant required. The Corrections page is readable, but the empty/public-ledger state has no visual anchor and the page is mostly text.
- **Mobile Variant:** `390 px`; small centered empty-ledger document/stamp above the count; retain a distinct populated state without increasing card height excessively.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/corrections-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-017 — Auth/session graphic

- **Mobile Findings:** Mobile variant required. The account card fits with generous side margins, but a compact session marker would clarify the signed-out/loading state.
- **Mobile Variant:** `375–430 px`; 32–48 px profile/lock marker; stack loading and signed-out copy; preserve clear focus for the sign-in action.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/account-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-018 — Search/keyboard tokens

- **Mobile Findings:** Different mobile UX needed. Desktop keyboard hints are not relevant as a primary mobile treatment; the search view should not simply resize the key legend.
- **Mobile Variant:** `375–430 px`; hide or collapse `↑`, `↓`, `↵`, and `esc` hints on touch contexts; replace with visible clear/open affordances and touch-friendly result-row behavior.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/search-mobile-390.jpg`, `screenshots/graphics-audit/mobile/search-mobile-390-full.jpg`
- **Priority:** P2 unchanged.

### G-019 — No-results state

- **Mobile Findings:** Mobile variant required. The search field and suggestion chips stack without document overflow, but the no-results/fallback distinction remains a product-state requirement rather than a resize issue.
- **Mobile Variant:** `390 px`; compact empty-search graphic above a single recovery action; separate loading, no-results, fallback, and error visual states; chips wrap or become horizontally scrollable without clipping.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/search-mobile-390.jpg`, `screenshots/graphics-audit/mobile/search-mobile-390-full.jpg`
- **Priority:** P0 unchanged.

### G-020 — Result-type/status icons

- **Mobile Findings:** Mobile simplified variant required. Result rows are narrow and uniform; type/status icons must communicate record class without widening the row.
- **Mobile Variant:** `390 px`; 20–24 px leading icon plus two-line metadata; no-page/source status icon must remain adjacent to the status text; avoid badge overflow.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/search-mobile-390.jpg`, `screenshots/graphics-audit/mobile/search-mobile-390-full.jpg`
- **Priority:** P2 unchanged.

### G-021 — Testimony placeholder

- **Mobile Findings:** Mobile variant required. The archive cards stack cleanly, but a safe identity placeholder would help separate testimony records from dense text.
- **Mobile Variant:** `390 px`; compact 48 px witness/document marker in the card header; language/source metadata below; no portrait or graphic media auto-load.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/october-7-testimonies-mobile-390.jpg`, `screenshots/graphics-audit/mobile/october-7-testimonies-mobile-390-full.jpg`
- **Priority:** P1 unchanged.

### G-022 — Language markers

- **Mobile Findings:** Mobile layout treatment required. The language/filter controls need wrapping/stacking; text-only labels are still necessary, but iconography must not replace them.
- **Mobile Variant:** `375–430 px`; wrap into accessible rows or open a selector; selected language remains visually explicit; minimum 44 px tap height and no clipped counts.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/october-7-testimonies-mobile-390.jpg`, `screenshots/graphics-audit/mobile/october-7-testimonies-mobile-390-full.jpg`
- **Priority:** P1 unchanged.

### G-023 — Safe media placeholders

- **Mobile Findings:** Mobile simplified variant required. The documentation archive is readable, but the future safe-media boundary must not use a detailed or auto-loaded thumbnail that can be misread as accessible media.
- **Mobile Variant:** `390 px`; compact covered frame with film/photo/document icon, warning label, and on-request affordance; keep the placeholder static and stacked above metadata.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/october-7-documentation-mobile-390.jpg`, `screenshots/graphics-audit/mobile/october-7-documentation-mobile-390-full.jpg`
- **Priority:** P1 unchanged.

### G-024 — 404/missing-file illustration

- **Mobile Findings:** Mobile variant required. The 404 card and recovery file list fit, but the error remains text-first and the recovery hierarchy is long on 375 px.
- **Mobile Variant:** `375–430 px`; small signal-loss/file marker above the error title; distinguish 404, missing record, and source-unavailable states; keep recovery action full-width.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/not-found-mobile-390.jpg`
- **Priority:** P1 unchanged.

### G-025 — Source/status icons

- **Mobile Findings:** Mobile simplified variant required. Article metadata is dense and wraps into multiple lines; icons should replace repeated words only where they improve scanability.
- **Mobile Variant:** `390 px`; 16–20 px provenance icons in a two-column or stacked metadata block; keep source names and external-link labels textual.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/article-mobile-390.jpg`
- **Priority:** P2 unchanged.

### G-026 — Editorial dividers/diagram

- **Mobile Findings:** Mobile layout treatment required. The methodology page is readable but long; dividers should provide orientation, not add decorative height.
- **Mobile Variant:** `390 px`; compact stacked standard → evidence → labeling → publication → correction sequence; use short rules and icons with no wide diagram.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/methodology-mobile-390.jpg`, `screenshots/graphics-audit/mobile/methodology-mobile-390-full.jpg`
- **Priority:** P2 unchanged.

### G-027 — Conceptual hero

- **Mobile Findings:** Mobile crop required. The information-war statement remains legible, but the future conceptual hero must keep the headline dominant and avoid a wide signal/noise composition.
- **Mobile Variant:** `390 px`; portrait crop or vertically stacked signal bands; retain contrast and keep the first CTA within the initial content block.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/information-war-mobile-390.jpg`
- **Priority:** P2 unchanged.

### G-028 — Feed markers

- **Mobile Findings:** Responsive variant needed. The Updates feed stacks, but the entries are visually close and the filter/feed hierarchy occupies much of the first screen.
- **Mobile Variant:** `390 px`; 20–24 px category marker in the timeline rail plus a compact latest marker; preserve selected filter as a single visible control.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/updates-mobile-390.jpg`, `screenshots/graphics-audit/mobile/updates-tablet-768.jpg`
- **Priority:** P3 unchanged.

### G-029 — Provenance badges

- **Mobile Findings:** Mobile simplified variant required. Narrow source links can be mistaken for first-party records when badge text wraps or becomes visually secondary.
- **Mobile Variant:** `375–430 px`; use icon + short text (`Internal`, `External`, `Legacy`, `Unavailable`) with wrap-safe badge sizing; keep the external-link indicator visible.
- **Mobile Evidence:** `screenshots/graphics-audit/mobile/article-mobile-390.jpg`, `screenshots/graphics-audit/mobile/search-mobile-390.jpg`
- **Priority:** P3 unchanged.

## Mobile Master Table

| ID | Mobile Status | Required Mobile Variant | Viewport | Evidence | Priority Change |
|---|---|---|---|---|---|
| G-001 | Mobile variant required | Full-viewport intro, safe skip, reduced-motion reveal | 375/390/430 | `home-mobile-390.jpg` | None |
| G-002 | Mobile variant required | Compact lion mark / constrained header | 375–430 | `home-main-mobile-390.jpg` | None |
| G-003 | Mobile crop required | Portrait lion + wordmark composition | 390 | `home-main-mobile-390.jpg` | None |
| G-004 | Mobile simplified variant required | Low-density texture tiers | 375–430 | `methodology-mobile-390-full.jpg` | None |
| G-005 | Mobile layout treatment required | 44 px touch targets, consistent icons | 375–430 | `home-mobile-390-menu-open.jpg` | None |
| G-006 | Mobile variant required | Compact status family | 390 | `war-update-mobile-390.jpg` | None |
| G-007 | Mobile layout treatment required | Stacked/drawer filters | 375–430 | `geopolitical-brief-mobile-390.jpg` | None |
| G-008 | Responsive variant needed | Small record-type markers | 390 | `updates-mobile-390.jpg` | None |
| G-009 | Different mobile UX needed | Simplified clusters/cards, selected node | 390 | `fake-resistance-network-mobile-390.jpg` | None |
| G-010 | Mobile layout treatment required | Vertical numbered process | 375–430 | `we-are-mobile-390.jpg` | None |
| G-011 | Mobile variant required | Compact consent-safe identity marker | 390 | `our-heroes-mobile-390.jpg` | None |
| G-012 | Different mobile UX needed | Vertical timeline + optional scroll/reveal map | 390/768 | `israels-story-mobile-390.jpg` | None |
| G-013 | Mobile variant required | Leading action icons, full-row targets | 375–430 | `support-us-mobile-390.jpg` | None |
| G-014 | Mobile simplified variant required | Small evidence/corpus marker | 390 | `ask-mobile-390.jpg` | None |
| G-015 | Needs further implementation testing | Stacked async states | 390 | `ask-mobile-390-full.jpg` | None |
| G-016 | Mobile variant required | Compact empty-ledger marker | 390 | `corrections-mobile-390.jpg` | None |
| G-017 | Mobile variant required | Compact session marker | 375–430 | `account-mobile-390.jpg` | None |
| G-018 | Different mobile UX needed | Hide keyboard legend; touch treatment | 375–430 | `search-mobile-390.jpg` | None |
| G-019 | Mobile variant required | Distinct no-results/recovery state | 390 | `search-mobile-390-full.jpg` | None |
| G-020 | Mobile simplified variant required | 20–24 px result-type/status icons | 390 | `search-mobile-390.jpg` | None |
| G-021 | Mobile variant required | Compact safe testimony marker | 390 | `october-7-testimonies-mobile-390.jpg` | None |
| G-022 | Mobile layout treatment required | Wrapped/selector language controls | 375–430 | `october-7-testimonies-mobile-390.jpg` | None |
| G-023 | Mobile simplified variant required | Covered media frame + boundary label | 390 | `october-7-documentation-mobile-390.jpg` | None |
| G-024 | Mobile variant required | Compact signal-loss recovery marker | 375–430 | `not-found-mobile-390.jpg` | None |
| G-025 | Mobile simplified variant required | Compact provenance metadata icons | 390 | `article-mobile-390.jpg` | None |
| G-026 | Mobile layout treatment required | Compact stacked methodology sequence | 390 | `methodology-mobile-390-full.jpg` | None |
| G-027 | Mobile crop required | Portrait signal/noise composition | 390 | `information-war-mobile-390.jpg` | None |
| G-028 | Responsive variant needed | Sparse category/current markers | 390/768 | `updates-mobile-390.jpg` | None |
| G-029 | Mobile simplified variant required | Wrap-safe provenance badges | 375–430 | `article-mobile-390.jpg` | None |

No new mobile-only G-ID was required. Every observed mobile/tablet need mapped to an existing desktop requirement.
