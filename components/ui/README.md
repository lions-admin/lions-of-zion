# `components/ui` — the chrome primitives

Controls and containers. Nine modules, all CSS Modules on the V3 tokens in
`app/globals.css`, all keyboard-accessible, and all with a complete state
matrix rather than a hover colour.

Written 2026-09-02, when an audit found the directory being routed around
rather than used: `Button` had five variants and nine call sites against **50
raw `<button>` elements in 16 files and ten hand-rolled button classes**;
`Card` had **zero** call sites and 179 lines of dead CSS; and there were no
skeletons, no dialog, no ARIA tabs, no tooltip and no pagination anywhere on
the site.

Nothing here has been migrated onto — that is deliberate. This wave owns
`components/ui/**` and `components/magicui/**` only. **This file is the
contract the other waves migrate against.**

```tsx
import { Button, Card, Skeleton, Pagination } from '@/components/ui';
```

---

## The boundary: `components/ui` vs `components/content`

The two directories duplicated concepts with no stated boundary — `Badge`
against `VerificationBadge`/`TechniqueChip`/`ConfidenceChip`, `Card` against
`ContentCard`. Here is the line.

> **`components/ui` is chrome. `components/content` is the publication's
> voice.**
>
> The test is one question: **does the component decide meaning from the
> content, or does it only decide how a box looks?**

| | `components/ui` | `components/content` |
| --- | --- | --- |
| Knows about | surfaces, hairlines, focus, lift, state, keyboard behaviour | assessments, confidence, evidence class, techniques, records, citations |
| Props are | presentational — `variant`, `size`, `tone`, `accent` | domain types from `@/server/contracts/*` and `lib/content/*` |
| Imports from `server/contracts` | **never** | yes, that is the point |
| Renders | `<button>`, `<div>`, `<dialog>`, `<nav>` | `<article>`, `<figure>`, `<blockquote>`, `<cite>` |
| Owns | the site's one focus ring, one lift, one hairline | the three canonical treatments (`kicker`, `dateStamp`, `entryTitle`) and the evidence margin |
| Answerable to | this file | `components/content/README.md` |

### The two overlaps, resolved

**`Badge` (ui) vs `VerificationBadge` (content).** They stay separate, and they
should not compose. `VerificationBadge` maps nine `AssessmentValue`s to nine
presentations and is *deliberately not a pill* — a sentence-case phrase with a
status dot, because a verdict on testimony must not look like a UI chip. `Badge`
is a tracked-capitals pill for chrome status: a stage, a count, a route state,
a filter that is on.

The domain leak was in `Badge`'s own variant names, and it is fixed: the tones
are now `neutral | gold | ember | ok | warn | danger`, named for the token ramps
they read (`--state-ok`, `--state-warn`, `--state-danger`) and never for what a
value means. `verified` and `warning` still work as aliases so the one call
site (`app/articles/[publicId]/page.tsx`) can be migrated by the wave that owns
it — **please migrate them; they are aliases, not variants.**

`TechniqueChip` and `ConfidenceChip` stay in content unchanged. Both read a
controlled vocabulary and one of them is a link into the playbook. Neither is a
`Badge` wearing a different hat.

**`Card` (ui) vs `ContentCard` (content).** They stay separate and describe
different things.

* `ContentCard` is a **record**: an `<article>` with an eyebrow, a title, a
  body and a footer, carrying a `gold`/`ember` accent. It is what ships, it is
  correct, and Wave E should keep it.
* `Card` is the **container**: a surface with a hairline and a state matrix
  that knows nothing about what it holds. A branch card, a dialog panel, a
  media tile, a list row, the box a skeleton stands in for.

If you are rendering a record, reach for `ContentCard`. If you are rendering a
box, reach for `Card`.

### Where the type treatments live

`CardTitle`, `CardEyebrow` and `CardDescription` are token-identical to
`content.module.css`'s `entryTitle` and `kicker`. That is one visual answer in
two implementations, which is a cost paid to keep the directories independent.
**If they ever diverge, `components/content` is the source of truth for
editorial type and `components/ui` follows.**

---

## Tier rules

Read `components/motion/README.md` for the full statement. What binds this
directory:

* **Five of the nine modules are server components with zero client
  JavaScript** — `Button`, `Card`, `Badge`, `Skeleton`, `Pagination`. They are
  safe on every tier, including `/` and everything `CinematicIntroGate` wraps.
* **Four are client components** — `Dialog`, `Tabs`, `Tooltip`, and
  `StatusState` only when it takes an `onAction`. **None of them may reach the
  home route.**
* **Nothing here uses `motion`.** `motion` server-renders its `initial`
  variant as an inline `opacity: 0` that JavaScript-off never clears, and
  `components/ui` is used everywhere. Every animation in this directory is
  CSS, and every one degrades to the content under
  `prefers-reduced-motion: reduce`.
* **CSS Modules only.** They are emitted unlayered and therefore beat every
  Tailwind utility at any specificity. Tailwind is for `components/magicui/**`
  subtrees; the two never meet on one element. `lib/utils` `cn()` cannot
  reconcile them and must not be asked to.

---

## Button

`Button` (a `<button>`) and `ButtonLink` (a `next/link` or a bare `<a>` for
absolute and `mailto:` hrefs). Both `forwardRef`. Seven variants × four sizes ×
an icon-only shape.

### Variant → use case

| Variant | What it is | Use it for | Replaces |
| --- | --- | --- | --- |
| `primary` | Gold fill, `--shadow-1`, 1px lift on hover | **The one gold control on a screen.** A donate CTA, a form's submit, the single next step | — |
| `solid` | `--surface-3` fill, `--line-strong` hairline, gold arriving on hover only | The emphasised control **on a reading page**, where glass has nothing behind it to blur | `content.module.css` `.sensitiveButton`, `visualizer` `.playbackBtnPlay` |
| `secondary` | Glass: the raised gradient, `backdrop-filter: blur(12px)` | Controls **floating over the particle scene** — the site header, the skip control. Shared with the floating navigation | `site-header.module.css` `.mobileTrigger` |
| `toolbar` | Nothing at rest; a tint and a hairline on hover; `--radius-1` | **A dense control row.** Eight of them side by side read as one strip. Zoom, transport, view switches, pagination steps | `visualizer` `.canvasToolBtn`, `.playbackBtn`, `.speedBtn`, `.explainerToggleBtn`, `.cardGlossaryBtn`, `.modalCloseBtn` |
| `filter` | Data face, tracked capitals, `--surface-2`; gold wash when `isActive` | A filter value or a tag. A filter value is a data label, not a sentence | `content.module.css` `.gradeChip`, `.identityChip` |
| `ghost` | Transparent, no border in any state | **Text that acts**, inside prose. Never in chrome — chrome uses `toolbar` | `visualizer` `.nodeLinkBtn` |
| `danger` | The `--state-danger` ramp, desaturated onto the warm palette | Destructive confirmation, and only after the fact is stated | — |

`secondary` and `solid` are the pair people get wrong. **Glass belongs where
there is something to blur.** On an opaque document a backdrop filter costs a
compositor layer and buys a slightly muddier control.

### Sizes

| Size | Height | For |
| --- | --- | --- |
| `xs` | 28px | A dense toolbar: speed toggles, zoom, page numbers |
| `sm` | 36px | Compact desktop chrome, secondary actions, dialog controls |
| `md` | 44px | **Default.** The touch standard |
| `lg` | 52px | A page's single primary action |

Every height is derived from `--control-h` rather than written as a literal.

**`xs` and `sm` both grow to 44px under `(pointer: coarse)`.** That is
deliberate and it has a consequence: a dense toolbar does not get to ship 28px
targets on a phone — it has to wrap or scroll. Design the row for that.

The size prop now governs the `filter` chip too. It did not before: the chip
hard-set its own height and padding, so `size="lg"` silently rendered at 36px.

### `iconOnly`

A square control carrying an icon and nothing else.

```tsx
<Button variant="toolbar" size="sm" iconOnly aria-label="Next step" onClick={next}>
  <ChevronRight />
</Button>
```

**`aria-label` is required by the type signature when `iconOnly` is true.** A
nameless icon button does not compile. This is the one place the primitive
refuses to let a call site be wrong.

### States

`default` · `hover` · `:focus-visible` · `active` · `disabled` · `loading` ·
`isActive` · reduced motion. All seven variants carry all of them.

* **Focus** is the site-wide gold ring from `globals.css`, offset tightened by
  one step so it hugs a control. A module may change the *offset*; never the
  colour, and never animate its appearance.
* **`isLoading`** disables the control, sets `aria-busy`, and swaps the left
  icon for a spinner. Under reduced motion the spinner slows to 1.5s rather
  than freezing — the one `!important` in this directory, and it is *inside* a
  `prefers-reduced-motion` block, so it implements the kill-switch rather than
  defeating it.
* **`isActive` now carries semantics, not just a colour.** Passing it at all
  declares the control a toggle, so `aria-pressed` is emitted with its real
  value — `false` included. A caller that has already said what the control is
  (`aria-pressed` by hand, `aria-current`, `aria-selected`, `role`) keeps its
  own answer. On `ButtonLink`, `isActive` means "this is where you are", so it
  emits `aria-current="page"` instead.

### What is *not* a Button

**A tab is not a button with an active state.** `.journeyTab`,
`.glossaryCatTab` and `.viewModeBtn` in `visualizer.module.css` are tab rows
missing `role="tab"`, `aria-selected`, `aria-controls`, a roving tabindex and
arrow-key navigation. Migrate them to `Tabs`, not to `Button variant="toolbar"
isActive`.

---

## Card

The chrome surface primitive. Three variants, an accent, and one interactive
treatment.

```tsx
<Card variant="dossier" accent="ember" href="/fake-resistance/social-media">
  <CardHeader>
    <CardEyebrow>Branch 02</CardEyebrow>
    <CardCount>7 files</CardCount>
  </CardHeader>
  <CardTitle>The social-media machine</CardTitle>
  <CardDescription>Nine techniques, seven case files, one network graph.</CardDescription>
  <CardCta>Open the branch</CardCta>
</Card>
```

### Why it was kept rather than deleted

The brief allowed either. Keeping it, for three reasons:

1. **The interactive card genuinely exists**, once, hand-rolled — the
   `/fake-resistance` branch cards, whose treatment `components/motion/README.md`
   already describes as "the one genuinely interactive card on the site". A
   primitive with no home is dead weight; a hand-rolled one with no primitive
   guarantees a second and third copy.
2. **Deleting it leaves the other waves nothing to migrate onto**, and the
   `Skeleton` and `Dialog` work here both need a card-shaped surface anyway.
3. The overlap with `ContentCard` was never a duplicate primitive — it was a
   missing boundary. With the boundary written down, both earn their place.

What *was* deleted: the entire previous stylesheet. Its four variants described
no shipping surface — a gold **left** rule for "dossier" when the shipping
dossier mark is an ember **top** rule, and a backdrop-blurred glass card that
duplicated the secondary button and appeared nowhere.

### Anatomy

| Variant | Anatomy | Use for |
| --- | --- | --- |
| `panel` | `--surface-1`, hairline, `--radius-3`, inset highlight | The generic container: a dialog body, a media tile, a control panel, a stat block |
| `dossier` | 2px accent rule across the top edge, `--radius-2`, `--shadow-1`, roomier padding | A **branch or section card**: the decision moment on a hub page |
| `quiet` | No surface, one hairline underneath | A **list row**: an index, a roster, a stack that must read as one column |

| Accent | Rule + eyebrow |
| --- | --- |
| `none` (default) | Hairline rule, `--ink` eyebrow |
| `gold` | `--gold` rule, `--gold-hi` eyebrow |
| `ember` | `--data-ember` rule, `--data-ember-peak` eyebrow |

Sections own their accent; the primitive does not bake one in. The rule, its
hover peak and the eyebrow move together through one custom property, so they
cannot disagree.

### The interactive treatment

Armed by `href`, or by `interactive` for a card whose whole surface is already
a control. It is the branch card's treatment kept whole: a 2px lift, the
hairline to `--line-strong`, the accent rule to its peak, the surface up a
level, `--shadow-1` → `--shadow-2`, the title to `--gold-hi`, and `CardCta`'s
arrow travelling 0.3em.

**Hover and `:focus-visible` carry exactly the same treatment.** A keyboard
reader gets the affordance, not a consolation ring. Reduced motion drops every
transform to its rest state so nothing sits nudged.

`interactive` styles a surface; it does not create a control. A `<div>` with a
click handler is not a button — pass `href`, or put a real control inside.

### Parts

`CardHeader` · `CardEyebrow` · `CardCount` (tabular, for a count or a date) ·
`CardTitle` (`h3` by default, `as` to change it) · `CardDescription`
(`clamp` is opt-in — a card in a fixed-height grid needs it, a card in a
column must not silently truncate a record) · `CardMedia` · `CardCta` ·
`CardFooter`.

`CardCta` is `aria-hidden`: the card's own accessible name already says where
it goes, and a second announcement makes every card in a grid read identically.

**Equal heights in a grid:** the card is `height: 100%`, so it fills its grid
row. If you wrap it in anything (a `Reveal`, say), give the wrapper
`display: grid` — a `display: block` wrapper has auto height and the card
resolves against that instead. `.branchSlot` in
`app/fake-resistance/page.module.css` is the worked example.

---

## Skeleton

There were none anywhere on the site. The reason to add them is not
decoration: **a skeleton whose box differs from the content's box turns a wait
into a jump**, which is the defect it exists to prevent.

```tsx
<SkeletonRegion label="Loading the testimony index">
  {Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)}
</SkeletonRegion>
```

| Component | Holds |
| --- | --- |
| `Skeleton` | One shape: `text` · `title` · `label` · `block` · `circle`. The type shapes size themselves from the type scale, so a text line is exactly a body line box |
| `SkeletonText` | `lines` lines of running text, last one short — the single cue that reads as prose rather than as a stack of bars |
| `SkeletonCard` | The box of `Card variant="dossier"`, padding for padding |
| `SkeletonRow` | The box of an archive index row: cover thumbnail, title, excerpt |
| `SkeletonRegion` | Marks a group as one pending region |

**Announcing the wait.** Every shape is `aria-hidden` — a bar is not content.
Pass `label` on a composed shape, or wrap your own group in `SkeletonRegion`,
and the region becomes a `role="status"` with a visually-hidden label, so a
screen reader hears "Loading records" once instead of nothing at all.

The sweep is a pseudo-element rather than the base background. The global
reduced-motion kill-switch collapses an animation's *duration*, which would
leave a moving gradient frozen at an arbitrary offset and reading as a broken
paint; keeping it in `::after` means removing it under reduced motion leaves a
clean static tint, with no `!important` anywhere. Like every other ambient
motion in this system it is mostly at rest: the sweep passes once per
`--dur-ambient` and waits.

`SkeletonRegion` renders a `<div>`, so `SkeletonText` cannot go inside a `<p>`.

**Do not put one behind a root `loading.tsx`.** Scope any loading state to its
own segment, and check a sibling content route's no-JavaScript render before
you ship it (`.ai/DECISIONS.md`, 2026-08-26).

---

## Dialog

Built on the native `<dialog>` element with `showModal()`, which is the whole
point: the platform traps focus, marks the rest of the document inert, closes
on Escape, restores focus to whatever opened it, and renders in the **top
layer** — so no `--z-*` value is involved and no `z-index` race is possible. A
hand-rolled focus trap is the single most commonly broken piece of a design
system; this one declines to write it.

```tsx
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Glossary"
  description="Terms used in the pipeline view."
  size="wide"
  footer={<Button variant="solid" onClick={() => setOpen(false)}>Done</Button>}
>
  …
</Dialog>
```

What the component adds on top of the platform:

* **React state is the single source of truth.** Escape is intercepted and
  routed back through `onClose`; without that the element closes itself, `open`
  stays `true`, and the dialog can never be reopened. The native `close` event
  is a resync, not a close path.
* **The panel takes initial focus, not the close control** — the first thing
  announced is the dialog's name, not the way out of it.
* **A backdrop click closes**, unless `dismissOnBackdrop={false}` — turn it off
  for a dialog holding unsaved input.
* **The document behind is locked and its scrollbar gutter reserved.**
  `showModal()` marks the page inert but does not lock its scroller, and taking
  an 8px scrollbar away without reserving its space shifts the whole page
  sideways at the exact moment attention moves to the panel.
* The entrance uses `@starting-style` with `transition-behavior: allow-discrete`
  — no JavaScript animation state at all.

`title` is required: an unnamed modal is announced as "dialog" and nothing else.

With JavaScript off it renders a closed `<dialog>` — invisible and inert.
**Anything a reader must be able to read has to exist on the page as well,
never only in a dialog.**

---

## Tabs

The ARIA pattern implemented rather than approximated.

```tsx
<Tabs defaultValue="ingest" activation="automatic">
  <TabList shape="underline" label="Journeys">
    <Tab value="ingest">Ingest</Tab>
    <Tab value="assess">Assess</Tab>
  </TabList>
  <TabPanel value="ingest">…</TabPanel>
  <TabPanel value="assess">…</TabPanel>
</Tabs>
```

Everything the pattern requires and the hand-rolled tab rows on this site do
not have: `role="tablist"` with a name, `role="tab"` with `aria-selected` and
`aria-controls`, `role="tabpanel"` labelled by its tab, a **roving tabindex** so
the row is one stop in the tab order rather than eight, arrow keys with
Home/End and wrapping at both ends, and **arrow directions mirrored under
`dir="rtl"`** — which matters here because the operations surfaces are Hebrew.

* `shape="underline"` (default) — a row of labels over a hairline, the selected
  one marked in gold. Above content a reader chooses between. The marker is an
  inset box-shadow, not a border, so the row cannot shift by a pixel when the
  selection moves.
* `shape="segmented"` — a bordered group holding a raised chip. A view-mode
  switch, a filter bar; chrome that should read as a control.
* `activation="automatic"` (default) selects as focus moves — right when the
  panels are already rendered. Use `"manual"` when selecting costs something,
  so arrowing through the row does not fire five fetches.

Selection is never communicated by colour alone: both shapes also change weight
and either the rule or the surface.

Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
`defaultValue` is also the panel that renders with JavaScript off — the others
stay `hidden`, so **never put anything a reader must be able to read behind a
tab alone.**

---

## Tooltip

A footnote on a control. WCAG 1.4.13 has three requirements most tooltips fail,
and all three are implemented:

* **Dismissible** — Escape closes it without moving focus, so a keyboard reader
  does not lose their place to read a footnote.
* **Hoverable** — the pointer can travel onto the tip, across an invisible
  bridge so the gap does not dismiss it mid-journey.
* **Persistent** — it stays until the pointer leaves, focus leaves, or Escape.
  Nothing times it out.

```tsx
<Tooltip label="Resets the simulation to step one">
  <Button variant="toolbar" size="sm" iconOnly aria-label="Reset">↺</Button>
</Tooltip>
```

The child must be a single element that can hold a ref and `aria-describedby`.
Focus opens with no delay (a keyboard reader has already committed); hover
waits `openDelay` (200ms); a touch "hover" opens nothing, because it is a tap
on its way to being a click and the tip would cover what was tapped.

**A tooltip is `aria-describedby`, which is supplementary by definition.** It is
never the only place a name lives — an icon-only `Button` still requires its
`aria-label`. And on a touch device it is invisible to most of the people
reading this site: **if the copy matters, put it on the page.**

Positioned against its own trigger — no portal, no floating-ui, no measurement
pass. The consequence, stated rather than papered over: **a trigger inside a
clipping container can clip its tip.** Use `placement="bottom"` near the top of
a scroller, and don't put one inside `overflow: hidden` — which includes
**inside a `Dialog`**, whose panel clips so its scrolling body cannot paint
square over a rounded corner.

---

## Pagination

The archives run to ~1,177 records and had no way through them but a 31,000px
scroll.

```tsx
<Pagination
  page={page}
  pageCount={pageCount}
  hrefForPage={(n) => `/october-7/testimonies?page=${n}`}
  label="Testimony pages"
/>
```

**Links, not buttons, deliberately.** Every page is a real URL, so the row works
with JavaScript off, a page can be bookmarked and shared, the back button
behaves, and a crawler can reach record 900. A pager built from click handlers
has none of that — and it is why this is a server component, safe on every
tier.

The window shows the first page, the last page, and `siblings` either side of
the current one, eliding the rest. A gap standing in for exactly one page is
replaced by the page itself: "1 … 3" is never shorter than "1 2 3", only more
work to read. The exported `pageWindow()` is the pure function, if you need the
slots without the markup.

The ends stay present and inert at the extremes rather than disappearing, so
the row does not shift sideways on the first and last page. On a narrow screen
the row **wraps** rather than hiding its words behind a breakpoint — the
stylesheet deliberately introduces no seam of its own, because the audit that
produced `--bp-seam` and `--bp-rails` found 26 breakpoints in mixed units and a
27th is what that work was for. A page with two pagers must give them different
`label`s.

---

## StatusState

An empty or unavailable state, designed rather than forgotten. Unchanged in
this wave: a raised panel, a data eyebrow, a display-face title, and one
secondary action.

It becomes a client boundary only through `onAction`; with `actionHref` it is a
server component.

---

## `components/magicui`

The shadcn/Magic UI registry install target — `components.json` points `ui` at
this directory, so `npx shadcn@latest add @magicui/<name>` lands here. It holds
`animated-list` and nothing else.

**Registry components are Tailwind, and this is the only subtree where Tailwind
utilities are the styling system.** They must never be mixed onto one element
with a CSS Module class: CSS Modules are unlayered and win unconditionally, and
`cn()` cannot reconcile them because `twMerge` only parses Tailwind's grammar.
Put the module class on a wrapper that owns layout and let the registry
component own its interior.

`animated-list` pulls `motion`, so it is client-only and must not reach the
home route or any no-JavaScript tier — `motion` server-renders `initial` as an
inline `opacity: 0` that nothing ever clears. `components/motion/README.md`
carries the full tier rule and the list of registry components that were
rejected, with reasons.
