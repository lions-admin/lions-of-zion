# Public interaction contract

## Canonical owners

- Tokens and font roles: `app/globals.css`; visual direction follows the owner's current request and rendered UI.
- Actions, inputs and overlays: `components/ui/Button`, `Field`, `Dialog`.
  Extend these owners rather than adding duplicate local primitives.
- Public search: `components/search/SearchPanel.tsx` and `useSearch.ts`.
- Archive filters and URL state: `components/archive/ArchiveIndex.tsx`.
- Public account providers: `components/auth/PublicAuthControl.tsx`.
- Reports, volunteering and donation navigation: `components/support/`.
- Ask launcher and conversation: `components/ask/`.

## Required behavior

- Search is debounced; composition must finish before requesting results.
  Aborted or stale requests must not replace a newer query. Clearing restores
  input focus and removes the query from the URL. Empty and failure states
  must remain distinguishable.
- Archive clearing preserves selected facets and resets pagination. Pending
  URL writes must not restore the cleared text.
- Dialogs have a name, close control, Escape support and focus restoration.
  Mobile panels must remain scrollable without document-width overflow.
- Provider sign-in, public reports and payment links retain their existing
  destinations and authorization semantics. Visual review must not submit
  reports, charge payments, or fabricate authenticated state.
- Controls retain visible focus, readable labels and mobile touch targets.
  Metadata is separate from editorial prose; do not transform all copy to caps.
- Public search and archive labels are English; this does not authorize
  replacing the authenticated administration area's existing language.

## Verification boundary

Use rendered desktop and mobile viewports, not build success alone. Browser
emulation is not real iPhone/Safari validation. Authenticated admin workflows,
external provider callbacks and payments require separate access and checks.

## Homepage journey contract — September 6, 2026

The homepage renders one stable edition through five content domains. It keeps
both selected records visible, never randomizes on the client, never opens a
graphic archive asset or autoplay media below the lion, and labels editorial
illustration/safe-cover imagery as non-evidence. Claim status appears before
the claim; an unresolved record is not phrased as a finding. Each section has a
single destination action and honest empty/unavailable states. Ask must not
cover links, warnings or media credits on mobile or enlarged text.

### Phone refinement — September 6, 2026

- Each section shows a lead and a companion; both are visible without any
  interaction and their order is the edition's, never the client's.
- A preview shows whole sentences within a budget and clamps only as a
  backstop; it never ends on a cut word, and it does not remove fields from
  the document. Status precedes the claim and is stated once.
- The edition is one ground from cover to footer; no section changes the
  page's colour mid-page (owner ruling, 2026-09-06).
- On a phone a record is an open column, not a box inside the page; a
  dossier's identity is its status line, its kicker and its finding rule.
- On a phone, body and summaries are never below 16px, metadata and
  captions never below 13px, kickers never below 11px.
- Every image carries its disclosure as the first caption line, visibly,
  never behind a tooltip; `alt` carries the full sentence.
- The section's one destination action follows the records on a phone.
- Below 1100px on the homepage the Ask launcher retracts while the reader
  scrolls down and returns on scroll up, at the end of the page, or on
  keyboard focus; it keeps a 44px-or-larger target, its accessible name,
  `aria-expanded`, safe-area offsets and focus restoration. It is never
  hidden from the tab order, and the page reserves no column for it.
