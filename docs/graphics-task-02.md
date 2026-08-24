# LIONS OF ZION — Real-Time Generative Graphics
# Production Task 02: The Navigation Layer

## Where this task sits

Task 01 specified fourteen graphics belonging to one particle universe. Part of
that universe is built and deployed: the particle lion of the intro, the
photographic lion of the homepage, and the ambient field they share. That is the
**background**.

This task builds the **layer above it** — the radial navigation system, its
nodes, the field that reacts to a pointer, the lines that connect it, the mark at
its centre, its icon family, and the three transitions that move it between
states.

It also contains a prerequisite that is not optional and is not cosmetic. The
background is correct in kind and wrong in **dimensions**: it does not cover the
frame at either end of the aspect range it will actually meet, and it changes
framing discontinuously in the middle. Nothing can be registered on top of a
composition whose own extents are wrong, so Stage 0 fixes that first and Stage 1
extracts the measurement into one place that every layer reads.

The eight sections have **no destinations yet**. This task ships navigation as a
living visual state and an accessible HTML control surface, with the state model
shaped so that attaching real routes later replaces one adapter and touches no
shader.

---

## What already exists — reuse it, do not rebuild it

| File | What it is |
| --- | --- |
| `components/Experience.tsx` | Mounts both scenes, gates on `prefers-reduced-motion` during render (`:27`) |
| `components/LionExperience.tsx` | The photographic lion: displacement shader on a 10.933 × 6.15 plane, ~38k sampled particles, data field, dust, DOM typography |
| `components/intro/lion-scene.tsx` | The particle intro, mounted over the homepage with `mode="handoff"` |
| `components/intro/story-timeline.ts` | Phase constants and `getTimelineFrame()` |
| `components/intro/rolling-story-timeline.ts` | The rolling text window, `isComplete` / `outroProgress` / `brandProgress` |
| `public/assets/lion-structure.bin` | 84,773 × 16-byte records, the intro's particle cloud |
| `scripts/final-verify.mjs` | The existing real-Chrome verification pass |

The device probe at `LionExperience.tsx:17-21`, the particle-count tiering at
`:469-472`, and the pointer-to-world conversion at `:960-962` are all patterns
this layer extends rather than reinvents.

---

## The critical production rule, restated

Reference images are **specifications**. They are never shipped.

- Generated references live in `docs/references/`, never in `public/`, so they
  cannot be served by accident.
- No graphic in this document may be implemented by displaying a raster.
- Every graphic must be geometry, particles, shaders, mathematics and code.

For every component, these seven questions must have answers. Each graphic below
answers them explicitly; if a graphic cannot, it is not yet implemented as a
real-time generative system.

```text
What is the target shape?
Where do its points come from?
How is it reconstructed?
How does it behave while stable?
How does it react?
How does it transition?
Where do its particles go next?
```

---

## Palette, as enforceable numbers

Task 01 described the palette in words. This layer needs it as constants,
because a navigation system is where gold discipline is lost first.

```text
ENV_BLACK        #020509   already the renderer clear colour
ENV_NAVY         #060B16
ENV_SLATE        #0C1522

COLD_WHITE       #E8EFFB
BLUE_WHITE       #A8BCE1   already used by the DOM typography
ELECTRIC_BLUE    #6E9BE0   restrained, never a fill

GOLD             #C9A227
BRONZE           #8C6B2F
```

Two hard rules:

1. **Gold never exceeds 6% of visible particles**, at any moment, in any state —
   including during a section transfer, which is when it is most tempting.
2. **Gold is spatially bound**: it occurs within 1.5 node radii of a hovered,
   focused or active node, along an active connection, or at a convergence point.
   Gold at rest, spread across the field, is a defect.

---

# STAGE 0 — Dimensional correction of the existing background

## Why this comes first

The navigation ring is registered against the composition, not against the
window. If the composition's own scale is a two-branch heuristic that fails at
both ends of the aspect range, every position derived from it inherits the
failure. Fixing it afterwards would mean re-deriving the whole nav layout.

## The measurements

All values computed from the code as it stands.

The camera is `fov 34` at `z 10` (`LionExperience.tsx:70-76`), so at the lion's
plane:

```text
visibleHeight = 2 · tan(17°) · 10 = 6.114 world units
visibleWidth  = 6.114 · aspect
```

The lion plane is `PLANE_H = 6.15`, `PLANE_W = 6.15 · 16/9 = 10.933`
(`:93-94`, geometry built at `:267`).

### Defect 0.1 — landscape does not cover wide viewports

The landscape branch sets a constant `layout.s = 1.02` (`:108`), giving a plane
of `11.15 × 6.27`. Horizontal cover therefore holds only while:

```text
6.114 · aspect ≤ 11.15   →   aspect ≤ 1.824
```

Parallax then eats the margin: `lionGroup` moves ±0.18 (`:971`) and the camera
moves ±0.18 (`:975`), so the true limit is approximately **aspect 1.76**.

A maximised 1920×1080 window with browser chrome is roughly 1.98. A 21:9 display
is 2.33. On both, the lion image and its particle cloud **end inside the frame**.
The gap is filled by the 36×22 atmosphere plane (`:144`), so it does not read as
a black bar — it reads as a lion that is too small for its own composition.

### Defect 0.2 — portrait does not cover any phone

The portrait branch (`:103-106`) sets:

```text
s = visibleWidth / (PLANE_W · 0.40)
```

which frames 40% of the image width across the viewport. Vertical cover requires:

```text
s ≥ 6.114 / 6.15 = 0.994
```

That formula only reaches 0.994 at **aspect ≥ 0.711**. Every phone in portrait is
below it. An iPhone at aspect 0.462 gets `s = 0.646`, a plane 3.97 tall inside a
6.114 view — **65% covered**, with the crop boundary visible top and bottom.

### Defect 0.3 — the branch boundary is a visible snap

At the `aspect < 1.05` threshold, `s` jumps from 1.02 to 1.468 — **+44% across
0.002 of aspect**. Rotating a tablet, or dragging a desktop window through
square, snaps the framing.

### Defect 0.4 — resize is observed from the wrong source

Only `window.resize` is bound (`:874`), while the element is sized `100dvh`
(`:1088`) and measured with `clientWidth` / `clientHeight` (`:863`). On iOS the
URL bar collapses and the element resizes without a dependable window event, so
the renderer keeps a stale size.

### Defect 0.5 — two sizing regimes for one composition

The homepage measures the wrapper element; the intro measures
`window.innerWidth` / `window.innerHeight` (`lion-scene.tsx:666-667`). Their DPR
caps disagree as well — 1.9 / 1.5 (`LionExperience.tsx:20`) against 1.5 / 1.25
(`lion-scene.tsx:679`). A third layer must not introduce a third regime.

## The correction

**One continuous cover fit**, replacing both branches:

```text
sCover = max(visibleWidth / PLANE_W, visibleHeight / PLANE_H)
s      = sCover · PARALLAX_SLACK
```

`PARALLAX_SLACK` is **derived, not chosen**: it is the maximum combined
displacement of the lion group and the camera, expressed as a fraction of the
smaller visible extent, plus the breathing micro-scale already applied at
`:1020-1022`. With the amplitudes currently in the file this lands near 1.06;
compute it from the constants rather than hardcoding it, so a change to the
parallax cannot silently reintroduce the gap.

**Art direction as a continuous pan, not a branch.** The face sits at `v ≈ 0.65`
in plane space (`:105`, eyes measured at `:117-118`). Instead of switching to a
face crop below aspect 1.05, interpolate the framing target over aspect with a
`smoothstep` so the composition drifts from cinematic wide to face-centred with
no threshold to cross:

```text
faceBias   = smoothstep(1.30, 0.75, aspect)      // 0 wide → 1 portrait
targetV    = mix(0.50, 0.65, faceBias)
offsetY    = -(targetV - 0.5) · PLANE_H · s
```

**Correct resize source.** A `ResizeObserver` on the wrapper drives size and
projection; `window.resize` and a `matchMedia("(resolution: …)")` listener drive
only the pixel-ratio decision.

**One DPR policy**, in the module Stage 1 creates, consumed by both scenes.

## Stage 0 acceptance

- At every aspect in the verification matrix (0.46, 0.75, 1.00, 1.33, 1.78,
  2.33), the lion plane covers the frame with the parallax at its extreme, and
  the crop boundary is never visible.
- Dragging a window continuously from 2.4 to 0.45 produces no discontinuity in
  scale or position; the pan is monotonic.
- On iOS, collapsing and expanding the URL bar leaves no stale renderer size.
- No visual regression in the intro handoff: the veil still lifts onto a lion
  already in its final framing.

---

# STAGE 1 — The shared coordinate contract

## Purpose

One module owns the answer to "how big is the world, and where is anything in
it". The nav layer is registered against the lion's composition; if it derives
its own half-extents, the ring drifts off the face on every non-16:9 screen —
Defect 0.1 again, one layer up.

## The module — `components/graphics/viewport.ts`

```text
Viewport
├── element size        from ResizeObserver, not window
├── aspect
├── dpr                 one cap policy for all scenes
├── qualityTier         ultra | high | medium | low | fallback
├── halfW, halfH        world half-extents at the lion plane
├── planeScale, planeOffsetY   the Stage 0 cover fit
├── focalPoint          world position of the lion's face
├── safeArea            env(safe-area-inset-*) in world units
├── ndcToWorld(x, y)
├── worldToScreen(v3)
└── subscribe(cb)       one notification per frame at most
```

It must be framework-agnostic (a plain class with a React hook wrapper), because
both existing scenes are imperative `useEffect` bodies and neither should be
rewritten to adopt it.

## Migration

- `LionExperience.tsx` replaces `layoutForAspect()` (`:99-111`) and `onResize()`
  (`:862-868`) with subscriptions.
- `lion-scene.tsx` replaces the sizing half of `resize()` (`:666-691`) — its
  layout choice (`desktop` | `mobile`) and its text-cloud selection stay where
  they are; only the measurement moves.
- Both keep their own scene-specific scale curves. This module supplies
  measurements, not art direction.

## The background handshake

The nav layer must be able to ask the background to recede, and the background
must own how it does so. Stage 1 exposes exactly one control:

```text
background.setRecession(t)   // 0 = full presence, 1 = fully receded
```

At `t = 1` the photographic lion drops to roughly a quarter luminance, its
particle cloud thins, and the ambient field slows. The nav layer drives `t` to 1
over ~900 ms as the navigation rises, and back to 0 when it dismisses. This is
what lets the central mark occupy the frame without landing on the photographic
lion's eyes, and it is the only coupling permitted between the two layers.

## Stage 1 acceptance

- Grepping for `window.innerWidth`, `devicePixelRatio` and
  `camera.aspect` outside `viewport.ts` returns nothing in scene code.
- Both scenes render identically to their pre-migration screenshots at 1.78.
- `npx tsc --noEmit`, `npm run lint` and `npm run build` stay clean.

---

# The navigation model

## Sections

Eight, in ring order starting at twelve o'clock and proceeding clockwise:

```text
0  today               Today
1  verify              Verify
2  war                 The War
3  october-7           October 7
4  stories             Stories
5  israel-explained    Israel Explained
6  influence           Influence
7  about               About
```

Identity is data, in one module, consumed by geometry, DOM and icons alike. No
section list is written twice.

## State — one source, no router yet

```text
NavigationState
├── activeSection      id | null
├── hoveredSection     id | null
├── focusedSection     id | null      keyboard focus, feeds the same fields as hover
├── transition         { from, to, progress, startedAt } | null
├── recession          0..1           what the background is told
└── pointer            { ndc, world, velocity, isCoarse }
```

`activeSection` is set locally today. When routes arrive it is derived from the
pathname instead — one adapter changes, no shader does. Do not let any graphic
read a URL.

## Accessibility contract — the part that is not negotiable

The navigation is **real HTML**, present and operable with WebGL absent.

- A `<nav>` containing eight `<button>` elements, absolutely positioned by the
  same polar math the WebGL ring uses, with the canvas drawing over them.
- Visible focus rings, in-order tab traversal, arrow-key movement around the
  ring, `aria-current` on the active section.
- Focus drives hover state, so a keyboard user gets the same particle attraction
  a pointer user gets.
- `prefers-reduced-motion`: the ring renders in its resting state, particle
  attraction and convergence are disabled, transitions become opacity
  cross-fades under 200 ms, and `recession` snaps rather than eases. The
  navigation **degrades; it does not disappear**.
- At `qualityTier: fallback` the WebGL layer is not mounted at all and the same
  HTML nav is styled with CSS. Navigation must never require a GPU.

---

# GRAPHIC 02 — Radial Navigation Core

## Purpose

The centre of the interface: a living information architecture built from the
same material as the lion, not a static SVG diagram.

## Reference image prompt

Create an ultra-premium radial navigation interface floating inside a dark
cinematic information environment. At the centre is a minimal LIONS OF ZION lion
symbol surrounded by several extremely thin concentric rings. Around the rings
are eight navigation nodes positioned with mathematical precision. Each node
consists of a fine circular outline, a minimal gold line icon and a small label.
Use elegant orbital geometry, restrained connecting lines and tiny particle
clusters travelling between the centre and the outer nodes. The structure should
feel alive but extremely controlled. Use black, deep navy, muted blue-white
information fragments and restrained warm gold highlights. The design must feel
like a premium editorial intelligence system rather than a sci-fi control panel.
No heavy glass cards. No bright neon. No excessive HUD decoration. Large negative
space. Precise alignment. Ultra-clean cinematic interface.

## Procedural implementation

Positions are computed, never authored:

```text
angle_i  = -PI/2 + (i / 8) · TWO_PI
radius   = clamp(min(halfW, halfH) · 0.62, R_MIN, R_MAX)
x_i      = cos(angle_i) · radiusX
y_i      = sin(angle_i) · radiusY + focalOffsetY
```

Landscape uses `radiusX = radiusY = radius`. Below aspect 0.80 the ring becomes
an ellipse — `radiusX = halfW · 0.78`, `radiusY = halfH · 0.42` — interpolated
over aspect with the same `smoothstep` discipline Stage 0 established, so the
ring deforms continuously instead of switching layouts.

Rings themselves are three to five concentric line loops built as
`InstancedBufferGeometry` with a shader-side radius attribute, plus a sparse
orbital particle population riding them at differing angular velocities.

**Breathing**: a single low-frequency term applied to ring radius, amplitude
under 0.5% — perceptible only as the absence of stillness.

## The seven answers

```text
Target shape       eight polar positions and 3–5 concentric loops
Points from        mathematics only — no asset, no sampling
Reconstructed      instanced line loops + orbital particle population
While stable       sub-1% breathing, slow differential orbit
Reacts             radius eases toward hovered node; ring brightness tracks focus
Transitions        rotates by one node-step during a section transfer
Next               orbital particles are drawn from and returned to the ambient field
```

## What makes this wrong

Nodes at hand-placed coordinates. A visible layout switch at a breakpoint. Rings
thick enough to read as UI chrome. A ring centred on the viewport rather than on
the composition's focal point.

---

# GRAPHIC 03 — Navigation Nodes

## Purpose

Eight individually interactive nodes, each carrying an icon and a label, each
with three states that differ in behaviour and not merely in brightness.

## Reference image prompt

Create a premium circular navigation node for a dark cinematic intelligence
interface. The node consists of a very thin warm-gold circle containing one
minimal line icon. Around the node are several tiny information particles and
subtle radial tick marks. A faint energy connection extends toward a central
navigation system. The node should show three visual states in one design study:
idle, hover and active. Idle should be almost silent. Hover should attract nearby
particles. Active should show a stronger gold centre, a slightly brighter ring
and subtle signal emission. No large glow. No solid button background. No glass
card. No gaming aesthetic. Extremely refined and minimal.

## Procedural implementation

Each node carries a uniform block, all values eased rather than switched:

```text
idleStrength
hoverStrength
activeStrength
particleAttraction
ringIntensity
pulseAmplitude
connectionIntensity
```

Idle is close to silent: a thin ring, a handful of tick marks, a barely-moving
particle halo. Hover raises `particleAttraction` — the environment reacts before
the node does (see GRAPHIC 04). Active raises the gold centre, thickens nothing,
and begins a slow signal emission along its connection.

Labels are DOM text, not particles: they must be selectable, translatable and
readable at small sizes. The particle system draws the ring, the ticks and the
halo; HTML draws the word.

## The seven answers

```text
Target shape       a thin circle, radial ticks, an icon, a label
Points from        parametric circle; icon from SVG path sampling (GRAPHIC 13)
Reconstructed      instanced ring geometry + per-node particle halo
While stable       halo drifts; ring holds
Reacts             hover and focus raise attraction first, luminance second
Transitions        active state hands off along a connection (GRAPHIC 08)
Next               halo particles return to the ambient field on blur
```

## What makes this wrong

A filled circle. A hover that only changes opacity. A hit area smaller than
44 × 44 CSS pixels. A label rendered as particles.

---

# GRAPHIC 04 — Particle Attraction / Hover Field

## Purpose

Hovering must physically influence the field. This is what makes the navigation
feel like material rather than like an overlay.

## Reference image prompt

Create a cinematic visualisation of thousands of tiny information particles
gently bending toward a circular navigation node inside a dark navy environment.
Particles originate from several directions and gradually curve toward the active
node, creating subtle gravitational arcs. A small warm-gold centre indicates the
interaction point. Particles remain predominantly cold blue-white with only a
small percentage becoming gold near the target. The motion should feel elegant,
intelligent and physically coherent. No explosion. No vortex tunnel. No chaotic
swarm. Premium real-time graphics aesthetic.

## Procedural implementation

```text
direction = target - particlePosition
distance  = length(direction)
force     = normalize(direction) · attractionStrength · falloff(distance)
```

`falloff` is smooth and finite — it must reach exactly zero at a defined radius,
so the field has an edge and particles outside it are untouched. Combine with
curl noise for organic paths, damping for settling, and a persistent pull toward
the particle's own home target so release is a return and not a drift.

On release, `attractionStrength` decays over 600–900 ms; particles must arrive
home, not merely stop being pulled.

Coarse pointers get no hover field. On touch there is no hover, and simulating
one on tap produces a flicker.

## The seven answers

```text
Target shape       none — this is a force, not a form
Points from        the ambient field population already on screen
Reconstructed      per-particle force accumulation in the vertex shader
While stable       inactive; zero cost when no node is hovered or focused
Reacts             it is the reaction
Transitions        strength eases in over ~250 ms, out over 600–900 ms
Next               every borrowed particle returns to its home target
```

## What makes this wrong

Particles that never return. A falloff without a zero crossing. Attraction on
touch devices. Gold applied to every captured particle instead of the few nearest
the target.

---

# GRAPHIC 06 — Navigation Connection Lines

## Purpose

Connect the centre to the nodes without producing a network diagram.

## Reference image prompt

Create a refined system of extremely thin radial information connections
extending from a central circular hub toward several navigation nodes. The
connections are mostly dark and nearly invisible. Small particles occasionally
travel along the paths. The currently active path receives a restrained warm-gold
highlight. Several microscopic blue-white fragments move across secondary paths.
The composition should feel precise, elegant and architectural. No bright
circuit-board look. No thick lines. No excessive nodes. No glowing spiderweb.
Premium editorial intelligence aesthetic.

## Procedural implementation

Each connection is a quadratic Bézier from the hub to a node, with a control
point offset perpendicular to the chord so the paths bow slightly and never form
a wheel of spokes. Travellers sample the curve:

```text
position = curve.getPoint(progress)
```

Resting traffic is sparse — a few particles per second on secondary paths, a
line opacity near the threshold of visibility. The active path raises traffic
density, pulse velocity and line brightness, in that order of perceptibility.

Curves are sampled once per layout change into a shared buffer, not per frame.

## The seven answers

```text
Target shape       eight quadratic Bézier curves
Points from        hub and node positions from GRAPHIC 02
Reconstructed      sampled curve buffer + travelling particle instances
While stable       sparse traffic, near-invisible lines
Reacts             the active path gains traffic before it gains brightness
Transitions        traffic reverses direction during a section transfer
Next               travellers dissolve into the node halo on arrival
```

## What makes this wrong

Straight spokes. Lines visible at rest. All eight paths active at once.
Re-sampling curves every frame.

---

# GRAPHIC 12 — Central Lion Mark

## Purpose

A simplified lion identity at the centre of the ring, derived from the same
system as everything around it.

## Reference image prompt

Create a minimal geometric lion-head emblem built from thin warm-gold lines and
tiny particles. The mark should feel related to a premium international
publication rather than an esports logo. The lion should be recognisable using as
few lines as possible. Surround it with a subtle circular particle field and
extremely thin orbital geometry. Black background. Elegant. Authoritative.
Minimal. No shield. No crown. No aggressive roaring expression.

## Procedural implementation

The mark is a **vector path**, authored once and stored as SVG path data in a TS
module — not a raster, not a mesh. At runtime it is sampled to points by arc
length, giving an even particle distribution independent of the path's control
density.

Two representations, cross-faded by state:

- **Line mode** at rest: the path stroked as thin line geometry.
- **Particle mode** during transitions: the sampled points as a target the field
  converges into and departs from.

The mark occupies the centre only while `recession > 0.5`; below that the
photographic lion is still present and the centre stays empty.

## The seven answers

```text
Target shape       an SVG path, sampled by arc length
Points from        docs-authored path data in a TS module
Reconstructed      line geometry at rest, particle convergence during transitions
While stable       an orbital particle field, no motion in the mark itself
Reacts             minimally — this is the calm centre
Transitions        line ⇄ particle cross-fade tied to recession
Next               particles return to the ambient field when the nav dismisses
```

## What makes this wrong

A raster logo. A path sampled by control point rather than by arc length. A mark
drawn over the photographic lion's face.

---

# GRAPHIC 13 — Particle Icon System

## Purpose

One coherent icon family that belongs to the same visual language as everything
else.

Required: Today (clock), Verify (shield), The War (globe), October 7 (calendar),
Stories (heart), Israel Explained (book), Influence (network), About (person),
plus Search, Report and Claims for later use.

## Reference image prompt

Create a coherent family of ultra-minimal line icons for a premium dark editorial
intelligence platform. Icons should use extremely thin warm-gold geometry with
subtle particle accents, and remain immediately recognisable at small interface
sizes. Avoid generic thick icon libraries. Avoid filled icons. Avoid ornate
symbolism. The family must share identical stroke weight, identical visual
density, identical corner treatment and identical circular proportions. Dark
background. Premium restrained design.

## Procedural implementation

- Path data lives in one module, on a shared 24-unit grid with one declared
  stroke weight and one corner radius. The grid and the weight are constants; an
  icon that needs to break them is redrawn, not excepted.
- **Inactive**: rendered as vector line geometry. Cheap, crisp, no particles.
- **Active or transitioning**: the same paths sampled to points, so the icon
  reconstructs from the field and dissolves back into it.
- Sampled point sets are computed once and cached per icon, keyed by path and
  target count.

Both representations come from the same path data. Divergence between them is a
defect, not a style.

## The seven answers

```text
Target shape       eleven SVG paths on one 24-unit grid
Points from        the same path data, sampled by arc length
Reconstructed      line geometry when inactive, particles when active
While stable       still
Reacts             the hovered node's icon gains a faint particle accent
Transitions        vector ⇄ particle reconstruction on activation
Next               into the node halo, then the ambient field
```

## What makes this wrong

Two sources of truth for one icon. A filled glyph. An icon family assembled from
an existing icon library. Re-sampling paths per frame.

---

# GRAPHIC 08 — Active Section Signal Transfer

## Purpose

Switching sections must look like information being routed, not like a state
being toggled.

## Reference image prompt

Create a cinematic interface transition showing information particles leaving one
circular navigation node and travelling through thin curved paths toward another
navigation node. The previous node gradually loses brightness while the new node
becomes illuminated. The particles form elegant horizontal and radial trails
during the transfer. Warm gold should exist primarily near the active nodes while
most travelling particles remain blue-white. The transition should communicate
information routing rather than energy combat. Dark premium environment. Minimal.
Precise. No lightning bolts. No explosive effects. No teleportation glow.

## Procedural implementation

Transferring particles carry:

```text
currentTarget
nextTarget
transitionProgress
pathOffset
curveSeed
```

Movement is curve-based, never linear: each particle follows the hub-relative
Bézier of its origin node inward, then the destination node's curve outward, with
`pathOffset` and `curveSeed` giving each a distinct trajectory so the group reads
as traffic rather than as a rigid bundle.

Duration 700–1100 ms. The outgoing node dims **after** the first particles leave;
the incoming node brightens **before** the last arrive. The overlap is what makes
it read as routing.

## The seven answers

```text
Target shape       a node halo, in transit to another node halo
Points from        the outgoing node's halo plus a share of the ambient field
Reconstructed      staggered curve interpolation with per-particle offsets
While stable       does not exist at rest
Reacts             interrupting mid-transfer re-targets in place; it never restarts
Transitions        it is the transition
Next               the incoming node's halo, minus what the field reclaims
```

## What makes this wrong

Linear interpolation. A transfer that cannot be interrupted. Both nodes bright at
once for the whole duration. Gold on the travelling particles rather than at the
endpoints.

---

# GRAPHIC 09 — Section Reveal Particle Sweep

## Purpose

When a section opens, the field makes room for the content instead of sitting
behind it.

## Reference image prompt

Create an elegant dark-interface transition where a dense information field
subtly separates horizontally to reveal a clean editorial content area. Particles
move away from the centre as if the interface itself is filtering noise. Thin
blue-white trails remain visible around the edges. A small number of warm-gold
fragments guide the eye toward the revealed content. The transition must feel
controlled and premium. No portal effect. No explosion. No strong blur. No large
glow. The impression should be chaos reorganising into clarity.

## Procedural implementation

An **exclusion field** is declared as a world-space rectangle, derived from the
content panel's DOM rect via `viewport.ndcToWorld`, so the graphics follow the
layout rather than duplicating it:

```text
if (distanceToPanel < threshold) applyPanelRepulsion()
```

Repulsion is soft-edged and mostly horizontal — particles part sideways, matching
the field's own left/right flow, rather than radiating outward from a point.
Density just outside the boundary rises slightly, which is what makes the panel
look carved out of the field instead of pasted over it.

## The seven answers

```text
Target shape       a rectangular hole in the field
Points from        the existing ambient field
Reconstructed      soft-edged repulsion from a world-space rect
While stable       the hole persists while a panel is open
Reacts             follows the panel if it resizes or reflows
Transitions        the boundary eases in over ~500 ms
Next               particles refill the region when the panel closes
```

## What makes this wrong

A hardcoded rectangle. A radial burst instead of a horizontal parting. A blur.
Particles that never refill.

---

# GRAPHIC 10 — Information Convergence Burst

## Purpose

A very small signal event marking the moment something becomes active.

## Reference image prompt

Create a restrained microscopic information convergence event inside a dark navy
field. Several thin horizontal data trails converge into one tiny warm-gold
point. At the moment of convergence a small circular wave expands outward and
disappears. The effect should be sophisticated, tiny and brief. It must not
resemble an explosion, lens flare or starburst. Premium real-time UI
microinteraction.

## Procedural implementation

A temporary attractor with a fixed lifetime:

```text
particles approach → convergence → micro pulse → redistribution
```

Total duration **400–900 ms**. The expanding wave is a single thin ring with a
radius under one node diameter, and it fades before it reaches the neighbouring
node.

Rate-limited: at most one burst per interaction, never one per frame, never
overlapping bursts on adjacent nodes. Disabled entirely under reduced motion.

## The seven answers

```text
Target shape       one point, then one thin expanding ring
Points from        nearby ambient field particles, borrowed
Reconstructed      a temporary attractor with a lifetime
While stable       does not exist at rest
Reacts             it is a reaction
Transitions        approach, converge, pulse, redistribute
Next               borrowed particles redistribute back into the field
```

## What makes this wrong

A duration over one second. A wave larger than the node's neighbourhood. Bursts
that stack. A starburst.

---

# Shared architecture for this layer

Do not build a second particle engine. Extend the one that exists.

```text
ParticleEngine
├── LionTarget              exists — LionExperience
├── SignalFieldTarget       exists — the ambient field
├── RadialNavigationTarget  new — GRAPHIC 02
├── NodeHaloTargets         new — GRAPHIC 03
├── IconTargets             new — GRAPHIC 13
├── MarkTarget              new — GRAPHIC 12
├── TransitionPaths         new — GRAPHIC 06 / 08
└── ExclusionFields         new — GRAPHIC 09
```

Every particle interpolates between two targets and accumulates forces:

```glsl
vec3 target = mix(targetA, targetB, transitionProgress);
vec3 finalPosition = target + noiseOffset + interactionForce + flowForce;
```

`VerifyShieldTarget` from Task 01 is deliberately absent — it is Task 03. The
architecture must leave room for it without stubbing it.

---

# Performance budget

The nav layer is an addition to an existing scene that already carries 38k
particles on desktop. It gets a stated budget, not "as much as it needs":

| | Ultra | High | Medium | Low |
| --- | --- | --- | --- | --- |
| Nav particles | 8,000 | 5,000 | 3,000 | 1,500 |
| Concurrent path travellers | 240 | 160 | 80 | 40 |
| Ring loops | 5 | 4 | 3 | 2 |
| Added draw calls | ≤ 6 | ≤ 6 | ≤ 4 | ≤ 3 |

Required:

- `InstancedBufferGeometry` for rings, nodes and travellers — one draw call per
  family, not per node.
- Typed arrays allocated once at layout, reused across frames.
- Curve sampling and icon point sampling cached per layout, never per frame.
- No per-particle React state. No DOM node per particle. The DOM in this layer is
  eight buttons and eight labels.

Target 60 FPS on modern desktop hardware. Measure before and after Stage 0 so the
nav layer's cost is separable from the background's.

---

# Adaptive quality and mobile

Tiers come from the probe already in `LionExperience.tsx:17-21`, promoted into
`viewport.ts` and extended with a renderer-capability check: **ultra**, **high**,
**medium**, **low**, **fallback**.

Mobile is an intentional design, not a scaled-down desktop:

- The ring becomes the ellipse described in GRAPHIC 02, with labels inside.
- There is no hover field (GRAPHIC 04 is pointer-only).
- Connection traffic drops to the active path alone.
- Icons stay in vector mode; particle reconstruction is desktop-only.
- Node hit areas respect `env(safe-area-inset-*)`; nothing sits under the home
  indicator.

Preserved on every tier: the ring's identity, the node positions, the active
state, and the section transfer — reduced in particle count, never removed.

---

# Reference generation workflow

For each graphic, in order:

1. Generate one high-resolution reference from the prompt above. Save it to
   `docs/references/graphic-NN-name.png`. Never to `public/`.
2. Analyse it for silhouette, density, lighting, depth, hierarchy, colour
   distribution, negative space and implied motion.
3. Choose the geometry source: mathematics, SVG path, sampled curve, or the
   existing field.
4. Produce GPU-readable target data — positions, seeds, region masks, phases.
5. Build the real-time version.
6. Animate and integrate it into the shared engine.
7. Compare against the reference, and discard the reference from the runtime
   entirely.

`scripts/gen-image.mjs` and `scripts/prompt-*.txt` are the existing precedent for
step 1; they are not part of the build and must stay that way.

---

# Verification

Read `CLAUDE.md` before trusting any screenshot.

- **The in-app browser pane cannot render this project.** It reports
  `document.visibilityState === "hidden"`, so `requestAnimationFrame` is
  suspended and both scenes freeze black.
- **Headless Chromium is also wrong.** It falls back to SwiftShader, which is
  exactly the case the GPU probe rejects.
- Use real Chrome driven by `playwright-core`, as `scripts/final-verify.mjs`
  already does.

Required screenshot matrix — the aspects where the current background provably
fails, plus the ones it passes:

```text
0.46   phone portrait
0.75   tablet portrait
1.00   square, the old branch boundary
1.33   tablet landscape
1.78   the design aspect
2.33   ultrawide
```

For each: the background alone (Stage 0), then the nav at rest, hovered, active,
and mid-transfer.

Also verify:

- A continuous drag from 2.4 to 0.45 with no discontinuity.
- Keyboard-only traversal of all eight nodes with visible focus.
- `prefers-reduced-motion` on: no attraction, no bursts, nav still operable.
- WebGL disabled: HTML navigation still present and usable.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

The `intro-frame-reviewer` agent exists for intro composition and should be used
if anything in this task touches the handoff.

---

# Definition of done

- Stage 0 acceptance met at all six aspects.
- Stage 1 acceptance met; no scene code measures the window directly.
- All nine graphics implemented procedurally, each answering its seven questions
  in code that a reader can find.
- No raster asset added to `public/` by this task.
- Gold never exceeds 6% of visible particles in any captured frame.
- Navigation operable with WebGL absent and with a keyboard alone.
- Frame budget met at the stated tier counts.
- `.ai/STATE.md` and `.ai/DECISIONS.md` updated: the position of the work, and
  the reasoning behind the cover fit and the background handshake.

---

# Order of work

```text
1  Stage 0    dimensional correction         — blocks everything
2  Stage 1    viewport contract + handshake  — blocks everything below
3  GRAPHIC 02 radial core
4  GRAPHIC 12 central mark
5  GRAPHIC 13 icon system, vector mode
6  GRAPHIC 03 nodes
7  GRAPHIC 06 connection lines
8  GRAPHIC 04 hover attraction
9  GRAPHIC 08 section transfer
10 GRAPHIC 10 convergence burst
11 GRAPHIC 09 reveal sweep
12 GRAPHIC 13 icon particle mode
```

Steps 3–6 produce a navigable interface. Everything after makes it alive. If the
task is cut short, it must be cut after step 6 or after step 9 — never in the
middle of a transition system, which would leave the field with particles that
have no way home.
