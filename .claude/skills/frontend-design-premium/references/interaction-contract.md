# Interaction Contract

Every interactive element needs a complete state model:

- default;
- hover;
- focus-visible;
- active/pressed;
- disabled;
- busy.

Use semantic HTML first.

- action → `<button>`
- navigation → `<a>`

Hover must not be the only way to discover an action.

Touch and keyboard users need equivalent access.

Disabled controls:

- must not fire handlers;
- must not appear active;
- should explain unavailability when the reason is not obvious.

Busy controls:

- keep geometry stable;
- expose perceivable status;
- prevent accidental duplicate actions.
