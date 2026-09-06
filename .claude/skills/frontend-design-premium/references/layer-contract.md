# Layer Contract

Use a deliberate layer model for:

- base content;
- sticky chrome;
- dropdowns;
- tooltips;
- popovers;
- drawers;
- modals;
- alerts.

Do not solve layering with arbitrary escalating `z-index` values.

Overlays should not reflow document content.

Modal surfaces need:

- accessible title;
- focus placement;
- background inertness/focus trap;
- Escape behavior when dismissal is allowed;
- focus restoration.

Respect safe areas and visual viewport limits on mobile.
