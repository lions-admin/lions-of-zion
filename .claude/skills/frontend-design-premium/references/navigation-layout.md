# Navigation & Layout

Define scroll ownership explicitly.

For each screen, identify:

- document scroller;
- panel scroller;
- table scroller;
- modal/drawer scroller.

Avoid nested scroll surfaces unless the UX genuinely requires them.

Do not add `100vh`, `100dvh`, or `overflow:hidden` to shared shells only to make one child fit.

For drawers/sheets:

- decide whether the surface is modal;
- define focus behavior;
- define mobile geometry separately from desktop;
- ensure close controls remain reachable;
- keep composer/actions reachable above virtual keyboards.

For tabs:

- each tab panel may require different layout behavior;
- do not let a table tab force a long-form sibling tab into a fixed-height scroller.
