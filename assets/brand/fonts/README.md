# Brand fonts read from the filesystem

These files exist for one reader: `app/articles/[publicId]/opengraph-image.tsx`,
which draws the share card through satori and cannot reach the fonts
`app/layout.tsx` loads with `next/font`. It reads them with `readFile` from
`process.cwd()`, the pattern Next's `opengraph-image` docs use, so the files
must live in the repository rather than be fetched at request time (a fetch to
Google Fonts from the route would need a CSP change, and a card that depends
on a third party at render time is a card that can fail).

| File | Face | Source | Licence |
| --- | --- | --- | --- |
| `SchibstedGrotesk-Regular.ttf` | Schibsted Grotesk 400 | Google Fonts static instance (v7) | SIL OFL 1.1 |
| `SchibstedGrotesk-SemiBold.ttf` | Schibsted Grotesk 600 | Google Fonts static instance (v7) | SIL OFL 1.1 |
| `GeistMono-Regular.ttf` | Geist Mono 400, **`GSUB` stripped** | The Geist Project (vercel/geist-font) | SIL OFL 1.1 |

Static instances, not the variable font: satori applies no `wght` axis, so a
variable file would render every weight at its default instance. Keep the
weights in step with the roles the card uses — 600 for the headline (the
site's heading weight), 400 for everything else, mono for the date.

`GeistMono-Regular.ttf` is a modified copy: its `GSUB` table was removed with
fontTools. satori parses fonts through opentype.js, which throws
`lookupType: 6 - substFormat: 1 is not yet supported` on Geist Mono's chained
contextual substitutions — the whole card 500s rather than losing a ligature.
The file carries no Reserved Font Name (its `name` ID 0 is the plain Geist
copyright), so OFL 1.1 permits the modification. Re-download the upstream file
and the card breaks again; strip `GSUB` and re-run
`tests/article-share-card.test.tsx`, which renders the card and is where this
was caught.

The route reads these with `readFile(join(process.cwd(), …))`, a path Next's
output tracing cannot follow, so a deployment needs an
`outputFileTracingIncludes` entry for `app/articles/[publicId]/opengraph-image`
pointing at `assets/brand/fonts/**`. Without it `loadBrandFonts()` returns an
empty list and the card renders in satori's built-in face — degraded, never
broken.
