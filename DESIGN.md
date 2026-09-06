# Lions of Zion — design context

## Overview

An English-language evidence and public-information site. The public homepage
is a brand/content surface, not an application dashboard. Preserve real
publication content, source labels, verdicts and timestamps. Never manufacture
freshness or proof to fill a layout.

## Runtime ownership

`app/globals.css` is the canonical token source. This document records intent;
it does not generate or duplicate theme values. Fonts are loaded by
`app/layout.tsx`; route modules and shared primitives consume the tokens.

## Existing identity

- Ground and text: `--ground`, `--ink-hi`, `--ink`, `--ink-lo`.
- Accent and interaction: `--gold`, `--gold-hi`, `--control-line`.
- Shared typography: `--face-display`, `--face-text`, `--face-data`.
- Spacing, controls and motion: `--sp-*`, `--control-h`, `--dur-*`.
- The photographic lion is the homepage's signature. Keep its face unobscured.
- Earlier homepage-only scope is superseded by the owner’s September 5 full
  public-interface review. Shared typography now follows the direction below.

## Homepage direction — September 5, 2026

The owner rejected the small tightly tracked sans wordmark, italic tagline,
white rectangular CTA, and the generic title/subtitle/button composition.
Do not treat those intermediate implementations as approved design decisions.

Current implementation for review: a monumental two-line serif nameplate.
“LIONS” carries the first line; a smaller “OF” sits beside “ZION” on the second.
The supporting sentence is quiet, upright sans text. The action is an open,
underlined reading invitation paired with a outlined circular arrow, not a
filled rectangle. This is specific to the homepage, not a site-wide rebrand.

| Role | Canonical token | Consumer |
| --- | --- | --- |
| Monumental nameplate | `--face-home-emphasis` → loaded Newsreader | Homepage wordmark |
| Supporting copy and mobile news | `--face-home-cover` → loaded Inter Tight | Standfirst and mobile news |
| Desktop nameplate scale | `--t-home-wordmark` | Two-line desktop wordmark |
| Mobile nameplate scale | `--t-home-wordmark-mobile` | Two-line mobile wordmark |
| Shared mobile inset | `--home-gutter` | Mobile masthead, record and Ask utility |

Existing ink and control-line tokens supply the text and the arrow outline.
Hover and focus invert the arrow only; active uses the existing gold token.
No new palette, dependency, decorative numbering, fake proof or animation.
The nameplate is the typographic signature; the lion remains unobscured.

Desktop has a lower-left masthead, separated from the real publication rail.
Mobile gives the portrait its upper space, then presents the nameplate and
record in natural flow. Short screens scroll instead of compressing everything
into one viewport. Mobile Ask stays fixed above the device's safe area, with
trailing page space to let the final record scroll clear of it. The mobile news
rail uses a compact two-row cue: label/archive action, then one headline line.
Source, verdict and date stay in the accessibility tree and on the full record,
but no longer occupy a third visible row. Space is reserved for the persistent
Ask utility, so it never covers the rail. These rules do not change desktop.
On the mobile homepage the Ask control sits one spacing step above the rail.
Ask uses one shared Signal Lens mark at every width: an open inspection frame,
an eye contour and a vertical lion pupil. It stays legible at 20px without a
second ring, compass detail, question mark or generic AI sparkle.
The owner rejected the rectangular Ask plate, its extra desk caption and arrow.
Replacement for review: a compact circular seal with the shared mark above the
visible Ask label, at all widths (68px desktop, 64px mobile). No sidebar stripe,
caption, arrow or rectangular background. The shared Ask stylesheet owns this
geometry and consumes the existing ground, control-line, gold and data-type
tokens. Keep the established safe-area offsets and architecture-page placement;
keyboard focus outlines the seal and pressing it inverts the ink and gold.
Preserve no-script navigation, poster fallback, reduced-motion behavior,
semantic links, visible focus, real verdicts, dates and publication content.

## Information-war direction — September 5, 2026

Audience: donors and supporters; scope: the whole system. The interactive
architecture is an explanation, never a pretend live operations monitor.
Implementation for review, not a record of owner approval.

A public field guide: monumental Newsreader introduction, a source-convergence
illustration, then a literal explorable architecture drawing. IBM Plex Sans
carries explanations; the existing mono face is reserved for identifiers.
The page uses `--face-system-display` and `--face-system-text` in the canonical
global token file. Existing ground, ink, gold and line values remain unchanged.
The scan backdrop is silent here so unrelated fragments cannot read as evidence.

Gold identifies a selected route; ivory identifies the inspected node. Playback
is pausable, offscreen-aware and disabled under reduced motion. Mobile turns the
chosen route into an ordered vertical flow rather than shrinking a desktop map.
Every journey also has a server-rendered text alternative. No new dependencies.

Content separates the automated briefing chain, checked external packages,
direct imports, information-item research and the archive. Do not describe one
path's quality gates as universal. Configuration is labelled as configuration;
publication timestamps are not operational telemetry. Public records and error
or empty states are real, with no invented fallback articles or health badges.
All changes stay on this public route; no backend or publishing behavior changes.

### Content grounding for this route

- Automated jobs: `server/modules/briefing/service.ts` and
  `server/contracts/admin-console.ts`.
- Checked packages: `server/modules/briefing/external-publish.ts` and
  `server/modules/briefing/quality.ts`.
- Different direct-import path: `server/modules/briefing/codex-import.ts`.
- Public versions and publishing: `server/modules/publications/service.ts`.
- Conversation and retrieval limits: `server/modules/chat/service.ts`.
- Current configured schedules: `vercel.json`; no claim of live execution.
- Actual public output: `lib/publications.ts`; dates include the year and use
  Jerusalem time. No provider calls or publication writes are part of this page.

The compact-screen Ask launcher follows the document instead of overlaying the
architecture. The page also links directly to the durable `/ask` surface.

## Purpose-led navigation — September 5, 2026

Owner request: retire the separate War Update page, turn the brief hub into the
main news destination, concentrate narrative monitoring and incitement research
under Fake Resistance, invite contextual sharing of October 7 material, and
remove the numbered-file metaphor from navigation.

Current naming proposal implemented for review: **News & Analysis**. The URL
`/geopolitical-brief` is retained. `/war-update` permanently redirects there;
publication data and article URLs are not removed. The news hub already reads
both Israel and war updates. Its narrative collection is now a concise route
into the dedicated investigation hub rather than a duplicate feed.

The menu is an open editorial composition, not a grid of equally weighted
boxes: reporting/evidence are the primary choices; the system, people and
historical context form the second column. Methodology, corrections and account
remain useful secondary links in a compact utility row. No numbered labels,
file counts, extra reference heading or duplicate descriptions in mobile.

Use the existing Newsreader and IBM Plex Sans via `--face-navigation-display`
and `--face-navigation`. Preserve Escape, outside-click, mobile dialog focus
management, no-JavaScript navigation, keyboard focus and reduced motion.

The archive invitation asks readers to choose a relevant record and retain its
source, context and content warnings. No media is auto-opened or posted. The
monitoring entry describes published records, not a claimed live scanner; this
change does not start or alter an ingestion job.

## Reader accounts — September 5, 2026

Owner request: connect the Google and X sign-ins that already existed to the
public interface, and show a reader the state of their own account. No new
authentication system was built; no provider settings, OAuth scopes, admin
permissions or database schema were touched.

### Two accounts, never merged

Google and X are separate sign-ins with separate cookies and separate
sign-outs, and the interface says so at every level. The account page shows
them as two blocks side by side, each with its own sign-out; being signed into
one says nothing about the other. Deciding that a Google identity and an X
identity are the same person is a claim about who someone is, and it is not
inferred from two cookies arriving in one request.

The header is the one place that shows a single mark, because it is a way *to*
the account page rather than an identity display. It prefers Google when both
are present, deterministically.

### The rule the whole thing is shaped around

**A session check that has not landed is not a signed-out reader.**

The expensive failure on a sign-in surface is not an error message; it is an
invitation to sign in shown to someone who is already signed in, because a
request timed out. It reads as "you have been logged out".

So the shared state carries `known` separately from the identities.
`PublicSessionProvider` reads the session once for the whole tree, and both the
header and the account page must consult `known` before they say anything about
sign-in state. The header says "Sign in" only on `known`; in every other state
it falls back to the neutral `Account`, which is true in all of them. Errors
and retries live on the account page — the bar stays quiet.

`usePublicSession` degrades to that same unknown state when no provider is
above it, rather than throwing. It threw at first; five route tests that render
pages without the root layout showed that a header able to throw is a header
able to take a page render down with it. There is no wrong answer to fall back
to here, so falling back is safe, and the test suite pins that the root layout
mounts the provider.

### Avatars are initials, and that is a privacy decision

The header mark is initials, never a remote picture, and the session response
drops X's `profile_image_url` rather than forwarding it. Two reasons: the
site's `img-src` does not include `pbs.twimg.com`, so the image would be
blocked; and allowing it would mean every page load by a signed-in reader
issues a request that tells X where that reader is.

The visible header label stays `Account` or `Sign in` and does not become the
reader's name — a name can be four characters or thirty, and the bar may not
reflow when the session check lands. The name goes into the accessible name
instead: the link announces "Account, signed in as …". The mark slot and the
label slot hold their size across every state.

### X runs on the live site only

Approved owner decision, implemented rather than worked around. X's callback is
registered as `https://lionsofzion.io/auth/x/callback` and its cookies are
`__Host-` prefixed, which a browser will not write over plain http — so a
sign-in begun locally would return to production with no state cookie and fail
on arrival. Locally the X block says that plainly and links to the account page
on the live site. `/auth/x` refuses to mint state when it is not usable, so no
doomed flow can be started even by hand.

The guard asks the **request's own origin**, not `isProduction()`. It asked the
environment first, and measurement caught that not working: both `.env.local`
files on this machine declare `VERCEL_ENV="production"`, so the gate was true on
localhost and `GET http://localhost:3100/auth/x` really did redirect to x.com
and try to set a `__Host-` cookie the browser then refused — the precise dead
end the decision exists to prevent. An environment variable is a claim about
where the code is running. The origin the browser is on is the fact, and it is
also the thing that actually decides whether the cookie can be written and
whether X will call back. No origin, or a mismatched one, is treated as
unusable: starting a flow that cannot finish is worse than declining one that
could.

A provider without credentials is rendered as a sentence, not as an error and
not as a button that leads to a 500: the page is working, this deployment
simply has no credentials for it.

### Nothing is promised that does not exist

There is no saving, no preferences and no library behind this sign-in, and the
copy does not imply one. The menu's account description was "Saved work and
access." — it now reads "Sign in so the desk knows you between visits", which
is the whole of what an account currently does.

### Starting the X flow is an action, not a link

The X control is a `<form method="get" action="/auth/x">` with the canonical
Button, not a `ButtonLink`. `ButtonLink` resolves a relative href through
`next/link`, which prefetches — and `/auth/x` mints OAuth state and sets a
cookie, so prefetching it would spend a state cookie because a button scrolled
into view. A form submit is a real document navigation, which is also what an
external redirect needs. Google's own button is untouched: its script, its
consent, its brand, not restyled to pass as the site's.

Keyboard focus, `:focus-visible`, reduced motion and the existing header habit
of hiding a label as screen-reader-only rather than removing it are preserved
throughout.
## Admin workspace — September 5, 2026

Owner-approved direction: dark, compact, Hebrew operational workspace with
right-side grouped navigation and an on-demand assistant. No decorative grid,
hero masthead, fixed chat column or public Ask launcher on admin routes.
`app/admin/workspace.module.css` owns scoped density and palette; shared
primitives and existing Hebrew font are reused. Public pages retain their
visual system. The capability/behavior map and pending acceptance checks live
in `docs/admin-workspace.md`. Implementation is awaiting validation; this is
not a claim of visual acceptance.

## Typographic introduction and original home video — September 5, 2026

The owner replaced the particle entrance with a short, four-part typographic
introduction. The approved copy starts with the October 7 attack, then the
pre-existing propaganda machinery, the information war and the site's purpose.
No particle text, glowing logo, extra video or graphics engine. The old source
and assets are retained but CinematicIntroGate is not mounted.

EditorialIntro uses the existing Newsreader, Inter Tight, ink and amber tokens.
Text is printed in a fixed composition, never scattered or reflowed. It opens
once per tab session after hydration; Skip and Escape always exit, Pause holds
reading, Continue reveals or advances, and Watch introduction replays. It pauses
in background tabs. Reduced-motion visitors enter the site directly and may
replay static, manually advanced text. A native dialog contains keyboard focus;
the server-rendered/no-script homepage remains accessible.

Browser-validated 2026-09-05 at 1440x900 and at a 500x543 viewport: focus
lands on the panel rather than on Skip, the focus ring renders, Escape closes
and returns focus to the wordmark, the scroll lock releases, and the
reduced-motion path opens fully typed, paused and manually advanced. Two
defects were found and fixed in that pass — a fixed `min-height` on the
statement put the footer and every control below the fold on a short viewport,
and the Pause/Resume label swap resized its own control. The control now
reserves the wider label in a shared grid cell, and the statement's
reservation is viewport-bounded with the stage as the only scroller.

### The introduction's ground — September 5, 2026

Owner ruling: the flat black was out of date, because the site is not black
any more. Every reading route sits on the hero photograph held far back under
a 92-96% ground gradient (`body::before` in `globals.css` — "a room the type
is in rather than a picture behind it"), and the introduction was the last
surface still painting bare `--ground` over it.

It now takes the same still, and opens it. A decorative layer inside the
dialog carries `--site-ground-photo` at `68% center`, and its opacity lifts
one step per beat, keyed off `data-beat` on the dialog: 0.06 on October 7,
0.10, 0.14, then 0.18 as the last statement names the organisation — so the
close hands over to the moving version of the same shot at full strength. The
step is a `--dur-enter` opacity transition on a composited layer, dropped
under `prefers-reduced-motion` where the veil still differs per beat but
changes on the cut.

Contrast is not at risk: at the lightest step the photograph contributes 18%
over `--ground`, so even a pure-white source pixel bounds the ground at
approximately #373737 and `--ink-hi` holds about 10.8:1 against it, `--gold`
about 6.6:1 — both clear of the A11Y-004 floor. Verified across 320x568,
375x667, 768x1024, 1440x900 and 1920x1080: footer on screen, no overflow in
either axis, on every beat.

`EditorialIntro` deliberately does not use `components/ui/Dialog`: that
primitive is a narrow/wide panel with a mandatory header carrying an `<h2>`
and a close button, which is the product chrome a full-bleed editorial
takeover exists to not have. It honours the same behaviour contract instead —
accessible name and description, focus on the panel, Escape, `showModal()`
inertness, focus restoration — and reuses `politeLive` for its status region.
Revisit if a second full-bleed surface appears; one is not yet a variant.

The original HeroVideo background is preserved, including its separate desktop
and mobile sources, intro-to-loop handoff and matching posters. The supplied
cinematic-lion alternative is not used as the site background. Newly copied
alternative assets and the unused CinematicHomeMedia component remain local
and disconnected; they are not part of the active homepage.
The information-war page remains an explicit secondary reading destination.
Global typography/token ownership is unchanged.


## Public-interface review — September 5, 2026

Implemented for owner review, not yet visually approved. The public site now
uses Newsreader for editorial headings, IBM Plex Sans for reading and controls,
and Roboto Mono for metadata, through the existing shared font tokens. Body
copy and controls retain authored sentence case; metadata may remain uppercase.
Long article titles use a smaller responsive scale than brand statements.

Reading surfaces are quiet: no global ruled scanline wallpaper, and section
scan opacity is capped at 0.1. Preserve the subdued photographic ground and
the unchanged original homepage video. Gold signals action or status, not
large decorative panels. Prefer open ruled sections over gray boxed cards.
Shared buttons use restrained corners, wrapping labels, and no shimmer.
Forms remain legible, with visible borders, focus states and intrinsic sizing.

The news lead separates headline and summary on desktop and stacks on mobile.
Account access has a wider unboxed panel and provider labels cannot overflow.
Support choices are editorial links, not repeated pill buttons. The floating
Ask launcher is circular, retaining the existing icon and safe-area offsets.
Architecture journey controls scroll horizontally rather than collapsing text.
The homepage nameplate and original background video are not redesigned here.

Behavioral ownership is recorded in UX-CONTRACT.md. Coverage and remaining
limitations are in docs/visual-review-2026-09-05.md. Do not infer that a successful
build proves device rendering or that an unauthenticated review covers admin.

## News and narrative desks — approved structure, September 5

The owner approved separate reading journeys: news answers what happened;
narrative monitoring answers what is claimed and what the record establishes.
News leads with individual published updates, then the daily briefing. Never
manufacture story splits from a combined briefing headline. The latest story
is selected chronologically, not labelled an editorial importance ranking.

Retrieval follows reading: the archive is a native collapsed disclosure, opened
when filters are active. Its GET query does not change the current news at the
top. Reads are section-scoped so narrative records cannot crowd news out of the
retrieval limit. The archive explicitly states its 50-per-section window.

The narrative hub leads with the latest three published monitoring records,
then established investigations. The monitoring archive groups its latest 25
records by Jerusalem publication date; it is not described as a live scan.
NarrativeRecord owns status-before-claim presentation, status meaning, named
propagators and attribution of unsourced analysis. Do not infer source links
or article relationships. Existing article relationships remain authoritative.

These reading desks suppress the decorative scan and put the Ask launcher in
normal flow to avoid covering prose. Ask remains reachable through the menu.
Original homepage media and its launcher placement remain unchanged.

## Wide entrances — September 5 owner-approved replacement

Supersedes the previous document-like hub implementation. Both entrances use
up to 1600px of content width, 40px desktop gutters and 20px mobile gutters.
The narrative hub uses EditorialShell directly, not SectionPage: no contents
rail or duplicate section navigation. Its latest available investigation leads
beside three compact monitoring records, followed by three other investigations
and two research entrances. The two former background essays now live on the
network page; the existing playbook already holds the full methods collection.

News uses the same width but a distinct lead-story/sidebar composition. The
sidebar contains up to four additional updates or, when none exist, the daily
briefing. A briefing already shown there is not repeated below. No image is
added without verified relevance and usage rights; the lead is deliberately
typographic. The smaller page masthead yields prominence to actual content.
NarrativeRecord's compact variant keeps status, claim, meaning and date, with
the headline as its navigation target. Analysis without sources uses an honest
analysis action label in its expanded variant.

## Homepage editorial journey — September 6 local implementation

The homepage is now a continuous editorial entrance rather than a signal rail:
the preserved lion hero leads into News, Narratives & fact checks, October 7,
Our Heroes, Israel's Story and a static explanation of the publication system.
Each domain has its own semantic composition; the page does not repeat a generic
card grid or rotate headlines while a reader is present. `lib/homepage.ts` owns
the serializable composition and `components/home/` owns the six section
presentations. The first viewport remains identity and purpose, while real
canonical content begins immediately after the hero.

`content-packages/homepage/media.json` is the transitional curated media seam.
Generated illustrations and safe covers are labelled as such and never imply
source evidence. The durable edition store and protected cron route are local
implementation only; cloud scheduling and canonical publication cover fields
remain separate follow-up work.

### Full-page editorial redesign — September 6, 2026

The owner explicitly released earlier visual restrictions for this review.
This implementation is a new proposal, not a claim of visual acceptance.
The lion film and nameplate stay; the edition below now has its own contents
navigation, a lead/companion news composition, framed research dossiers,
staggered portrait profiles, aligned historical plates and a vertical system
reading path. October 7 is a deliberate paper-colored page turn, with dark
type and all safe-cover labels and content warnings preserved.

`homepage-journey.module.css` owns this route's layout/type scales and its three
paper tokens (`--journey-paper`, `--journey-paper-ink`, `--journey-paper-muted`).
They are scoped extensions, not replacements for the canonical global palette.
Existing Newsreader, IBM Plex Sans and metadata faces remain loaded once.
Home-specific header/footer variants keep navigation legible over the film,
provide a structured closing index and fix the homepage back-to-top target.
Other reading routes retain their existing chrome. No backend, publication,
source selection, media rights, account behavior or deployment changes.
Reduced-motion visitors see a face-centered crop of the existing landscape
poster instead of the portrait entrance's empty first beat; video assets and
normal playback remain unchanged. The desktop edition reserves a trailing
gutter for Ask, and mobile research excerpts wrap long account-name sequences.

## Full-interface polish pass — September 6, 2026

Implementation for review across the whole public interface. Durable system
decisions made in this pass:

- **Elevation is restrained, not refused.** `--shadow-1/2/3` in
  `app/globals.css` are real again: a lit top edge (`--edge-hi`) plus a short
  dark drop. `--surface-grade` is the faint vertical grade a raised plate
  carries; `--surface-0` is the tone between the ground and `--surface-1` for
  quiet wells. Tonal contrast and the hairline remain the primary depth cue;
  the shadow separates, it never glows. Interactive feature and dossier cards
  lift two pixels onto `--shadow-2` on hover; every button presses one pixel.
- **One footer for every route.** The colophon composition that was
  homepage-only — display nameplate, statement, Methodology and Corrections at
  reading size, four-column section index — is the shared close in
  `components/site/site-footer.module.css`. `home` only reserves room for the
  Ask seal.
- **The masthead casts once scrolled.** `SiteHeader` sets `data-scrolled`
  after 8px; the bar firms its rule and takes a soft drop.
- **Hub fronts share `components/site/HubMasthead`.** Kicker, display title,
  standfirst, edition facts, in-page jumps. News & Analysis and Narratives &
  fact checks both use it; the 28px single-line hub title is retired.
- **The Ask seal is fixed on every route at every width.** The rules that
  placed it in the document flow after the news and narrative fronts, and
  after the whole homepage under 1100px, are gone. Only the architecture
  drawing keeps an in-flow launcher.
- **Custom scrollbars are for fine pointers only.** iOS Safari honours
  `scrollbar-color` and paints a permanent strip; touch devices keep the
  platform bar.
- **`↗` always carries U+FE0E.** iOS renders the bare code point as an emoji
  square. Every arrow in TSX and CSS is `↗︎`.
- **Machine facets print as words.** Topic, actor and arena values
  (`defense_policy_and_programs`) are combed on every public surface.
- **Support chooser is four raised choice cards**, each one control, the
  primary carrying the gold rule. **404** speaks the editorial register with a
  primary action, search, and a card index of real destinations.
