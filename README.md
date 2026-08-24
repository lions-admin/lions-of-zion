# Lions of Zion

A cinematic Next.js experience built entirely from GPU particles: the original
story intro hands off to a crowned-lion radial navigation over a live network
scan. The previous photographic post-intro landing page has been retired.

## Run locally

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. The eight destination routes are available at
`/today`, `/verify`, `/the-war`, `/october-7`, `/stories`,
`/israel-explained`, `/influence`, and `/about`.

## Graphics architecture

- `components/intro/` is the preserved Three.js particle intro.
- `components/particle-nav/` is the post-intro React Three Fiber scene. It uses
  WebGPU + TSL when available and falls back to WebGL2.
- `components/Experience.tsx` owns the handoff. The new GPU scene starts at the
  beginning of the intro's 2.8-second outro, so its lion assembles while the
  intro veil clears instead of running two engines for the whole story.
- The live background is a particle-built blue network scan. There is no
  photographic background and no star field.
- The real navigation links and a generated poster are server-rendered. With
  JavaScript disabled, the intro enhancement is hidden and the links remain
  usable.

`/particle-demo?forceWebGL=1` exposes the isolated scene, tuning controls and
the explicit WebGL2 fallback.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:graphics -- http://localhost:3000 /tmp/lions-matrix
node scripts/final-verify.mjs http://localhost:3000 /tmp/lions-final
```

Graphics verification launches the installed macOS Google Chrome rather than a
hidden in-app pane, because a hidden pane throttles `requestAnimationFrame`.

## Rebuilding particle assets

```bash
npm run build:lion-data -- /absolute/path/to/intro-source.png
npm run bake:nav-lion
npm run bake:nav-icons
npm run poster:nav
```

The navigation source artwork lives in `assets/`; generated runtime files live
in `public/particles`, `public/icons`, and `public/posters`.

## Backend

The repository also contains the current information-model API under
`app/api/` and `server/`. Database services are intentionally optional for the
frontend and are not provisioned by this integration.
