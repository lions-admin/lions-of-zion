# Lions of Zion

A cinematic Next.js experience built entirely from GPU particles. One React
Three Fiber canvas and one Three.js WebGPU/TSL renderer own the story intro,
crowned lion, live network scan and radial navigation. WebGL2 is the supported
fallback. The previous photographic post-intro landing page and legacy intro
renderer have been retired.

## Run locally

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. The eight destination routes are available at
`/today`, `/verify`, `/the-war`, `/october-7`, `/stories`,
`/israel-explained`, `/influence`, and `/about`.

## Graphics architecture

- `components/intro/` owns only the pure story timeline and CPU text sampling.
- `components/particle-nav/` owns every live visual layer in one React Three
  Fiber scene. All particle materials and simulation work use TSL.
- `components/Experience.tsx` mounts that one experience. The intro timeline
  drives the same lion that remains at the centre of the navigation.
- The live background is a particle-built blue network scan. There is no
  photographic background and no star field.
- The real navigation links and a generated poster are server-rendered. With
  JavaScript disabled, the intro enhancement is hidden and the links remain
  usable.

`/?forceWebGL=1` verifies the complete experience on WebGL2.
`/particle-demo?forceWebGL=1` exposes the isolated tuning harness.

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
npm run bake:nav-lion
npm run bake:nav-icons
npm run poster:nav
```

The shared lion and icon source artwork lives in `assets/`; generated runtime files live
in `public/particles`, `public/icons`, and `public/posters`.

## Backend

The repository also contains the current information-model API under
`app/api/` and `server/`. Database services are intentionally optional for the
frontend and are not provisioned by this integration.
