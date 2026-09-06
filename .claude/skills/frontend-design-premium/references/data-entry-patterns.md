# Data Entry Patterns

## Forms

Own the validation experience.

- Use real labels.
- Preserve entered values after errors.
- Use visible correction text.
- Set `aria-invalid` when invalid.
- Connect help/error text using `aria-describedby`.
- On failed submit, focus or scroll to the first invalid field.
- Prevent duplicate submit.
- Keep busy button dimensions stable.

## Selects

Explicitly choose:

- native `<select>` when OS-owned popup behavior is acceptable;
- maintained accessible listbox/select primitive when the product must own geometry, styling, search, or interaction.

Do not build ad-hoc dropdowns.

## Dates

Choose native date input only when browser/OS behavior is acceptable across supported platforms.

Otherwise use the maintained accessible date-picker.

## Textareas

Avoid arbitrary manual resizing in product layouts.

Use:

- sufficient default height;
- auto-grow when appropriate;
- explicit expansion affordance when needed.

## Secrets

Passwords, API keys, tokens, and secrets:

- masked by default;
- accessible show/hide;
- correct autocomplete semantics;
- never placed in URLs;
- never logged;
- never shown in toasts;
- never persisted casually.

## Unsaved changes

Warn before destructive navigation when meaningful user work would be lost.
