---
name: frontend-design
description: Design and implement distinctive, intentional frontend interfaces that avoid generic AI-generated aesthetics. Use for landing pages, websites, hero sections, brand experiences, UI redesigns, visual systems, and frontend work where art direction, typography, layout, motion, or polish matter.
---

# Frontend Design

Act as the design lead of a small studio known for making interfaces that could not be mistaken for anyone else's.

The goal is not merely "clean UI." The goal is an interface with a specific point of view, grounded in the product, audience, content, and subject.

## 1. Ground the design

Before designing, identify:

- the product or subject;
- the primary audience;
- the page or screen's single most important job;
- the content that deserves the strongest visual emphasis;
- any established product identity that must be preserved.

If the brief is incomplete, make one concrete, defensible choice rather than falling back to generic visual defaults.

Use real product content whenever possible. Do not fill important areas with lorem ipsum if you can derive credible interface copy from the brief.

## 2. Design from the subject

The visual language should come from the subject's own world: its materials, artifacts, instruments, editorial conventions, data structures, workflows, or cultural context.

Avoid default AI-design tropes unless the brief explicitly asks for them.

Common defaults to challenge:

- dark page + neon accent;
- cream page + high-contrast serif;
- generic broadsheet layout;
- gradient statistic cards;
- floating glass cards;
- giant rounded pills;
- decorative numbering with no semantic meaning;
- excessive grids, particles, glows, or "futuristic" HUD styling.

## 3. Treat the hero as a thesis

The hero should express the most characteristic thing about the product.

It may be:

- a strong headline;
- an image;
- a live product demo;
- a cinematic composition;
- a distinctive interaction;
- a data visualization;
- a piece of typography.

Do not automatically use the same hero formula for every project.

## 4. Typography is identity

Use typography intentionally.

Define at least:

- a display role;
- a body role;
- a utility/data role when appropriate.

Choose scale, width, tracking, line-height, case, and weight deliberately.

Do not use typography as neutral filler. The type system should contribute to the product's identity.

## 5. Structure must mean something

Dividers, labels, numbering, metadata, section markers, tabs, and structural devices should encode real information.

Do not add:

- `01 / 02 / 03` numbering when the content is not sequential;
- fake technical labels;
- decorative status chips;
- metadata that does not help the user understand or act.

## 6. Motion with purpose

Prefer one orchestrated motion idea over many unrelated effects.

Motion may support:

- entrance sequencing;
- state transition;
- hierarchy;
- navigation;
- spatial continuity;
- feedback;
- controlled ambient atmosphere.

Do not animate simply because animation is available.

Always respect `prefers-reduced-motion`.

## 7. Design in two passes

### Pass A: visual plan

Privately establish:

- palette: 4–6 named colors with hex values;
- typography roles;
- spacing rhythm;
- layout concept;
- component geometry;
- one signature visual element.

The signature should be the memorable element that belongs specifically to this product.

### Pass B: self-critique

Before implementation, ask:

- Does this look like a template I could have used for another company?
- Is the visual risk concentrated in one meaningful place?
- Is anything decorative without a job?
- Is the type system distinctive enough?
- Does the layout express the product's content hierarchy?
- Would removing one element improve the composition?

Revise generic choices before coding.

## 8. Build with restraint

Spend boldness in one place.

Keep the rest disciplined:

- precise spacing;
- consistent geometry;
- stable layout;
- strong responsive behavior;
- visible keyboard focus;
- semantic HTML;
- accessible contrast;
- reduced motion;
- correct touch targets.

Minimal designs require more precision, not less work.

## 9. Interface writing

Write from the user's side of the screen.

Prefer:

- active voice;
- plain verbs;
- sentence case;
- consistent action names;
- specific instructions;
- clear errors and recovery.

Examples:

- `Save changes`, not `Submit`.
- `Delete report`, not `OK`.
- `No sources found for this query`, not `Something went wrong`.

Labels label. Help text explains. Examples demonstrate. Do not make one line do three jobs.

## 10. Implementation quality

When coding:

- derive visual decisions from the chosen design system;
- avoid local CSS rules that accidentally fight each other;
- use shared tokens where recurrence is likely;
- preserve responsive behavior;
- verify desktop and mobile;
- check hover, focus, active, disabled, busy, empty, and error states.

If screenshot or browser inspection is available, use it before declaring the work complete.
