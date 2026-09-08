# VA-60 — production visual certification

**Run:** 2026-09-08, against the development server on the wave-3c branch.
**Harness:** `scripts/ui-audit.mjs` (162 route/viewport pairs) plus a 90-shot
capture at six viewports across fifteen surfaces, in `after/`.

## Result

**0 critical, 87 warning, exit 0, full route coverage.**
It was **20 critical, exit 1** when this began.

## The harness was three of the twenty

Before any site defect could be trusted, the audit had to stop reporting itself.

| What it reported | What it was |
| --- | --- |
| 9 × `HTTP 404` on `/pipeline` | A development-only route the script listed as complex |
| `/admin`, `/admin/login` findings | Auth-gated pages; an unauthenticated pass measures a login screen |
| 2 × `no-accessible-name` per viewport on the People hub | The rule read `textContent` and never `img alt`, so a card whose picture links to its own record read as nameless |
| 3 routes with no instance in any run | `/people-of-israel`, `/fake-resistance/watch`, `/fake-resistance/antisemitism` |

The admin routes are now **stated exemptions** rather than silent omissions. An
exemption that is not written down is indistinguishable from a gap, and a gap
that can never close pins the exit code at 1 — which is how the previous exit
code came to mean nothing.

## The defects it was hiding

**Non-text contrast, WCAG 1.4.11 (3:1).** `--line` composites to 1.36:1 over
`--ground`. `--control-line` already existed for control boundaries (A11Y-004)
and was applied only on hover, so the Support choice buttons and Ask prompt
chips were legible once found and not before. The Ask chips needed a specificity
bump — they are shadcn `Button variant="outline"` whose `dark:border-input`
(0,2,0) beat the module rule (0,1,1). The choice card's thick top rule defaulted
to `--line` too: two of three cards failed, and the third passed by being gold.

**Text contrast (4.5:1).** `--ember` reads 5.74:1 on `--ground` but **4.22:1 on
`--surface-1`**, where the "Out of context" badge sits. `--ember-soft`
(`#df9588`) is the dimmest step on the ramp clearing 4.5 on all four grounds the
badge can land on — 4.68:1 at worst. The severity distinction survives.

**No JavaScript.** `/updates` served 1,044 characters of chrome and **zero**
published records; `/fact-check` 1,408 and **zero of seven** checked claims.
Both kept their page component synchronous to hold the masthead out of a
Suspense fallback, which left the records inside one — React streams a boundary
into `<div hidden>`. Both are async now and serve complete HTML.

## VA-53 — the homepage first viewport, re-measured

VA-04 recorded the lead headline at 1176 / 1239 / 1317 / 1004 / 1174 / 1338px
and the mobile page at 12,769px (15.7 viewports).

| Viewport | Lead top | Document | Viewports |
| --- | --- | --- | --- |
| 1440×900 | **512** | 8,464 | 9.4 |
| 1024×768 | **448** | 7,785 | 10.1 |
| 768×1024 | **563** | 10,241 | 10.0 |
| 390×844 | **973** | 11,857 | 14.0 |
| 360×740 | **890** | 12,051 | 16.3 |
| 812×375 | **449** | 10,104 | 26.9 |

Every width improved, most by more than half. One editorial action dominates on
desktop by a wide margin: at 1440×900 the lead headline occupies 41,546px²
against 9,600 for the next largest element.

**On a phone the cover still fills the first viewport and the reading path sits
at the fold** (973px against 844). That is the owner's design, not a defect —
the phone cover is the photograph, and the ask is on the cover
(`.ai/DECISIONS.md`, 2026-09-07). Seven interactive elements are in that
viewport, so there is no competition to reduce. VA-53 was scoped as a re-check
rather than a rebuild, and nothing here justifies overriding a shipped design
decision.

## What remains — 87 warnings, none critical

| Count | Kind |
| --- | --- |
| 29 | `undersized-target` — mostly `summary` disclosure toggles and the brand lockup, 82×43 against a 44 floor |
| 9 | `heading-skip` — an `h2 → h4` in the homepage echo figure and similar |
| 4 | `focus-ring-clipped` |

These are recorded rather than fixed: they are warnings, the certification bar
is criticals, and several need a design decision rather than a patch.

**Not covered here.** A physical iOS device and a screen-reader pass. Both need
hardware this run does not have, and neither should be claimed on emulation.
