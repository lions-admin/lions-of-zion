# Public interaction contract

## Canonical owners

- Tokens and font roles: `app/globals.css`; taste direction: `DESIGN.md`.
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
