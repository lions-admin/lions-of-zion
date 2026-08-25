## How to build with Lions of Zion

This is the component library of an evidence desk. Its job is to make a claim,
the verdict on that claim, and the source behind the verdict readable together.
Build with that in mind: a figure without a source, or a verdict without a
badge, is off-system here in a way it would not be elsewhere.

### 1. Wrap every screen in `DesignSurface`

The system is **dark-first**. Its ground and reading defaults are supplied by
`DesignSurface` — without it components render on whatever ground the host
provides, and on white the muted ink tokens fall below usable contrast.

```jsx
<DesignSurface>            {/* ground, scan texture, reading type */}
  <VerificationBadge assessment="verified" confidence="high" />
</DesignSurface>

<DesignSurface measure>    {/* + the 68ch reading measure the dossiers use */}
  <h2 style={{ fontFamily: 'var(--face-display)', fontSize: 'var(--t-h2)' }}>…</h2>
</DesignSurface>
```

`ChatOpenProvider` is a second, narrower provider: `AskAboutFileCta` and
`AskTheLionChat` read it and **throw** outside it. Wrap them.

### 2. The styling idiom: props on components, CSS variables for your own glue

Components take **props, never class names** — there is no utility-class
vocabulary in this system and no `className` API to compose against. For the
layout glue you write around them, use the CSS custom properties below. They
are defined by the stylesheet and are the whole palette and type scale; a
hard-coded hex or px value is the tell that something is off-system.

**Type** — three faces, seven steps. Never invent a size.

| Faces | Steps |
| --- | --- |
| `--face-display` (Newsreader, serif — headings) | `--t-display` · `--t-h2` · `--t-h3` |
| `--face-text` (IBM Plex Sans — reading) | `--t-body` · `--t-small` · `--t-caption` |
| `--face-data` (Geist Mono — dates, counts, routes, status) | `--t-data` |

Each step has a matching `--t-*-lh`; `--t-display`, `--t-h2`, `--t-h3` and
`--t-caption` also have `--t-*-weight`, and `--t-data` has `--t-data-tracking`.

Two hard rules: **nothing smaller than `--t-data`**, and **uppercase +
tracking only for data labels of two words or fewer** — sentence case
everywhere else.

**Colour** — six roles, plus two data ramps.

| Role | Token |
| --- | --- |
| Page ground / its texture | `--ground` · `--scan-ground` |
| Body ink / emphatic / muted | `--ink` · `--ink-hi` · `--ink-lo` |
| Accent (verified, headings, rules) | `--gold` · `--gold-hi` · `--gold-line` |
| Hairlines | `--line` |
| Verified / monitored data | `--data-blue` · `--data-blue-dim` · `--data-blue-peak` |
| Hostile / contested data | `--data-ember` · `--data-ember-dim` · `--data-ember-peak` |

Gold means *established*; ember means *hostile or contested*. Do not use ember
decoratively — it carries a verdict.

**Cinzel (`--font-cinzel`) is not a heading face.** It belongs to the home
particle scene only, and no component here uses it.

### 3. The evidence contract

- `VerificationBadge` takes one of exactly nine `assessment` values: `verified`,
  `contested`, `misleading`, `false`, `manipulated`, `out_of_context`,
  `unsupported`, `unverified`, `satire` — plus optional
  `confidence` of `high | medium | limited`.
- `SourceList` renders a numbered stack. `Timeline` entries carry their own
  `sources`, which the page CSS moves into the right margin beside the record
  above 1220px — so keep a record and its sources as **siblings**, never nest
  the sources inside the record.
- `CorrectionHistory` with `corrections={[]}` renders "None recorded" on
  purpose. Never hide it to imply a clean record.
- `KnownUnknownPanel` states what is *not* established. It is a feature of this
  system, not filler — use it.

### 4. Where the truth is

Read these before styling; they beat any summary here:

- `_ds/<folder>/styles.css` and its imports — `fonts/fonts.css` then
  `_ds_bundle.css`, which carries every token definition and all component CSS.
- `components/<group>/<Name>/<Name>.prompt.md` — the per-component API.
- `guidelines/.ai/DESIGN-V2.md` — the design system’s own document.

### 5. An idiomatic screen

```jsx
<DesignSurface measure>
  <PublicationMeta
    edition="Edition 01 · October 2025 ceasefire"
    publishedAt="25 Aug 2026"
    reviewedBy="Editorial desk"
    sourceCount={9}
  />
  <h2 style={{ fontFamily: 'var(--face-display)', fontSize: 'var(--t-h2)', color: 'var(--gold)' }}>
    What changed
  </h2>
  <Timeline
    entries={[{
      id: 'ceasefire-signed',
      datetime: '2025-10-09',
      dateLabel: 'Oct 9, 2025',
      category: 'Diplomacy',
      assessment: 'verified',
      title: 'Israel and Hamas sign a ceasefire-hostage agreement',
      body: <p>The agreement covers a phased release of hostages and detainees.</p>,
      sources: [{ id: 'toi', label: 'Full text of the Oct. 9 deal', kind: 'The Times of Israel', url: 'https://…' }],
    }]}
  />
  <KnownUnknownPanel unknowns={['Whether the phased schedule has been revised.']} />
</DesignSurface>
```
