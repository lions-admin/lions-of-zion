# Task: three missing homepage images

Three articles on the homepage show no picture, because no image is mapped to
them. Make three images and add them to the repo through a normal PR.

## What to do

1. Generate three illustrations (details below), save them as `.webp` at
   **1600 × 1000**, and put them in `public/images/homepage/`.
2. Add one entry per image to `assets` in
   `content-packages/homepage/media.json`.
3. Add one line per image to `mappings` in the same file, so the picture is
   connected to the article.
4. Open a PR against `main`. Run `npm run verify:changed` before you do.

That is all. No other file changes, no database, no code.

## The three articles and their files

| add this mapping | new file | asset `id` |
| --- | --- | --- |
| `"publication:what-changed-since-september-6-the-september-8-e-2w74s": "what-changed-ledger"` | `what-changed-ledger.webp` | `what-changed-ledger` |
| `"publication:how-weak-claims-look-confirmed-a-reader-s-guide--l09av": "weak-claims-reader-guide"` | `weak-claims-reader-guide.webp` | `weak-claims-reader-guide` |
| `"publication:licensed-but-waiting-arab-physicians-and-israel--3in0j": "residency-bottleneck"` | `residency-bottleneck.webp` | `residency-bottleneck` |

## Style — all three

Tactile editorial collage, photographed top-down or at a shallow angle: paper,
card, board, fabric, brass. Muted palette — bone, ash, ink, oxidised brass —
with a single muted amber accent. Soft even light, shallow depth of field. Match
the illustrations already listed in
`content-packages/homepage/imagegen-manifest.json`.

Hard rules: **no readable text, no faces, no logos, no flags, no screens or UI,
and nothing that could be mistaken for a real document or a real event.**

## 1 — `what-changed-ledger.webp`

Article: *What changed since September 6: the September 8 editorial edition.*

> A top-down editorial still life on a bone-grey desk in even diffuse daylight.
> Two separate stacks of blank cream index cards lie side by side, not touching:
> the left stack crisp and freshly squared, the right stack older and faintly
> yellowed with a translucent glassine sheet laid over its top card, as though a
> better copy has been placed over an earlier one. A single muted amber thread
> runs from the older stack toward the newer one and stops short of it. A small
> brass tab and a paper-clip at the lower right. Matte textures, shallow depth
> of field, no lettering, no screens, no people.

- `alt`: "An editorial illustration: two separate stacks of blank cards on a desk, one freshly squared and one older with a translucent sheet laid over it, joined by a single amber thread."
- `caption`: "Editorial illustration. New events and better sources for existing stories are recorded separately in this edition."
- `focalPoint`: `{ "x": 50, "y": 45 }`

## 2 — `weak-claims-reader-guide.webp`

Article: *How weak claims look confirmed: a reader's guide to repetition,
authority and association.*

> A shallow-angle editorial collage on dark ash board, evenly and softly lit.
> One small blank paper fragment sits sharp in the foreground; behind it the
> same fragment recurs six or seven times, each copy fainter and more offset,
> receding into the depth of field — one thing repeating until it reads as many.
> To the left, a heavy unmarked brass seal rests on a plain card and throws a
> shadow far larger than itself. To the right, two muted amber threads run close
> and parallel across the board but never touch or cross. Torn matte paper
> edges. No letters, no numbers, no interface, no people.

- `alt`: "An editorial illustration: one blank paper fragment repeating into fainter copies, a heavy unmarked seal casting an oversized shadow, and two parallel threads that never meet."
- `caption`: "Editorial illustration of three reasoning traps: repetition, borrowed authority, and association mistaken for proof."
- `focalPoint`: `{ "x": 42, "y": 50 }`

## 3 — `residency-bottleneck.webp`

Article: *Licensed but waiting: Arab physicians and Israel's residency
bottleneck.* Depict **no person at all** — the article concerns Arab citizens of
Israel, and any figure in frame would read as a claim about who these doctors
are.

> A quiet editorial still life in a pale institutional corridor, photographed
> straight on in soft even light. A single empty wooden chair against the wall.
> Folded neatly on the seat: a clean white medical coat and a stethoscope,
> unworn, with a plain unmarked certificate folder resting on top. Beyond the
> chair the corridor narrows and a row of identical closed pale doors recedes
> into shallow focus. A small blank brass number plate on the wall above the
> chair. No people, no faces, no hands, no text or numbers anywhere, no signage,
> no national or religious symbols. Bone, ash and pale green-grey, one warm
> brass accent.

- `alt`: "An editorial illustration: a folded white medical coat, a stethoscope and a closed certificate folder on an empty chair in a narrowing hospital corridor of closed doors."
- `caption`: "Editorial illustration. Qualified physicians waiting on residency placement; the size of the backlog has not been published."
- `focalPoint`: `{ "x": 50, "y": 55 }`

## The shape of an asset entry

Copy this exactly, changing only `id`, `src`, `alt`, `caption` and `focalPoint`.
`width`/`height` must be the real pixel size of the file.

```json
{
  "id": "what-changed-ledger",
  "src": "/images/homepage/what-changed-ledger.webp",
  "width": 1600,
  "height": 1000,
  "alt": "…",
  "credit": "Lions of Zion · generated editorial illustration",
  "caption": "…",
  "role": "editorial-illustration",
  "focalPoint": { "x": 50, "y": 45 },
  "sensitivity": "safe",
  "rights": {
    "status": "cleared",
    "basis": "Commissioned original generated artwork",
    "reference": "content-packages/homepage/imagegen-manifest.json",
    "clearedAt": "2026-09-08",
    "surfaces": ["homepage", "article"]
  }
}
```

`sensitivity` must be `"safe"` and `surfaces` must include `"homepage"` —
anything else and the homepage card stays blank exactly as it is now.

Optionally, add a line for each new image to the `assets` list in
`content-packages/homepage/imagegen-manifest.json`, the way the existing ones
are recorded.
