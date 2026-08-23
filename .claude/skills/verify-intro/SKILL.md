---
name: verify-intro
description: Capture the intro sequence in a real Chrome window and report collisions, timing and console errors. Use after any change to the intro's copy, timing, composition or shaders.
disable-model-invocation: true
---

# Verify the intro

Everything on this page animates inside `requestAnimationFrame`, which makes the
usual verification paths useless:

- **The in-app browser pane reports `visibilityState: "hidden"`.** The browser
  suspends rAF, measured at 0 callbacks/sec. Both canvases render as a frozen
  black rectangle no matter what the code does. Fronting the tab does not help.
- **Headless Chromium falls back to SwiftShader.** A software rasteriser is
  precisely the case `LionExperience`'s GPU probe rejects, so the homepage
  scene never mounts.

So verification means a real, headed Chrome. Nothing else proves anything.

## Run it

```bash
node .claude/skills/verify-intro/capture.mjs
```

Options: `--url` (default `http://localhost:3000`), `--out` (default a temp
dir), `--mobile` for the 390×844 layout, `--skip` to exercise the skip path.
Start the dev server first via `preview_start`, and pass its actual port —
`autoPort` is on, so it is rarely 3000.

## Then look at the frames

The script prints where it wrote the PNGs. **Read them.** The failure this
exists to catch is compositional, not thrown: copy landing across the lion's
face typechecks, lints, builds and logs nothing. Check each frame for:

- Copy overlapping the lion — the lion vacates a lane as `lionRelocation`
  rises; text belongs in the space it left, not on its face.
- The rolling window still erasing older lines rather than stacking forever.
- The handoff completing: the intro unmounts and the homepage lion is revealed,
  not black.
- Duration landing where you expect. The script reports when the intro ended;
  it is a function of line count, not of any declared constant.
