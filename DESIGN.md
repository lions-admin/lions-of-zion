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
- Keep homepage changes scoped to that route. Do not change the shared
  uppercase policy or typography globally.

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
into one viewport. Mobile Ask follows the record rather than covering it.
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
