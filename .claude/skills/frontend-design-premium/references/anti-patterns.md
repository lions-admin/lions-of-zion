# Anti-patterns

Search changed code for these before completion.

## Native blocking dialogs

Avoid product use of:

```text
alert(
confirm(
prompt(
window.alert(
window.confirm(
window.prompt(
```

Replace with app-owned accessible dialogs.

## Clickable non-semantic elements

Avoid click handlers on `div`, `span`, `p`, or `section` when a button/link works.

## Search on every keystroke

Remote search should normally debounce and cancel/ignore stale work.

## Search with no clear control

When a search field has text, provide an app-owned keyboard-accessible clear action.

## IME-unsafe Enter handling

Do not submit/search on Enter while composition is active.

## Product textarea with uncontrolled manual resize

Use stable sizing or deliberate auto-grow.

## Secret field with no reveal option

Provide accessible reveal/hide when appropriate.

## Browser-native validation bubbles in owned product forms

Use app-owned validation when the product controls the form experience.

## Fake links or controls

Avoid `href="#"` and enabled controls with no real action.

## Screen-local duplicate primitives

Do not locally recreate maintained selects, date pickers, dialogs, toasts, loaders, validation adapters, or table behavior.

## Hidden scrollbars

Do not remove scrollbars merely for aesthetics.

## Shared shell forced to viewport height

Do not apply full-viewport locking to a shared page/form shell just to make a child table fit.

## Layout-changing hover

Avoid hover states that alter border width, padding, dimensions, or positioning and cause pointer jitter.

## Fabricated AI evidence

Never generate fake citations, source counts, confidence, verification, retrieval status, or evidence metadata.
