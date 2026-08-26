# October 7 archive integration

The implementation brief for bringing two crawled testimony archives onto
`/october-7`. Written for a session with none of the originating conversation
in context.

**Status: built and serving.** Phase 1 (packaging), A3 (the no-JavaScript
defect) and A4 (the build) are complete: 1,177 archive pages prerender under
`/october-7`, `ci-smoke` passes 18/18, and 358 tests pass. Media is now in the
dedicated Vercel Blob store `lions-of-zion-archive`; Phase 4 is the eventual
move of archive records onto the application database.

## What this is

Two archives of October 7 documentation were crawled and processed into
integration packages. They become roughly 1,180 static pages under
`/october-7`, which stops being a single dossier page and becomes a hub.

This reverses a previous decision. `/october-7` used to link out to external
archives rather than host testimony, on consent grounds. The site owner
reversed that on 2026-08-26; the reasoning, and what must not be quietly
re-tightened, is the top entry in [`../.ai/DECISIONS.md`](../.ai/DECISIONS.md).
**Read that entry before changing anything here.** The superseded entry is kept
below it, marked as reversed — do not "restore" it.

## The two packages

Both live **outside this repository** and are not in git.

| | october7 | hamas-massacre |
| --- | --- | --- |
| Path | `~/Documents/opencode/october7-integration-package` | `~/Documents/october-7_toad/hamas-massacre-integration-package` |
| Source site | october7.org | hamas-massacre.net |
| Canonical records | 179 | 335 |
| Language versions | 505 (7 languages) | 670 (en, es) |
| Unique media | 499 | 528 |
| Story↔media relations | 1121 | 1088 |
| Validation | 29/29 PASS | 32/32 PASS |

Both are built to the same contract, `october7-integration-package@1`. This was
verified field by field, not assumed:

- **The story↔media relation is key-for-key identical.** That is the join a
  renderer walks, so it needs no branching.
- **hamas block types are a strict subset** of october7's. october7 has
  `heading`, `paragraph`, `quote`, `image`, `video`, `caption`, `link`; hamas
  uses `heading`, `paragraph`, `image`, `video`. A renderer written for
  october7 handles both.
- Fields absent from the hamas package are absent from its **source** —
  `witness_name` (these are documentation records, not named testimony),
  `attribution`, `content_warning`. All optional.

### Package shape

```
data/                    JSON — the source of truth
  languages.json  categories.json  story-groups.json
  stories.json (+ .ndjson)  media.json (+ .ndjson)
  story-media.json  translation-links.json
content/stories/{canonical_story_id}/
  story.json             everything: all languages, blocks, media relations
  {locale}/story.md + content.json
assets/originals/{images,videos,thumbnails}/<sha[:2]>/<sha>.<ext>
assets/web/{images,thumbnails}/<sha[:2]>/<sha>-w{480,960,1600}.webp
database/content.sqlite + schema.sql
schemas/*.json           JSON Schema draft-07
checksums/sha256sums.txt
```

`content/stories/*/story.json` is the entry point: one file carries every
language version, its ordered `content_blocks`, and all media relations.

### Rules the packages enforce, which the site must not break

1. **Identifiers are contracts.** `canonical_story_id`, `story_id` and
   `media_id` are derived deterministically and never regenerated. This is what
   makes a re-crawl an upsert instead of a duplicate import.
2. **Never reach for an asset by filename.** Always `media_id` →
   `data/media.json` → `package_path` / `srcset`.
3. **`content_blocks` is display order.** Preserve it.
4. **Null means null.** `cover_media_id`, `alt_text`, `content_warning` — do
   not invent values.
5. **Credits always render.** `credit` and `caption` are part of the record.

## Phase 1 — packaging (complete)

The october7 package already existed. The hamas archive was raw and was built
into a matching package by a three-stage pipeline at
`~/Documents/october-7_toad/pkgbuild/`:

```bash
python3 build_media.py                  # probe media, build WebP variants  ~20s
python3 build_package.py                # assemble JSON, content, sqlite     ~3s
.venv/bin/python validate_package.py    # 32 checks                         ~40s
```

The source archive is read-only to this pipeline. `pkgbuild/README.md` carries
the build decisions in full; four are worth knowing here because they explain
values you will see in the data:

- **57 identifiers needed normalising.** Source slugs were the record title
  verbatim — up to 309 characters, 48 percent-encoded. Both broke the id
  pattern and the 255-byte filesystem limit. They are decoded, slugified and
  capped at 80 characters; a slug that was truncated or that collided takes
  `-<record_id[:8]>`, so the result never depends on read order.
- **Media ids are content-addressed.** The archive numbered media per record,
  so the same file had different ids in different records. 1088 relations
  collapse onto 528 files.
- **A video record's cover is its poster.** Every record carries either a cover
  image (252 versions) or a video (418). The video ones are not cover-less —
  their poster is a real frame. `cover_status` is `ok` or
  `from-video-thumbnail`. **No record needs a placeholder.**
- **Three schema enums are widened** in that package's own copy of the schemas
  (`category_id`, `cover_status`, relation `role`), each for a state this
  archive genuinely has and october7 does not. The october7 package is
  untouched.

All 209 videos are H.264 + AAC with `moov` ahead of `mdat`, so no transcoding
is needed.

## Phase 2 — placement (not started)

Decisions already made; these are constraints on the implementation, not open
questions.

- **The radial nav stays at eight nodes.** `components/particle-nav/config.ts`
  `defaultNodes` is not touched. Everything lands under `/october-7` as child
  routes. Adding a ninth node is a different decision nobody has taken.
- **Not through the database.** The backend is unprovisioned and its auth
  refuses in production by design. Package JSON goes into the repo under
  `content-packages/`; new modules in `lib/content/` read it at build time.
  That is exactly what the `lib/content/` seam exists for — when a real query
  arrives, it replaces those function bodies, not their call sites.
- **Media never enters the repo.** Only `assets/web` (images/thumbnails) plus
  the video originals go to object storage.
- **Everything is SSG** via `generateStaticParams`. No new runtime.

### Storage

Measured, not estimated:

| | Served | Repo (JSON) |
| --- | --- | --- |
| october7 | 53 MB images + 345 MB video | 39 MB |
| hamas | 14 MB images + 1.4 GB video | 12 MB |
| **Total** | **~1.8 GB** | **~51 MB** |

`assets/web/videos` in the october7 package is **empty** — web variants for
video were never generated. This is not a defect: the originals are already
faststart and browser-ready, so they are the serve set.

**The deployed store is Vercel Blob.** The archive is isolated in
`lions-of-zion-archive` (2,018 objects, about 1.94 GB, `iad1`) and is served
directly through its public CDN URL. Cloudflare R2 remains a possible future
cost optimisation, but changing stores is a deliberate migration, not a
runtime fallback. **Media must be served from CDN URLs directly** — proxying it
through the Next app moves the bill onto Vercel's own bandwidth.

### Uploading

The layout is the package's own, minus the `assets/` prefix, under a folder
named for the package:

```
<bucket>/october7/originals/…        <bucket>/october7/web/…
<bucket>/hamas-massacre/originals/…  <bucket>/hamas-massacre/web/…
```

The repository's uploader uses the archive store's own OIDC connection and is
concurrent and resumable. For a new upload, run it once per package, then set
`NEXT_PUBLIC_ARCHIVE_CDN` to the store's public base and prove it:

```bash
node scripts/upload-archive-assets.mjs <package-dir> october7
node scripts/upload-archive-assets.mjs <package-dir> hamas-massacre
```

```bash
node scripts/verify-archive-assets.mjs https://your-cdn/base --all
```

Do not reuse `BLOB_READ_WRITE_TOKEN` for this upload: it belongs to the RSS
stores. The archive-prefixed variables identify the dedicated store.

Three video files (115 MB, 57 MB, 51 MB) dominate the tail; the source
package's `reports/media-optimization.md` already lists compression candidates.

## Phase 3 — build (complete)

Built as specified below, with three things worth carrying forward:

- **Two videos have no local file.** The source hosts them on YouTube and the
  packages record them without downloading them, so `package_path` is null and
  `validation_status` is `external-reference`. The first build crashed on this.
  They render a note saying the archive does not hold them — better than
  dropping the block and implying nothing was published there.
- **The importer takes a third of what the package holds.** Only each record's
  `story.json` plus the index, media and translation registries; everything
  else in a package is a re-aggregation of those. 39 MB → 9.9 MB for october7.
- **The locale split is what protects the canonical.** The bare route serves a
  record's default language and `[locale]` serves the rest, so no version ever
  has two URLs. `generateStaticParams` for the locale route deliberately
  excludes the default.



### Route map

| Route | Pages | Source |
| --- | --- | --- |
| `/october-7` | 1 | existing dossier — gains entries to the archives |
| `/october-7/testimonies` | 1 | `story-groups.json` |
| `/october-7/testimonies/[slug]` | 179 | `content/stories/*/story.json` |
| `/october-7/testimonies/[slug]/[locale]` | 326 | same |
| `/october-7/documentation` | 1 | hamas package |
| `/october-7/documentation/[category]/[slug]` | 335 | hamas package |
| `/october-7/documentation/[category]/[slug]/es` | 335 | same |

Two route-map details that will bite if unhandled:

- **Locales mirror the testimonies scheme.** The bare record route serves the
  default language (en); Spanish gets its own segment, exactly as
  `[slug]/[locale]` does for testimonies. A single `[category]/[slug]` pattern
  cannot serve 670 pages.
- **One record has `category_id: null`** — the source site published it
  uncategorised (`an-israeli-rescue-officer-…-afbc98f7`), and per package rule
  4 no category was invented. `[category]/[slug]` cannot address it. Route it
  under a literal `uncategorized` segment (presentation-layer choice, not a
  data change), and make the index render it under an "Uncategorised" group so
  it is reachable.

### Work items

1. **`scripts/import-archive-package.mjs`** — validate the package, copy
   `data/` and `content/` into `content-packages/<name>/`, upload media to the
   CDN, write `media-map.json` mapping `media_id` → public URL. Idempotent;
   upserts by id.
2. **`lib/content/testimonies.ts` and `lib/content/documentation.ts`** — the
   seam. Async accessors over the imported JSON, with the signature a real
   query will land on later.
3. **`components/archive/`** — the block renderer. One component per block
   type, driven by `content_blocks` order. Images use `srcset` with
   `sizes="(max-width:720px) 100vw, 720px"`; videos use `<video controls
   preload="metadata" poster>` from `thumbnail_media_id`. Credits belong in the
   evidence margin — reuse the existing `marginNote` grid pattern from
   `components/content/content.module.css` rather than absolute positioning.
4. **Index and record pages.** Use `components/sections/DocPage.tsx` as the
   shell — it exists precisely for routes outside the eight-file orbit
   (`/methodology`, `/corrections` use it) and takes `routeId`, `title`,
   `tagline`. Note it deliberately takes no rails; whether archive records want
   the citation rail is a live decision, and if so it needs a prop rather than
   a fork.
5. **hreflang and metadata.** `translation-links.json` carries every pair
   symmetrically at `confidence: high` — do not infer relationships. Keep
   `source_url` per version for 301s from the source sites.
6. **Tests.** Unit-test the renderer against the three fixtures in the october7
   package's `exports/sample-stories/` (image-only, video, multilingual).
   Extend `scripts/ci-smoke.mjs` to the new routes.

### Traps specific to this repo

- ~~`app/loading.tsx` breaks no-JavaScript rendering on every route.~~
  **Fixed — the file is removed.** It wrapped every route in a Suspense
  boundary whose fallback is never replaced without JavaScript, parking real
  markup inside `<div hidden id="S:0">`. See `.ai/DECISIONS.md` for the
  measurements. **Do not reintroduce a root-level `loading.tsx`;** if a route
  needs a loading state, scope it to that segment and verify a sibling content
  route's no-JavaScript render before keeping it.
- **`verify:graphics` must come out unchanged.** None of this touches
  `components/particle-nav/`. If its numbers move, something went wrong.
- **Reading surfaces use `displayName`, not `label`.** `label` is stored
  uppercase as identity; CSS `capitalize` cannot fix it ("ISRAEL'S STORY" →
  "Israel'S Story").
- **Type and colour come from the V2 tokens** in `app/globals.css`. Read
  `.ai/DESIGN-V2.md` first. Nothing below `--t-data` (0.72rem); uppercase plus
  tracking only for data labels of two words or fewer. **Cinzel belongs to the
  particle scene only** — putting it on a reading page reverses a documented
  decision.
- **`lib/content/` modules are all async except `home.ts`,** whose synchronous
  exports are load-bearing: an `await` in the home render path puts it behind
  the Suspense boundary above. New archive modules are not in that path, so
  async is correct for them.
- **`lib/content/` is held to the same import boundary as `app/` and
  `components/`** — it may import `@/server/contracts/*` and nothing else under
  `server/`. `eslint.config.mjs` enforces this.

## Phase 4 — backend (deliberately later)

When the archive records are moved onto the provisioned Neon database: the packages'
`database/schema.sql` is close to PostgreSQL-ready. Stories become items, media
becomes evidence, written through `server/core/versioning.ts` `recordVersion()`
— the only sanctioned write path for a versioned entity.

Ongoing updates: crawl → pkgbuild → validate → import. Ids are contracts, so
imports upsert and nothing is overwritten.

## Presentation — settled

Recorded in full in [`../.ai/DECISIONS.md`](../.ai/DECISIONS.md) under "The
archive presents clean but keeps its provenance". Summary, because these are
constraints on the build:

- **No outbound links in a record body.** Credits render as **plain text, not
  hyperlinks**, at `--t-data`. `source_url` lives in metadata and JSON-LD, not
  in the prose. Per-record link lists are replaced by the existing
  `/methodology` page.
- **Provenance is kept.** Rewording records to escape attribution was
  considered and rejected — it produces a derivative work anyway, it alters
  what a witness said, and an unsourced archive cannot answer denial, which is
  this section's stated purpose. Only 3 of 528 and 3 of 499 media items carry a
  named credit, so there was no clutter to remove regardless.
- **Canonical points here, not at the source** — but expect little organic
  search traffic from the record pages either way, because the source
  published the same text first. Plan traffic around the editorial layer, the
  cross-archive search nobody else has, and Hebrew (absent from both packages;
  the site is `lang="en"`). Translating the archives is a derivative work and a
  conversation with the source projects; the editorial layer is not.
- **Documentation records take no rails.** Every hamas version is 3 blocks with
  1 heading; 179 october7 versions have no headings at all. `DocPage` is
  correct as-is. A right-margin-only variant for the long testimonies is a
  later prop on the same shell, never a fork, and must fix `--content-w`, which
  assumes both rails or neither.

### Still open

- `/october-7`'s "Testimony and remembrance" copy states the site hosts no
  testimony. **That is now false and must be rewritten.** Edut 710 and the USC
  Shoah Foundation stay (they hold video testimony neither package has); the
  October7.org entry becomes an attribution line for the archive being read,
  not an invitation to leave.
