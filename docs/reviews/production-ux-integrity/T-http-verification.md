# T-5 / T-6 / T-11 / T-12 — HTTP-level verification against Production

**Target:** https://lionsofzion.io (live Production)
**Method:** `curl` + HTML/JSON parsing only. No browser, no writes, no
`/api/internal/*`, no database. Read-only throughout.
**Measured:** 2026-09-08, 10:45–10:57 UTC
**Working-tree head at time of measurement:** `f32b1d9`

Corpus under test: the public API returns **73 published publications**
(`GET /api/v1/published-publications?limit=100` → 73 rows; the endpoint caps
`limit` at 100 and rejects 200/500, and 73 < 100, so this is the whole live
corpus, not a page of it).

| Item | Verdict |
| --- | --- |
| T-5 Routing and redirects | **PASS** |
| T-6 Canonical IDs | **PASS** |
| T-11 Media states (HTTP-observable half) | **PASS with two recorded caveats** |
| T-12 Metadata | **FAIL** — every page except the homepage ships a `summary_large_image` card with no image |

---

## T-5 — Routing and redirects — PASS

Every destination resolves. Measured status code (and redirect target where
one exists), one request each:

| Route | Status |
| --- | --- |
| `/` | 200 |
| `/geopolitical-brief` | 200 |
| `/fake-resistance` | 200 |
| `/people-of-israel` | 200 |
| `/october-7` | 200 |
| `/information-war` | 200 |
| `/methodology` | 200 |
| `/we-are` | 200 |
| `/search` | 200 |
| `/ask` | 200 |
| `/corrections` | 200 |
| `/updates` | 200 |
| `/support-us` | 200 |
| `/fact-check` | 200 |
| `/our-heroes` | 200 — legacy address preserved (`LEGACY_SECTION_PAGES`, §9) |
| `/israels-story` | 200 — legacy address preserved (§9) |
| `/war-update` | **308** → `https://lionsofzion.io/geopolitical-brief` (target itself 200) |
| `/robots.txt` | 200, `text/plain; charset=utf-8` |
| `/sitemap.xml` | 200, `application/xml` |

`/war-update` is a **permanent** redirect (308, not 307/302) to
`/geopolitical-brief`, as required.

Also measured, beyond the required list — the eight sub-routes that use the
VA-62 metadata helper — all **200**: `/fake-resistance/{antisemitism, network,
official-narrative, playbook, social-media, watch}`,
`/october-7/{documentation, testimonies}`.

`robots.txt` body: `Allow: /` with `Disallow: /pipeline`, `/api/`, `/admin`,
`/auth`, and `Sitemap: https://lionsofzion.io/sitemap.xml`. Correct — nothing
public is disallowed, the private surfaces are.

`sitemap.xml` carries **617 `<loc>` entries**, of which **73 are
`/articles/<publicId>`**. Cross-checked against the API set: **0 articles in
the API and missing from the sitemap, 0 in the sitemap and missing from the
API** — exact correspondence. `/war-update` is correctly absent (a redirect
must not be a sitemap entry).

### Defect T-5.a (minor, sitemap coverage)

`/fake-resistance/watch` returns **200** and is a real destination
(`<title>Narrative monitoring archive — LIONS OF ZION</title>`) but has **no
`<loc>` in `sitemap.xml`** — `grep -c '<loc>https://lionsofzion.io/fake-resistance/watch</loc>'`
returns 0, while its six sibling `/fake-resistance/*` pages are all present.
Fix: add it to the static route list in `app/sitemap.ts`. Does not affect the
T-5 pass — every route in the required list resolves.

---

## T-6 — Canonical IDs — PASS

Source: `GET /api/v1/published-publications?limit=100` (anonymous, no
credentials sent) → 73 records.

- **Stable `publicId` on every record.** 0 records with a missing/empty
  `publicId`; 0 duplicate `publicId` values across the 73.
- **`canonicalStoryId` distinct across live rows.** 44 of 73 records carry a
  non-null `canonicalStoryId`; 29 carry none. **0 duplicates** among the 44 —
  the partial unique index `publication_canonical_story_once` holds on the live
  data. (This is an observation of the live set, which is what an HTTP-level
  check can prove; it does not exercise the index by attempting a second
  insert, and must not — writes are out of scope.)
- **Each record's own page returns 200 with a self-referential canonical.**
  All **73** `/articles/<publicId>` fetched individually: **73/73 → 200**, and
  **73/73** carry
  `<link rel="canonical" href="https://lionsofzion.io/articles/<publicId>"/>`
  matching their own `publicId` exactly. **0 mismatches.**

Canonical tags on the 16 destination routes were checked in the same sweep and
are all self-referential (`/methodology` → `https://lionsofzion.io/methodology`,
etc.); `/` → `https://lionsofzion.io`.

---

## T-11 — Media states — PASS, with two recorded caveats

### Media that exists resolves

14 of the 73 API records carry a `media` object. Every `media.src` resolves:

- 12 absolute Blob URLs
  (`https://sbxqiwt47c7ticlt.public.blob.vercel-storage.com/publications/media/…png`)
  → **206 `image/png`** on a ranged probe (all 12).
- 2 site-relative paths — `/images/homepage/regional-defense-brief.webp` and
  `/images/homepage/matcal.webp` → **200 `image/webp`**, 188 318 B and
  180 612 B respectively.

The Next image optimizer serves them too: a representative
`/_next/image?url=…&w=828&q=75` → **200 `image/png`, 257 077 B**. No broken
image, no placeholder, no 404 among the 14.

### Records without media render a designed text-led state

Across all 73 served article pages:

- **16 pages render exactly one `<img>`; 57 render none.** All 73 render
  exactly one `<h1>`.
- **0 pages** contain `src=""`, `src="undefined"`, a literal `>undefined<` or
  `>null<` text node, or an empty `<figure></figure>`. Same check over the 24
  destination/hub pages: **0**.
- A text-led page's header is fully composed, not a hole where a picture was:
  breadcrumb (`Home / The People of Israel / …`), section label
  (`History & Context`), `<h1>`, dek, plus a complete `NewsArticle` JSON-LD
  block with `datePublished` / `dateModified` / `mainEntityOfPage`.

Verdict: no record renders an undefined media state. No media gate was added
or suggested; this is measurement only.

### Caveat T-11.a — `mediaDisposition` is live on only a third of the corpus, and never on a record that has a picture

Distribution over the 73 API records:

| has `media` | `mediaDisposition` | count |
| --- | --- | --- |
| no | `text_led` | 25 |
| no | **`null`** | 34 |
| **yes** | **`null`** | **14** |
| yes | `illustrated` | **0** |
| — | `media_unavailable` | **0** |

`applyEditorial` in `server/modules/publications/service.ts:188` sets
`illustrated` whenever media is present, so **every one of the 14 illustrated
records predates VA-49** and carries a NULL column that was never backfilled.
The consequence to hold: **`mediaDisposition === "illustrated"` is currently
false for 100 % of records that actually have an image**, so any future code
that branches on it — rather than on `media !== null` — will be wrong on the
entire existing illustrated corpus. Either backfill
(`illustrated` where an asset exists, `text_led` where not) or keep every
consumer deriving from `media`.

### Caveat T-11.b — the API's `media` field understates what the page renders

Two article pages render a hero image while their API record reports
`media: null`:

- `/articles/israel-ministry-of-defense-activities-regional-r-lref0` — renders
  `alt="Editorial still life combining a regional relief map, defense dispatch
  and helicopter tracing for a multi-country daily briefing."`
- `/articles/us-accepts-military-sale-of-helicopters-to-iraq--p5zzh` — renders
  `alt="Editorial still life of a sealed procurement dossier with military
  helicopter silhouettes behind glass."`

Cause: `articleHeroMedia()` (`lib/content/homepage-media.ts:48`) falls back to
`editorialMediaForSurface('publication:<publicId>', 'article')` when the record
has none. That curated fallback is invisible to `/api/v1/published-publications`.
Not a rendering defect — the pages are correct — but it means **14 (API) and 16
(rendered) are both true counts of "illustrated", of different things**, and
any consumer that trusts the API's `media` to decide "does this have a picture"
is wrong for those two records.

---

## T-12 — Metadata — FAIL

### What holds

**VA-62's `og:title == twitter:title` claim is true, on more than 20 routes.**
Measured, not assumed:

- **24 destination/hub routes** use `lib/page-metadata.ts` (`grep -rl
  pageMetadata app --include=*.tsx`). All 24 fetched: `og:title` and
  `twitter:title` byte-identical on every one, all of the form
  `<Name> — LIONS OF ZION`; `og:description` == `twitter:description` and ==
  `<meta name="description">` on all 24; `twitter:card` = `summary_large_image`
  on all 24; `og:url` present and self-referential on all 24.
- **73 article pages:** `og:title` == `twitter:title` on **73/73**, `og:description`
  == `twitter:description` on 73/73, `twitter:card` present on 73/73. **0
  mismatches.**

**No hub page falls back to generic site metadata.** Each of the 24 carries its
own title and its own description — including the previously-bare `/` (now
"Truth Has a Signal"), `/fake-resistance`, and both October 7 indexes, which
the VA-62 note says were the original offenders.

### Defect T-12.a (the failure) — `summary_large_image` with no image on 80 of 97 pages

`og:image` / `twitter:image` are present on **exactly one page in the entire
site: `/`** (`https://lionsofzion.io/opengraph-image.png?opengraph-image.3skgwe5ahudf_.png`,
1731×909, with `og:image:type|width|height` and the matching `twitter:image:*`).

Everywhere else:

- **23 of the 24** hub/destination routes emit **no `og:image` and no
  `twitter:image` tag at all** — `/geopolitical-brief`, `/fake-resistance`,
  `/people-of-israel`, `/october-7`, `/information-war`, `/methodology`,
  `/we-are`, `/search`, `/ask`, `/corrections`, `/updates`, `/support-us`,
  `/fact-check`, `/our-heroes`, `/israels-story`, and all eight sub-routes.
- **57 of the 73** article pages emit no `og:image` — precisely the 57 with no
  media. The 16 with media do emit one (e.g. the aerogel article ships
  `og:image` + `og:image:width` 1586 + `og:image:height` 992 +
  `og:image:alt`).

All 97 of those pages nevertheless declare `twitter:card =
summary_large_image`, which is a card format defined by its image. Pasted into
X or Slack, they degrade to a title-and-text stub.

**This contradicts the helper's own documented contract.**
`lib/page-metadata.ts:44` states: *"Omit to inherit the site card from the root
layout."* Measured live, that inheritance does not happen — a page-level
`openGraph` block without `images` suppresses the root
`app/opengraph-image.png` file convention rather than inheriting it. The
comment describes an intent the served HTML does not implement.

**Worse for articles: the dynamic OG image route exists, works, and is not
referenced.** `app/articles/[publicId]/opengraph-image.tsx` and
`twitter-image.tsx` are deployed and serve:

```
GET /articles/how-five-october-7-testimonies-connect-without-b-5vzxz/opengraph-image
  → 200 image/png 76934
GET /articles/how-five-october-7-testimonies-connect-without-b-5vzxz/twitter-image
  → 200 image/png 76934
```

but that page's HTML contains **no `og:image` tag**, so no crawler will ever
find it. The cause is `generateMetadata` at
`app/articles/[publicId]/page.tsx:61-85`, which sets
`openGraph.images: undefined` / `twitter.images: undefined` when the record has
no media — overriding, not deferring to, the file convention.

Fix, in one of two shapes:
1. Give `pageMetadata()` a default image (the site card) whenever `image` is
   omitted, and have the article route pass the record's media *or* the
   per-article `opengraph-image` route URL; or
2. Stop setting `openGraph`/`twitter` `images` keys at all when there is no
   page-specific image, so Next's file conventions apply — this needs
   verifying against the served HTML, because the current build proves that
   merely leaving the key `undefined` inside an explicit block is not enough.

### Defect T-12.b (minor) — article pages omit `og:url`

All 24 hub routes carry `og:url`. **All 73 article pages carry none**
(`grep -c 'og:url'` → 0), although each has a correct
`<link rel="canonical">`. `app/articles/[publicId]/page.tsx` hand-rolls its
metadata instead of calling `pageMetadata()`, which is the only place `og:url`
is set. Routing the article route through the helper fixes T-12.b and T-12.c
together.

### Defect T-12.c (minor) — two title/prefix inconsistencies

1. **Article `og:title` carries no site suffix.** Hub routes ship
   `Methodology — LIONS OF ZION`; articles ship the bare headline
   (`How five October 7 testimonies connect — without becoming one story`)
   while their `<title>` *does* carry the suffix via the layout template. The
   helper's stated rule — "the suffix matches the layout's title template, so a
   card built from the bare title would read differently from the tab it
   opens" — is exactly the bug, on 73 pages.
2. **The homepage `<title>` has no suffix** (`Truth Has a Signal`) while its
   `og:title` does (`Truth Has a Signal — LIONS OF ZION`) — the mirror of (1).
   Next's `title.template` applies to child segments, not to `app/page.tsx`,
   which sits in the same segment as the layout that defines it. Set the
   homepage title to `title.absolute` if the suffix is wanted.

### Observation (not a defect, worth a decision)

`og:type` is `article` on `/october-7` and `/our-heroes` — both are
destination indexes, not records. Every other hub is `website`. Likely a
copy-paste in the two `pageMetadata({ type: "article" })` call sites.

---

## What could not be measured, and why

- **Rendered appearance, layout, contrast, focus order, motion, viewport
  behaviour.** HTTP/HTML only, by assignment — the browser passes belong to a
  sibling agent.
- **The unique index itself.** T-6 proves the invariant holds over the live
  data. Proving the *constraint* would require an insert; writes to Production
  are out of scope.
- **Draft, archived or unpublished records.** `/api/v1/published-publications`
  is the anonymous surface and returns published rows only; anything the
  editorial pipeline holds unpublished is invisible from here.
- **Whether the two curated-fallback illustrations (T-11.b) are intended for
  those specific records.** That is an editorial judgement, not an HTTP fact.
- **Cache/CDN state.** Every fetch was a single uncoordinated request; no
  attempt was made to distinguish a cold miss from a stale edge hit, so nothing
  here should be read as a statement about revalidation.
